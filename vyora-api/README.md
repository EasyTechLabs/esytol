# vyora-api

Contract-driven modular monolith for the Vyora credit ledger.

> **Synthetic data only. Localhost only.** No real merchant data exists here, no
> environment is deployed, and the web app does not call this API. The server
> **refuses to start** against a non-loopback database.

```
vyora-api/
  openapi/openapi.yaml   ← the source of truth; loaded at boot as the validator
  migrations/            ← numbered SQL, applied in order
  src/
    config.ts            ← startup safety gates
    contract.ts          ← parses openapi.yaml into runtime validators
    server.ts            ← Fastify assembly
    auth/                ← tenant resolution (bearer + development scheme)
    events/apply.ts      ← THE single event-application path
    modules/{system,parties,sync}/
    db/, seed/
  tests/
```

## Prerequisites

Node 20+ and a local PostgreSQL 16 on `127.0.0.1:55432`.

This machine runs PostgreSQL from portable binaries rather than Docker — Docker
Desktop could not start here (no virtualisation support). See
`../docs/platform/api-validation-report.md` §1.

```bash
# start / stop the local cluster (paths as installed on this machine)
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" \
  -o "-p 55432 -h 127.0.0.1" -l "C:\Users\dell\pgsql16\server.log" -w start
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" -w stop
```

## Local startup

```bash
cd vyora-api
npm ci

cp .env.example .env          # then confirm DATABASE_URL points at 127.0.0.1

npm run db:migrate            # apply migrations
npm run db:seed               # two synthetic workspaces
npm start                     # http://127.0.0.1:4000
```

Confirm it is up:

```bash
curl -s http://127.0.0.1:4000/api/v1/health
curl -s -H "Authorization: Bearer alpha-token-synthetic" http://127.0.0.1:4000/api/v1/me
```

`npm run dev` is the same thing with reload on change.

## Test

```bash
npm test                      # 80 tests against a real PostgreSQL database
npm run type-check            # tsc --noEmit
npm run contract:lint         # redocly lint openapi/openapi.yaml
npm run validate              # all three, in that order
```

Tests use a **separate database** (`vyora_test`), migrate it from empty and
re-seed per file, so running them never touches your development data.

```bash
# point tests elsewhere if you like
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/vyora_test npm test
```

## Reset

```bash
npm run db:reset              # drop the schema, re-apply migrations
npm run db:seed               # re-seed the two synthetic workspaces
```

`db:reset` drops `public` and rebuilds it. It is local-only and destructive by
design — there is nothing here worth keeping.

## Shutdown

```bash
# Ctrl-C in the terminal running `npm start`, or:
pkill -f "tsx src/index.ts"

"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" -w stop
```

## Synthetic credentials

Seeded by `npm run db:seed`. Every value below is invented.

| Workspace              | Bearer token            | Dev identity |
| ---------------------- | ----------------------- | ------------ |
| Alpha Kirana Store     | `alpha-token-synthetic` | `alpha`      |
| Beta Cloth House       | `beta-token-synthetic`  | `beta`       |
| _(expired, for tests)_ | `alpha-token-expired`   | —            |

```bash
curl -H "Authorization: Bearer alpha-token-synthetic" ...   # production scheme
curl -H "X-Vyora-Dev-Identity: alpha" ...                   # development scheme
```

## Three rules the code enforces

**1. Tenant scope comes from the token.** No path, query parameter, header or
body property accepts a `merchantId`. `GET /me` is the only place it appears in
a response. A caller that cannot name a workspace cannot reach the wrong one,
whatever a handler forgets to check.

**2. `Party` is the only contact resource.** No customer or supplier entity, no
role column. `position` is derived by folding entry direction at read time.

**3. Sync appends events; it never replaces state.** Every projection change
goes through `src/events/apply.ts`, one event at a time — REST writes included.

## Safety gates

The process **exits non-zero** rather than warning when:

- `VYORA_DEV_AUTH=true` and `NODE_ENV=production`
- `DATABASE_URL` points anywhere but loopback

```bash
NODE_ENV=production VYORA_DEV_AUTH=true npm start
# STARTUP REFUSED: VYORA_DEV_AUTH=true is refused when NODE_ENV=production.
# exit 1
```

Both are covered by tests. A control nobody tests is a control nobody has.

## Isolation from esytol

`vyora-api/` has its own `package.json` and `package-lock.json`. It is not an
npm workspace, and nothing in `esytol` imports from it or references it. The web
build, Vercel configuration and CI are untouched — deleting this directory
restores the repository exactly (ADR-0001).

## Design documents

| Document                                                                | Covers                                        |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| [`api-implementation.md`](../docs/platform/api-implementation.md)       | how the implementation maps to the contract   |
| [`api-validation-report.md`](../docs/platform/api-validation-report.md) | database path, validation output, limitations |
| [`openapi-design.md`](../docs/platform/openapi-design.md)               | endpoint and schema summary                   |
| [`auth-and-tenant-model.md`](../docs/platform/auth-and-tenant-model.md) | tenancy, bearer and development schemes       |
| [`sync-protocol.md`](../docs/platform/sync-protocol.md)                 | push, pull, cursors, rejection semantics      |
| [`api-error-model.md`](../docs/platform/api-error-model.md)             | error envelope and codes                      |

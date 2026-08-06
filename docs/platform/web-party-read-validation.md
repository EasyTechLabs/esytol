# Web Party Read — Validation Report

> VYORA-PLATFORM-005, run 2026-08-06 on the founder's Windows 10 machine
> (i3-6006U, 2 cores, 11.8 GB).
> Design and rationale: `web-party-read-integration.md`.

---

## 0. The confirmations, up front

- **The flag is disabled by default.** `.env.example` ships
  `NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=false`, and the gate treats
  absence, `""`, `"1"`, `"yes"` and `"TRUE"` as off. Only the exact string
  `"true"` enables anything.
- **No real merchant or pilot data was sent anywhere.** The API holds two
  synthetic seeded workspaces; the web app's local ledger was never uploaded,
  copied or transmitted. There is no write path on this integration at all.
- **Nothing was deployed.** No push, no Vercel deploy, no environment variable
  set anywhere but this machine.
- **The default pilot experience is unchanged.** With the flag off the notice
  renders nothing and both screens read the local ledger exactly as before.

## 1. API CI workflow

`.github/workflows/api-ci.yml`, named **API CI** — separate from `CI` and
`Deploy Production`, both of which are untouched.

| Requirement                                 | How it is met                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Runs only on API changes, plus manually     | `paths: ["vyora-api/**", ".github/workflows/api-ci.yml"]` on `push` and `pull_request`, plus `workflow_dispatch` |
| Node LTS                                    | `actions/setup-node@v4` with `node-version: "20"`                                                                |
| PostgreSQL 16 service container             | `services.postgres.image: postgres:16` with a `pg_isready` health check                                          |
| Migrations on a fresh test database         | `vyora` and `vyora_test` dropped and recreated, then `npm run db:migrate`                                        |
| Type-check, contract lint/bundle, tests     | four separate steps                                                                                              |
| Fails on undocumented routes / parity drift | `tests/contract.test.ts` compares registered routes to contract operations **in both directions**                |
| Named separately                            | `name: API CI`; release protections reference the old names and are unaffected                                   |

### Result

**No CI run URL exists, because nothing was pushed** — and pushing is outside
this milestone. Rather than assert the workflow "should" work, the exact step
sequence was executed locally against PostgreSQL 16.14:

```
--- Create fresh databases ---   DROP/CREATE vyora, vyora_test        ✅
--- Apply migrations ---         applied: 001_init.sql                 ✅
--- Type check ---               tsc --noEmit, clean                   ✅
--- Contract lint ---            0 errors, 0 warnings                  ✅
--- Contract bundle ---          every $ref resolved                   ✅
--- Test ---                     Test Files 6 passed, Tests 80 passed  ✅
```

The workflow YAML was also parsed and its structure asserted: trigger set, path
filters, service image `postgres:16`, Node 20, and the ten steps in order.

**What this does not prove:** that GitHub's runner behaves identically. The
service-container health gate and the `ubuntu-latest` image are the two things
only a real run can confirm. The first CI run after a push is where that gets
settled.

## 2. Web integration test results

```
$ npx vitest run tests/vyora/party-*
 Test Files  4 passed (4)
      Tests  57 passed (57)
```

| File                              | Tests | Covers                                                                   |
| --------------------------------- | ----: | ------------------------------------------------------------------------ |
| `party-api-gate.test.ts`          |    24 | flag default, production refusal, loopback-only, credential-safe reasons |
| `party-source.test.ts`            |    13 | local/remote adapters, every remote failure mode, read-only surface      |
| `party-read-integration.test.tsx` |    10 | which source a screen actually uses, fallback, retry                     |
| `party-dev-proxy.test.ts`         |    10 | server-side gate, credential containment, no write handlers              |

Against the milestone's required list:

| Required proof                                           | Where                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Default configuration still uses the local Party path    | `party-read-integration.test.tsx` — asserts `source === "local"` **and** that `fetch` is never called |
| Development flag + localhost API uses the remote adapter | `party-read-integration.test.tsx` — `source === "remote"`, remote rows rendered                       |
| Remote API failure does not lose or mutate local data    | `party-source.test.ts` (3) + `party-read-integration.test.tsx` (3)                                    |
| A production build cannot activate development API reads | `party-api-gate.test.ts` (2) + `party-dev-proxy.test.ts` (1) + a real production build                |
| Existing Vyora tests remain green                        | root suite, §3                                                                                        |
| API CI runs green with PostgreSQL service                | §1 — locally reproduced, not yet run on GitHub                                                        |
| Root validate passes with local PostgreSQL stopped       | §3                                                                                                    |

### The invariant that matters most

_A remote failure must lose and mutate nothing._ Tested across connection
refused, HTTP 500, a non-JSON body, and a `null` answer for a party that exists
locally. In each case:

- the ledger projection is **byte-identical** afterwards (`JSON.stringify`
  compared before and after);
- the stored log under `vyora.events.v2` is unchanged;
- `localStorage.setItem`, `removeItem` and `clear` are stubbed and asserted
  **never called** from any read path;
- the screen still shows the merchant's own rows.

A `null` remote answer is specifically **not** treated as evidence a party is
gone.

### Credential containment, proven twice

Once by reading the source — the identity env var and the identity header appear
in no client-side module — and once against a real production build:

```
$ NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true \
  VYORA_API_DEV_IDENTITY=super-secret-dev-identity npm run build
✓ Compiled successfully in 49s

$ grep -rl "super-secret-dev-identity" .next/static/
NOT PRESENT — credential stayed server-side

$ grep -rl "x-vyora-dev-identity" .next/static/
NOT PRESENT
```

The build succeeding with the flag enabled is itself part of the proof:
production does not fail on the flag, it **ignores** it.

## 3. Root validation result

```
$ npm run validate
 Test Files  124 passed (124)
      Tests  2395 passed (2395)
 ✓ Compiled successfully in 36.8s
exit 0
```

Type-check, lint, format:check, 2395 tests and the production build, all green.
Up from 120 files / 2338 tests — **+4 files, +57 tests, 0 regressions.**

**Run with the local PostgreSQL cluster stopped**, per the known limitation
below.

## 4. Known local-machine limitation (documented, not fixed)

On this machine the root `npm run validate` fails while the local PostgreSQL
cluster is running. It fails on `tests/lib/emi.test.ts`:

```
FAIL  tests/lib/emi.test.ts > 1000 deterministic scenarios
Error: Test timed out in 30000ms.
```

This was diagnosed in VYORA-PLATFORM-004 and is **not** caused by any change in
either milestone:

- run alone that file passes, but its heavy test needs **32.8 s against a 30 s
  budget** — almost no headroom;
- with the cluster stopped, the full root validate passes cleanly (§3);
- reproduced twice with the cluster running, and passing every time without it.

**Cause:** an i3-6006U with 2 physical cores cannot run a PostgreSQL cluster and
a 360,000-iteration reconciliation test concurrently.

**Workaround:** stop the cluster before running the root validate.

```bash
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" -w stop
npm run validate
```

**Deliberately not fixed here.** The milestone says not to alter the EMI test or
root validation, and that is the right call — changing a timeout to make a
symptom disappear on one machine is not a fix. CI is unaffected: `API CI` runs
the API suite on its own runner, and web `CI` never starts a database.

Worth flagging for a future milestone: that test is one slow machine away from
failing on its own merits, independent of anything Vyora does.

## 5. What was changed

| File                                                                 | Change                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `.github/workflows/api-ci.yml`                                       | **new** — API CI                                                       |
| `lib/vyora/party-source.ts`                                          | **new** — read interface + local default                               |
| `lib/vyora/party-api-config.ts`                                      | **new** — the three-condition gate                                     |
| `lib/vyora/party-source-remote.ts`                                   | **new** — remote implementation                                        |
| `app/api/vyora-dev/parties/{forward,route}.ts`, `[partyId]/route.ts` | **new** — server-side proxy, `GET` only                                |
| `features/vyora/usePartySource.ts`                                   | **new** — source selection + fallback                                  |
| `features/vyora/PartySourceNotice.tsx`                               | **new** — dev banner, renders nothing by default                       |
| `features/vyora/screens/Parties.tsx`                                 | reads through the hook; renders the notice                             |
| `features/vyora/screens/PartyStatement.tsx`                          | same, for header identity and net                                      |
| `.env.example`                                                       | documents the flag, default `false`, and the never-`NEXT_PUBLIC_` rule |
| `tests/vyora/party-*.{ts,tsx}`                                       | **new** — 57 tests                                                     |

**Untouched:** `ci.yml`, `deploy-production.yml`, `vercel.json`,
`next.config.ts`, `lib/vyora/store.ts`, `lib/vyora/commands.ts`,
`lib/vyora/events.ts`, `VyoraProvider.tsx`, and every other Vyora screen.

No existing test was modified, skipped or weakened.

## 6. Summary

| Gate                                           | Result                                  |
| ---------------------------------------------- | --------------------------------------- |
| API CI workflow authored, separate from web CI | ✅                                      |
| API CI step sequence reproduced locally        | ✅ 80 tests, contract valid             |
| API CI run on GitHub                           | ⚠️ **not run — nothing was pushed**     |
| Web integration tests                          | ✅ 57 passed                            |
| Root `npm run validate`                        | ✅ 2395 passed, build compiled, exit 0  |
| Flag disabled by default                       | ✅ asserted by tests and `.env.example` |
| Production ignores an enabled flag             | ✅ tested, and proven by a real build   |
| Credential absent from client bundles          | ✅ grep against `.next/static/`         |
| No real merchant data transmitted              | ✅ no write path exists                 |
| Nothing pushed or deployed                     | ✅                                      |

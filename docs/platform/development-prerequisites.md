# Development Prerequisites

> Verified 2026-08-09 on the founder's Windows 10 machine (build 19045,
> Intel i3-6006U, 2 cores / 4 threads, 11.8 GB).
> Supersedes `environment-validation.md` for day-to-day platform work.

---

## 0. Summary

**Local web / API / database development is fully unblocked.** Every capability
the platform work needs is installed and verified. Nothing was installed for
this milestone — the toolchain was already complete.

Three items remain unavailable. **None of them blocks local ledger work**, and
each is recorded in §4 with what it actually gates.

## 1. Capability audit

No plugin, skill or template marketplace is available in this environment, and
none was needed: every capability below is already satisfied by a dependency the
repository installs. **Nothing was installed or enabled for this milestone.**

| Capability                | Provided by                                     | Status |
| ------------------------- | ----------------------------------------------- | ------ |
| TypeScript                | `typescript@5.9.3`                              | ✅     |
| Next.js / React           | `next@15.5.22`, `react@19.2.7`                  | ✅     |
| API framework             | `fastify@5.11.2`                                | ✅     |
| PostgreSQL driver         | `pg@8.22.0`                                     | ✅     |
| Migrations + testing      | hand-rolled runner + `vitest@2.1.9` (API)       | ✅     |
| OpenAPI 3.1 validation    | `ajv@8.20.0`, `yaml@2.9.0`                      | ✅     |
| OpenAPI 3.1 lint / bundle | `@redocly/cli@1.34.18`                          | ✅     |
| Web testing               | `vitest@4.1.9`, `@testing-library/react@16.3.2` | ✅     |
| Browser end-to-end        | Microsoft Edge 150 + Chrome DevTools Protocol   | ✅     |
| GitHub Actions            | `ci.yml`, `api-ci.yml`, `deploy-production.yml` | ✅     |
| React Native / Expo       | _not installed_ — see §4.2                      | ⚠️     |

### On browser end-to-end tooling

Playwright and Puppeteer are **absent**, and deliberately not installed.

Edge is present and driven over CDP using Node 24's native `WebSocket`, which
has run every end-to-end verification in this project so far — fresh throwaway
profiles, network capture, JS evaluation, storage inspection. Adding Playwright
would pull a large dependency tree and a browser download to duplicate a
capability that already works, and the instruction was to install only what is
directly needed.

> Two known quirks of driving this app in a browser, both documented from
> earlier milestones and both worked around without touching application code:
> Next dev's React Refresh needs `unsafe-eval`, which the app CSP forbids
> (`Page.setBypassCSP`), and Vyora's service worker will serve a stale bundle
> after a flag change (use a new profile).

## 2. Verified local prerequisites

| Prerequisite               | Detected                                             | Status |
| -------------------------- | ---------------------------------------------------- | ------ |
| Node                       | `v24.19.0` — LTS, and the version pinned in `API CI` | ✅     |
| npm                        | `11.17.0`                                            | ✅     |
| Git                        | `2.55.0.windows.3`                                   | ✅     |
| Java JDK 21                | `openjdk 21.0.12 2026-07-21 LTS` (Temurin)           | ✅     |
| PostgreSQL 16              | `postgres (PostgreSQL) 16.14`, native binaries       | ✅     |
| Database connectivity      | `psql -h 127.0.0.1 -p 55432` → `connectivity OK`     | ✅     |
| Android SDK platforms      | `android-35`, `android-37.0`                         | ✅     |
| `adb`                      | `1.0.41`, resolves on PATH                           | ✅     |
| AVD                        | `vyora_api35` exists                                 | ✅     |
| Android emulator **boots** | requires AEHD — see §4.2                             | ❌     |

## 3. Current commands

**API** — from `vyora-api/`

```bash
npm run db:migrate      # apply migrations
npm run db:seed         # two synthetic workspaces
npm run type-check
npm run contract:lint   # redocly lint openapi/openapi.yaml
npm test                # vitest against a real database
npm run validate        # type-check + contract:lint + test
npm start               # http://127.0.0.1:4000
```

**Web** — from the repository root

```bash
npm run type-check
npm run lint
npm run test:run
npm run build
npm run validate        # all of the above plus format:check
```

**Local PostgreSQL**

```bash
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" \
  -o "-p 55432 -h 127.0.0.1" -l "C:\Users\dell\pgsql16\server.log" -w start
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" -w stop
```

**CI** — `CI` (web, every push/PR) · `API CI` (path-filtered to `vyora-api/**`,
Node 24 + PostgreSQL 16 service) · `Deploy Production` (release or manual only,
gated behind required reviewers).

## 4. Blockers — recorded, none of which delay local ledger work

### 4.1 Docker Desktop — **optional**

Installed (4.85.0) but its engine will not start: _"virtualisation support wasn't
detected"_, corroborated by `HypervisorPresent: False`.

**Gates:** nothing. PostgreSQL runs from native binaries and every API test,
migration and end-to-end run has used it. Docker would only offer parity with a
container-based setup.

### 4.2 Android emulator acceleration — **mobile-only**

The AVD `vyora_api35` exists and is correctly configured, but will not boot:

```
ERROR | x86_64 emulation currently requires hardware acceleration!
sc query aehd → service not installed
```

The AEHD package is already downloaded to
`%ANDROID_HOME%\extras\google\Android_Emulator_Hypervisor_Driver\`; registering
it needs an elevated shell and a reboot. VT-x is enabled in firmware, so no BIOS
change is required.

**Gates:** React Native / Expo work only. Nothing web, API or database.

### 4.3 Vercel production secrets — **release-only**

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are absent (repo secrets:
`0`), so `Deploy Production` cannot authenticate.

**Gates:** production releases only. This is the deliberate state left by
INFRA-004: production is currently _undeployable_, which is the safe side to
fail on while the approval gate settles.

### 4.4 Real authentication / cloud hosting — **Phase E**

Bearer tokens are rows in a table; there is no identity provider and no deployed
API.

**Gates:** Phase E. Local development uses the fixture identity, which is
server-side only and refuses to run under `NODE_ENV=production`.

### 4.5 Known local-environment defect — `format:check` on Windows

`npm run format:check` fails for ~62 files nobody has edited.

```
core.autocrlf = true          → Git rewrites LF→CRLF on checkout
committed blobs               → pure LF (correct in the repository)
Windows working tree          → CRLF
a flagged file diffs as       → 1,100c1,100 with identical text
GitHub Linux CI               → passes
```

The repository has **no `.gitattributes`**, so nothing normalises line endings.
Reformatting would write CRLF into commits and make the repository worse, so
`type-check`, `lint`, `test:run` and `build` are run individually on Windows
instead. **Linux CI is the authoritative formatting verdict.**

Pre-existing, one line to fix, and worth its own small milestone.

## 5. Verdict

| Track                  | Status                     |
| ---------------------- | -------------------------- |
| Web development        | ✅ unblocked               |
| API development        | ✅ unblocked               |
| Database / migrations  | ✅ unblocked               |
| Contract (OpenAPI 3.1) | ✅ unblocked               |
| Browser end-to-end     | ✅ unblocked               |
| CI                     | ✅ unblocked               |
| **Ledger slice**       | ✅ **unblocked — proceed** |
| Mobile (React Native)  | ❌ blocked on §4.2         |
| Production release     | ❌ blocked on §4.3         |

# Vyora — Project Context and Handoff

> **This document is the source of truth for future sessions.** It is written to
> be read cold, by someone (or some agent) with no memory of how any of this came
> to be. Do not rely on chat history; rely on this file and the repository
> evidence it points at.
>
> Last updated: 2026-08-09, at the end of VYORA-PLATFORM-015 and immediately
> before the ARCH-003 repository extraction.

---

## 1. What Vyora is

A local-first credit-ledger app (_udhaar_ / _bahi khata_) for Indian merchants.
A shopkeeper records what was given on credit and what was paid back, and can
settle an argument at the counter by showing a statement.

Two properties drive nearly every design decision in this codebase:

- **The device is the record, not a cache.** A merchant with no signal must be
  able to record and read their ledger. The server is somewhere copies are
  delivered to.
- **No balance is ever stored.** Balances are folded from entries at read time,
  on every layer — device, server, and screen. A stored balance is a second
  source of truth and drifts the instant a late offline event arrives, which
  offline-first makes routine rather than exceptional.

---

## 2. Repository map

Four repositories, each with one job. **This is the intended end state after
ARCH-003; see §9 for what was true before it.**

| Repository                  | Role                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `EasyTechLabs/esytol`       | **Canonical current Vyora web repository.** Multi-product Next.js app; Vyora's web pages live inside it. |
| `EasyTechLabs/vyora-api`    | **Dedicated backend repository.** Fastify + PostgreSQL + the OpenAPI contract.                           |
| `EasyTechLabs/vyora-mobile` | **Dedicated React Native repository.** Expo app, SQLite, outbox.                                         |
| `EasyTechLabs/vyora`        | **Knowledge base / product planning.** Not an engineering repository.                                    |

URLs:

- https://github.com/EasyTechLabs/esytol
- https://github.com/EasyTechLabs/vyora-api
- https://github.com/EasyTechLabs/vyora-mobile
- https://github.com/EasyTechLabs/vyora

**The web app must consume the API through a versioned generated client/types
artifact** — never source imports, npm workspaces, git submodules, or a copied
API implementation. That rule exists because the alternative reintroduces the
coupling this extraction is removing.

---

## 3. What currently exists

### Web (in `esytol`)

Vyora's merchant screens: dashboard, parties, party statement, credit entry,
payment entry, closing, recovery, settings. All local-first against an
event log in `localStorage` (`vyora.events.v2`), replayed into a projection.

On top of that, a **development-only** remote path: server-side proxy routes
under `/api/vyora-dev/*` that forward to a local API. Party reads, Party
writes, ledger statement, ledger credit, ledger payment, ledger summary.

### API (`vyora-api/`)

Fastify 5 modular monolith. OpenAPI 3.1 is the runtime validator — the document
is parsed at boot and its schemas handed to Ajv 2020, so the contract and the
server cannot disagree.

**Twelve operations:**

```
GET   /api/v1/health
GET   /api/v1/me
GET   /api/v1/parties
POST  /api/v1/parties
GET   /api/v1/parties/{partyId}
PATCH /api/v1/parties/{partyId}
POST  /api/v1/parties/{partyId}/credits
POST  /api/v1/parties/{partyId}/payments
GET   /api/v1/parties/{partyId}/statement
GET   /api/v1/parties/{partyId}/summary
POST  /api/v1/sync/push      ← declared, INERT
GET   /api/v1/sync/pull      ← declared, INERT
```

PostgreSQL 16, event-sourced: an append-only `events` table plus rebuildable
projections (`party_projection`, `entry_projection`). Two migrations.

### Mobile (`vyora-mobile/`)

Expo SDK 57 / React Native 0.86.2 / TypeScript. SQLite ledger, durable outbox,
sync engine, six screens. API types **generated** from the OpenAPI contract with
a drift test. An `arm64-v8a` debug APK has been built and its contents verified.

---

## 4. Safety posture — read this before changing anything

- **All API/web remote flags default to `false`** in committed configuration and
  are **development-only**:

  ```
  NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=false
  NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=false
  NEXT_PUBLIC_VYORA_API_LEDGER_READS_ENABLED=false
  NEXT_PUBLIC_VYORA_API_LEDGER_WRITES_ENABLED=false
  ```

  The gates are layered so each calls the one below it — ledger reads require
  Party reads; ledger writes require ledger reads _and_ Party writes. A gate can
  therefore only ever narrow.

- **Production refuses the remote path structurally.** `NODE_ENV === "production"`
  is checked inside the base gate every other gate delegates to. Verified
  empirically: with all four flags forced `true` in a production build, every
  `/api/vyora-dev/*` route returns `404` — not `403`, because a 403 confirms the
  endpoint exists.

- **There is no real merchant data anywhere in this work.** Every party and entry
  used in development came from `vyora-api/src/seed/seed.ts` or was typed into a
  throwaway browser profile / synthetic SQLite database.

- **No cloud sync.** `/api/v1/sync/*` is declared in the contract and inert.
- **No real login.** Authentication is a development-only `X-Vyora-Dev-Identity`
  header scheme that the server refuses unless started with `VYORA_DEV_AUTH=true`,
  which it refuses under `NODE_ENV=production`.
- **No API deployment.** The API has never run anywhere but loopback.
- **The development identity is never in a client bundle.** `VYORA_API_DEV_IDENTITY`
  has no `NEXT_PUBLIC_` prefix on the web; on mobile it is typed in at runtime and
  never compiled into the binary.

- **Production is protected on `main`. Development happens on `develop`.**
  `main` has branch protection and a `Deploy Production` workflow behind a
  GitHub Environment approval gate. Do not push to `main` directly.

---

## 5. Completed platform milestones

| Milestone                      | What it delivered                                        |
| ------------------------------ | -------------------------------------------------------- |
| VYORA-PLATFORM-002             | Environment validation, architecture docs, ADR-0001/0002 |
| VYORA-PLATFORM-003             | OpenAPI 3.1 contract design — eight approved operations  |
| VYORA-PLATFORM-004             | Synthetic API implementation, contract verification      |
| VYORA-PLATFORM-005             | API CI workflow + read-only web integration              |
| VYORA-PLATFORM-005.1           | API CI runtime corrected to Node 24 LTS                  |
| VYORA-PLATFORM-006 / .1 / .2   | Published for CI; fixed the defects CI found             |
| VYORA-PLATFORM-007             | Local end-to-end browser verification                    |
| VYORA-PLATFORM-008 / 009       | Platform foundation PR opened and merged to `develop`    |
| VYORA-PLATFORM-009.1           | Production release safety audit (read-only)              |
| INFRA-003 / INFRA-004          | Restored and activated production release controls       |
| VYORA-PLATFORM-010 / 011 / 012 | Development-only Party writes; PR; merge                 |
| ARCH-001                       | Repository boundary audit of `vyora` vs `esytol`         |
| VYORA-PLATFORM-013             | Ledger vertical slice — credits + statement              |
| VYORA-PLATFORM-014             | Ledger credit review PR (#4) — all CI green              |
| VYORA-PLATFORM-015             | Payments, ledger summary, and the React Native app       |

### Commit SHAs — `esytol` `develop` at handoff

`develop` HEAD: **`8939e6a`**

```
8939e6a docs(platform): complete the validation record for VYORA-PLATFORM-015
36e44c3 docs(platform): record the single-ABI decision for the debug APK
ca5b774 docs(platform): start the accelerated development report
c3fb477 fix(mobile): deliver the outbox in strict order, never skipping a backoff
fd3feec feat(mobile): offline-first Vyora app in an isolated vyora-mobile/
440e38e feat(web): development-only payment recording and ledger summary
563de1d feat(api): record payments and summarise a party ledger
74c5ecf merge: ledger credit slice into develop (VYORA-PLATFORM-015)
03752e2 docs(platform): record the ledger mapping and its validation
bacbaea test: verify the ledger credit slice end to end
57af0a0 feat(web): add development-only ledger credit and statement
74b53cb feat(api): add ledger credit and statement endpoints
824ac89 docs(platform): record verified development prerequisites
```

Earlier history: `3fe6abf` (PR #3, Party writes), `bab1584` (PR #1),
`c815467`, `3bb2ee9` (Vyora Alpha v0.1).
`main` HEAD: **`0754d47`** (PR #2, production release guard restored).

**PR #4 was merged on GitHub** by `easytech28` at 10:25 IST on 2026-08-09
(`bc6523d`), independently of the local merge of the same branch at `74c5ecf`.
The two histories were reconciled by a merge, not a rebase, so every SHA listed
above is still valid — which is the point of listing them here at all.

Commits after `74c5ecf` were made locally on `develop` under the accelerated
working mode authorised in VYORA-PLATFORM-015 (no PR, no review wait).

### Test results at handoff

| Suite                         | Result                                                    |
| ----------------------------- | --------------------------------------------------------- |
| API                           | 8 files / **121 tests** passed                            |
| API contract lint             | 0 errors, 0 warnings; bundle resolves every `$ref`        |
| Web                           | 130 files / **2490 tests** passed, 0 failures             |
| Web production build          | compiled 102s, 142/142 pages, exit 0                      |
| Mobile                        | **27 tests** passed against real SQLite via `node:sqlite` |
| Mobile contract drift         | generated types match the contract                        |
| E2E web → API → PostgreSQL    | **20/20 checks**                                          |
| E2E mobile → API → PostgreSQL | **3/3 cases**                                             |
| Android debug APK             | BUILD SUCCESSFUL, 56.2 MB, `arm64-v8a`                    |

---

## 6. Unresolved decisions

Carried forward deliberately. None of these are oversights.

1. **Entry deletion.** No `DELETE` exists anywhere in the contract.
   Delete-versus-concurrent-entry has no safe automatic answer: a device that
   deletes an entry while another device edits it needs a rule nobody has chosen
   yet. See `openapi-design.md` §6, deferred decision 1.
2. **Sync activation.** `/api/v1/sync/push` and `/pull` are declared and inert.
   Turning them on requires a conflict policy and a retention decision.
3. **Real authentication.** The bearer scheme is specified; only the development
   identity scheme is implemented.
4. **Pilot data migration.** No mechanism exists to move an existing merchant's
   `localStorage` ledger into the API, and none should be built without an
   explicit, separately-approved instruction.
5. **`.gitattributes` / line endings.** `esytol` has no `.gitattributes`, so
   Windows checkouts rewrite LF→CRLF and `npm run format:check` fails locally on
   files nobody edited. Linux CI is authoritative. Fixing it renormalises the
   whole repository and belongs in its own change.
6. **Mobile release signing.** No keystore, no release build configuration. Only
   debug APKs have been produced.
7. **Web ↔ API client artifact.** The versioning and publication mechanism for
   the generated client the web app must consume is specified in principle
   (§2) but not yet built.

---

## 7. Hardware and environment blockers

| Blocker                                                     | Nature                                          | What it actually blocks                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Android Emulator Hypervisor Driver (AEHD)** not installed | needs an elevated install and a Windows restart | Emulator/on-device UI verification only. All mobile logic is verified against the live API without it.                         |
| **Docker Desktop** unusable                                 | CPU virtualisation unavailable                  | Nothing. PostgreSQL 16.14 runs as native portable binaries.                                                                    |
| **No Mac**                                                  | —                                               | iOS project generation and any iOS binary. Expo SDK 57 refuses to template `ios/` on Windows. iOS _configuration_ is complete. |
| **Vercel production secrets**                               | repo secrets: 0                                 | Production release only.                                                                                                       |
| **Windows `format:check`**                                  | CRLF vs LF, no `.gitattributes`                 | Nothing. Linux CI passes.                                                                                                      |
| **Two CPU cores**                                           | —                                               | Nothing, but it makes four-ABI React Native builds impractical; the debug APK is `arm64-v8a` only.                             |

---

## 8. Recovery instructions — recreating the local environment

Everything below is loopback-only and uses synthetic data. None of it touches
production or real merchant data.

### 8.1 Prerequisites

| Component      | Version used                      | Location                                                   |
| -------------- | --------------------------------- | ---------------------------------------------------------- |
| Node.js        | 24.19.0                           | `C:\Program Files\nodejs`                                  |
| Git            | 2.52                              | `C:\Program Files\Git\cmd`                                 |
| PostgreSQL     | 16.14 portable                    | `C:\Users\dell\pgsql16`, data dir `pgdata`, port **55432** |
| JDK            | Temurin 21                        | `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot`  |
| Android SDK    | platform 35/37, build-tools 35/36 | `C:\Users\dell\AppData\Local\Android\Sdk`                  |
| Android Studio | installed                         | `C:\Program Files\Android\Android Studio`                  |

There is **no `gh` CLI** on this machine. GitHub API work goes through the token
that Git Credential Manager already holds for `origin`; never print it.

### 8.2 Start PostgreSQL

```bash
# Must use -w; a detached start without it silently does nothing.
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" \
  -l "C:\Users\dell\pgsql16\server.log" -o "-p 55432" -w -t 60 start
"C:\Users\dell\pgsql16\bin\pg_isready.exe" -h 127.0.0.1 -p 55432
```

### 8.3 Run the API

The API does **not** auto-load `.env`. Export the variables explicitly:

```bash
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:55432/vyora"
export VYORA_DEV_AUTH=true
export SYNC_CURSOR_SECRET="local-development-only-not-a-secret"
export NODE_ENV=development PORT=4000 HOST=127.0.0.1

cd vyora-api
npm ci
npm run db:migrate
npm run db:seed      # seeds workspaces `alpha` and `beta`
npm run dev          # http://127.0.0.1:4000
```

Validation gates:

```bash
npm run type-check
npm run contract:lint
npm run contract:bundle
npm test             # needs PostgreSQL running
```

### 8.4 Run the web app against it

```bash
export NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true
export NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=true
export NEXT_PUBLIC_VYORA_API_LEDGER_READS_ENABLED=true
export NEXT_PUBLIC_VYORA_API_LEDGER_WRITES_ENABLED=true
export NEXT_PUBLIC_VYORA_API_URL=http://127.0.0.1:4000
export VYORA_API_DEV_IDENTITY=alpha     # NEVER prefix this NEXT_PUBLIC_
export NODE_ENV=development

npm ci
npx next dev -p 3000
```

Set these **only in the shell**, never in a committed file. Use a fresh browser
profile: Vyora registers a service worker, and a stale one serves an old bundle
after a flag change, which looks exactly like the flag not working.

### 8.5 Run the mobile app

```bash
cd vyora-mobile
npm ci
npm run api:types:check    # fails if generated types drift from the contract
npm run type-check
npm test
```

Build the Android debug APK:

```bash
export JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
export ANDROID_HOME="C:\Users\dell\AppData\Local\Android\Sdk"
npx expo prebuild --platform android --no-install

# local.properties MUST use forward slashes. A Java properties file reads
# backslashes as escapes, and a malformed sdk.dir fails with
# "IOException: The filename, directory name, or volume label syntax is
# incorrect" — which names the filesystem and says nothing about escaping.
echo 'sdk.dir=C:/Users/dell/AppData/Local/Android/Sdk' > android/local.properties

cd android
./gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a
# → app/build/outputs/apk/debug/app-debug.apk
```

Live end-to-end against a running API:

```bash
VYORA_E2E_API=http://127.0.0.1:4000 VYORA_E2E_IDENTITY=alpha npx jest live-api
```

### 8.6 Teardown

Stop the API, the dev server and Gradle; delete `.next` if it was built with
flags forced on; re-seed the synthetic database; stop PostgreSQL:

```bash
"C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" -m fast stop
```

---

## 9. Traps that have already cost time

Recorded so nobody pays for them twice.

- **`pg` parses `date` columns into `Date` objects.** A business date is a
  calendar day in the merchant's timezone, not an instant. Fixed with an OID
  1082 type parser in `db/pool.ts`. Do not remove it.
- **`import.meta.url === "file://" + argv[1]` never matches on Windows.** Two
  migration scripts exited 0 having done nothing. Use `pathToFileURL`.
- **jsonb key order.** Comparing serialised JSON marked genuine duplicates as
  conflicts. Compare `payload = $1::jsonb` in SQL instead.
- **`clock_timestamp()` microseconds vs millisecond ISO-8601** re-served the last
  event of every page. `recorded_at` is `timestamptz(3)`.
- **Vyora's service worker** serves a stale bundle after a flag change. Use a
  brand-new browser profile.
- **`jest-expo` replaces `fetch`** with an XHR polyfill that never reaches the
  network and returns an undefined status. Live tests supply a `node:http`
  transport.
- **An unordered `SELECT` on `outbox`** returns index order, not insertion order.
- **The parent toolchain will swallow a sibling project.** Root `tsconfig`,
  `vitest`, `eslint` and `prettier` all needed explicit exclusions.

---

## 10. Where to read more

| Topic                  | Document                                          |
| ---------------------- | ------------------------------------------------- |
| Architecture decisions | `docs/platform/adr/0001`–`0004`                   |
| Contract design        | `docs/platform/openapi-design.md`                 |
| Auth and tenancy       | `docs/platform/auth-and-tenant-model.md`          |
| Sync protocol (inert)  | `docs/platform/sync-protocol.md`                  |
| Ledger mapping         | `docs/platform/ledger-api-contract.md`            |
| Latest full status     | `docs/platform/accelerated-development-report.md` |
| Prerequisites          | `docs/platform/development-prerequisites.md`      |
| Extraction record      | `docs/platform/repository-extraction-record.md`   |

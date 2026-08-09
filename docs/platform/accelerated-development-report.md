# Accelerated Local Platform and Mobile Development

> VYORA-PLATFORM-015. Running record, updated as work lands.
> Local development only. Nothing pushed, nothing deployed, no real merchant data.

---

## 0. Working mode

From this milestone, development proceeds directly on local `develop` with
incremental commits. No PRs, no review waits, no approval gates between
milestones. `main` production protection is unchanged; the approved Vercel demo
is untouched and remains the visual reference, not the API runtime.

The already-green ledger-credit branch (PR #4 — web CI, API CI and Vercel
Preview all passed) was merged locally at `74c5ecf`. It was never merged on
GitHub; the remote PR remains open.

---

## 1. What exists now

```
Vyora web pages in Esytol ─┐
                           ├─► Vyora API (vyora-api/) ─► native local PostgreSQL 16
Vyora mobile (vyora-mobile/)┘        Fastify 5, OpenAPI 3.1 as runtime validator
```

Three deployable units, three lockfiles, no monorepo. The root `tsconfig`,
`vitest`, `eslint` and `prettier` now exclude both `vyora-api/` and
`vyora-mobile/`, so no toolchain reaches into a sibling it does not own.

### API surface — twelve operations

|                                                               |                                   |
| ------------------------------------------------------------- | --------------------------------- |
| `GET /api/v1/health` · `GET /api/v1/me`                       | liveness, identity                |
| `GET/POST /api/v1/parties` · `GET/PATCH /api/v1/parties/{id}` | parties                           |
| `POST …/{id}/credits`                                         | record a credit                   |
| `POST …/{id}/payments`                                        | **new** — record a payment        |
| `GET …/{id}/statement`                                        | rows + folded balance             |
| `GET …/{id}/summary`                                          | **new** — totals without the rows |
| `POST /api/v1/sync/push` · `GET /api/v1/sync/pull`            | declared, inert                   |

Payments mint the existing `PaymentRecorded` event from log format v2 through
`appendAndApply`, the one server-side application path. No new event type, no
new payload shape.

---

## 2. Decisions worth keeping

**A payment settles nothing in particular.** It moves the party's net position.
Real udhaar is not invoice-matched — a merchant takes ₹500 against a running
tab, not against the entry from the 14th. Allocating payments to entries would
record a relationship the merchant never asserted, and that link would then be
wrong the moment an older entry arrived late from another device.
`RecordPaymentRequest` has no `appliesTo`, and a contract test asserts it never
grows one.

**Over-payment is accepted and inverts the position.** Refusing it would make
the ledger disagree with what physically happened at the counter.

**The summary cannot disagree with the statement.** Both fold the same rows
through the same `signedAmount` in the same order. A test asserts they match.
The summary takes no `limit` — a total over the first 50 entries is not a total.

**The web summary does not fall back to local.** The statement falls back
because a stale history is still a history. A summary that fell back would put
device totals and server totals under one heading with nothing on screen to say
which the merchant was reading. Absent is honest; substituted is not.

**Gross totals sit beside the one signed net.** "You have given ₹40,000 and been
paid ₹38,500" is a different fact from "₹1,500 outstanding", and a merchant
chasing a debt needs both.

---

## 3. Two defects found, both fixed

### 3.1 The contract contradicted itself about idempotent replay

The OpenAPI document documented `200` for an idempotent replay while describing
it as _"the original result is returned unchanged"_. Those cannot both hold —
you cannot return a response unchanged and rewrite its status. The server was
replaying the stored `201`.

The prose was right. A retry that is distinguishable from the original is not
idempotent: a client whose connection dropped mid-write cannot tell whether it
or its retry did the work, and must not have to. The contract now documents
verbatim replay on the `201` for parties, credits and payments, and the credit
test pins the status it previously left unasserted.

### 3.2 The mobile outbox skipped a backoff and broke delivery order

**Found by the live end-to-end run against the real API, not by reasoning.**

The drain selected only rows whose backoff had elapsed. So one dropped
connection deferred a party by five seconds, the next drain stepped over it, and
the credit queued behind it went first. The server refused that credit with a
`404` because the party did not exist there yet; the client correctly classified
`404` as permanent; and a perfectly good entry was parked as "needs attention"
with nothing wrong with it. On a real phone that is a merchant seeing an entry
flagged as refused because their signal dropped for a moment.

Ordering in a delivery log is a correctness requirement, not an optimisation.
`due()` is replaced by `pending()`, which returns rows in insertion order
_including ones not yet due_, and the engine stops at the first row that is not
due rather than stepping over it. Blocked rows are already out of `pending`, so
a genuinely refused row does not stall the queue behind it.

---

## 4. Mobile: `vyora-mobile/`

Expo SDK 57, React Native 0.86.2, React 19.2.3, TypeScript 6. Own
`package.json`, own `package-lock.json`, no workspace conversion.

```
src/api        config gate, classified client, GENERATED contract types
src/database   schema, migrations, driver port, ledger reads/writes
src/sync       durable outbox, drain engine
src/features   what a merchant's action actually does
src/navigation single stack
src/screens    setup, party list, party detail, record credit, record payment, sync
src/components shared pieces
src/theme      palette, money formatting, balance colours
src/store      provider, development settings
```

### The one claim the design defends

**A merchant's entry is never lost because the network was not there.**

Recording an entry writes the SQLite row and queues its delivery in **one
transaction**. That is not the dual write the web app forbids. On the web a
remote write goes to the API _instead of_ local storage, because the two stores
have no reconciliation and writing both would leave two records of one action
with no way to tell which is real. Here there is exactly one record — the SQLite
row — and the outbox holds a _delivery instruction_ referencing it. Dropping the
entire outbox would lose no merchant data; it would only mean the server never
hears about it.

### Things that would be easy to get wrong

- **The idempotency key is minted once and reused for every attempt**, including
  "try again" on a blocked row. A fresh key per retry is how one action becomes
  two entries on the server.
- **Failures are classified three ways** — `ok`, `retry`, `permanent` — because
  "it failed" cannot decide anything. `409` is permanent on purpose: it means
  this entry id exists with different content, and the app must never "fix" that
  by minting a new id and recording the action twice.
- **Unsent entries appear in the statement.** A merchant who took ₹500 with no
  signal must be able to see the ₹500 they just took.
- **The device fold mirrors the server's** — same sign convention, same
  `(created_at, id)` tiebreak. Two folds would disagree the moment a detail
  differed, and the merchant would have no way to know which screen was lying.
- **API types are generated** from `vyora-api/openapi/openapi.yaml`, and a test
  re-runs the generator and fails on drift. A hand-written copy goes stale
  silently: the server adds a required field, the app still compiles, and the
  mismatch surfaces as a rejected write on a phone instead of a red build.
- **Android defaults to `10.0.2.2`, not `127.0.0.1`.** Inside an emulator,
  loopback is the emulator; the resulting timeout is indistinguishable from the
  server being down, which sends people debugging the wrong thing.
- **Configuration is entered at runtime, never compiled in.** A string baked
  into the bundle ships with the bundle.

---

## 5. Validation

| Suite                 | Result                                               |
| --------------------- | ---------------------------------------------------- |
| API migrations        | `001_init`, `002_entry_statement_fields` applied     |
| API contract lint     | 0 errors, 0 warnings; bundle resolves every `$ref`   |
| API type-check        | clean                                                |
| API tests             | **8 files / 121 tests passed** (was 98)              |
| Web type-check · lint | clean                                                |
| Web Vyora tests       | **26 files / 542 tests passed**                      |
| Mobile type-check     | clean                                                |
| Mobile tests          | **27 passed**, against real SQLite via `node:sqlite` |
| Mobile contract drift | `contract.generated.ts` matches the contract         |
| Expo config           | resolves; iOS and Android sections verified          |

Mobile tests drive the app's real SQL through the same `SqlDatabase` port the
app uses, so the actual CHECK constraints, indexes and `ORDER BY` are exercised
— not a fake that would let a typo pass every test and fail on a phone.

### Local end-to-end — web → Next route → API → PostgreSQL

20 checks, all passed. Every request went to the app's own origin on `:3000`,
exactly as a browser would; nothing addressed `:4000` and nothing sent the
development identity.

```
statement and summary agree                      1500 == 1500
payment through the proxy accepted               201, entryType=payment
business date survives as a calendar day         2026-08-09
exactly one PaymentRecorded event in PostgreSQL  note preserved
projection row carries its event id              evt_64eeea8e…
net moved by exactly the payment                 1500 -> 800
paymentReceived total grew by 700                0 -> 700
last runningNet equals the net                   800 == 800
credit then moves both together                  800 -> 3300
idempotent replay returns 201 verbatim           still exactly one event
no identity header on any proxy response         confirmed
cross-tenant summary                             404, not 403
```

### Local end-to-end — mobile → API → PostgreSQL

3 cases, all passed, running the app's own repository, outbox, sync engine and
generated client against the live local API.

```
records offline, then delivers on reconnect   3 sent, 0 blocked
  device net 1250 == server net 1250
  statements agree row for row, same order and same runningNet
a second drain sends nothing, duplicates nothing
API disappears mid-session                    ledger byte-identical, queue intact
  immediate retry correctly waits out the backoff
  after the backoff both rows go, party first, original keys
```

What this does **not** cover is React Native's UI layer, which needs a working
emulator. The screens are thin wrappers over exactly these calls.

---

## 6. Blockers

| Blocker                              | Nature                                            | Blocks                                     |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------ |
| Android emulator acceleration (AEHD) | elevated install + reboot                         | on-device/emulator UI verification only    |
| Docker Desktop                       | CPU virtualisation unavailable                    | nothing — PostgreSQL runs natively         |
| Vercel production secrets            | repo secrets: 0                                   | release only                               |
| `format:check` on Windows            | `core.autocrlf` vs LF blobs, no `.gitattributes`  | nothing — Linux CI is authoritative        |
| iOS native project                   | Expo SDK 57 refuses to generate `ios/` on Windows | an iOS build, which needs a Mac regardless |

### The debug APK is `arm64-v8a` only — a deliberate narrowing

`gradle.properties` targets four ABIs (`armeabi-v7a, arm64-v8a, x86, x86_64`).
React Native 0.86 has the New Architecture enabled, so each ABI means a full
C++ codegen compile; on this two-core machine all four is hours of work for a
debug artefact.

The APK is therefore built with `-PreactNativeArchitectures=arm64-v8a`, which is
what every current physical Android device runs. Nothing in the app is
architecture-specific — the restriction is a build flag, and removing it
produces the universal APK with no source change.

`x86_64` would be needed for the emulator, which is separately blocked on
hardware acceleration. There is no point paying for an ABI that cannot be run.

### iOS readiness

The iOS **configuration** is complete and verified to resolve:

```
bundleIdentifier   in.esytol.vyora
buildNumber        1
supportsTablet     true
infoPlist          NSAppTransportSecurity.NSAllowsLocalNetworking = true
```

Expo SDK 57 declines to template `ios/` on Windows — it prints _"Run npx expo
prebuild again from macOS or Linux"_ — so no iOS project directory exists and
**no iOS binary was built.** Under Expo's continuous native generation the
native directories are generated artefacts, not sources; `app.json` is the
configuration of record. On a Mac, `npx expo prebuild --platform ios && npx expo
run:ios` produces the project and the build from exactly what is committed here.

---

## 7. Safety

- Nothing pushed, no PR opened, nothing merged on GitHub, nothing deployed.
- No secret added, no Vercel setting changed, no `main` protection touched.
- Every party and entry used came from `seed.ts` or was typed into a synthetic
  local store. No real merchant or pilot data was read, migrated or modified.
- API and database were loopback-only throughout (`127.0.0.1:4000`,
  `127.0.0.1:55432`).
- All web API flags remain `false` in committed configuration; they were set
  only inside a temporary `next dev` process.
- The development identity has no `NEXT_PUBLIC_` prefix on the web and is
  entered at runtime on mobile. Neither is compiled into a shippable artefact.
- Cleartext HTTP on Android is permitted **only** by the debug manifest that
  React Native generates; the release manifest carries no such allowance.

# Ledger Credit Slice — Validation Report

> VYORA-PLATFORM-013, run 2026-08-09 on the founder's Windows 10 machine.
> Development-only, localhost-only, synthetic data only.
> Mapping: `ledger-api-contract.md` · Prerequisites: `development-prerequisites.md`.

---

## 0. Result

**PASS** — 38 new web tests, 98 API tests, and 7 browser cases.

Nothing was pushed, no PR opened, nothing merged or deployed. No secret added,
no Vercel setting changed, no real merchant data touched.

## 1. Environment

| Component  | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| PostgreSQL | 16.14, `127.0.0.1:55432`, dropped and recreated for this run  |
| API        | `vyora-api` on `http://127.0.0.1:4000`                        |
| Web        | `next dev` on `http://127.0.0.1:3000`                         |
| Browser    | Edge 150 headless, **throwaway profiles**, deleted afterwards |
| Branch     | `feat/ledger-credit-slice`, from `develop`                    |

All four flags set **only** in the temporary `next dev` process:

```
NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true
NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=true
NEXT_PUBLIC_VYORA_API_LEDGER_READS_ENABLED=true
NEXT_PUBLIC_VYORA_API_LEDGER_WRITES_ENABLED=true
VYORA_API_DEV_IDENTITY=<redacted — synthetic fixture identity>
```

Committed defaults, all four `false`:

```
.env.example:63  NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=false
.env.example:75  NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=false
.env.example:82  NEXT_PUBLIC_VYORA_API_LEDGER_READS_ENABLED=false
.env.example:83  NEXT_PUBLIC_VYORA_API_LEDGER_WRITES_ENABLED=false
```

## 2. Automated tests

**Web — 38 new**

| File                     | Tests | Covers                                                               |
| ------------------------ | ----: | -------------------------------------------------------------------- |
| `ledger-gate.test.ts`    |    21 | flag defaults, the four-gate stack, production refusal               |
| `ledger-credit.test.tsx` |    17 | statement source, no dual write, no fallback, credential containment |

**API — 98 total (up from 80)**, including a new `ledger.test.ts` covering
immutable events, duplicate handling, projection folding, direction signing and
cross-tenant statement isolation.

Against the milestone's required list:

| Required proof                            | Where                                                          |
| ----------------------------------------- | -------------------------------------------------------------- |
| Local default credit flow                 | `ledger-credit` — local statement, `fetch` never called        |
| Remote credit event acceptance            | `ledger.test.ts` — `CreditRecorded` event asserted in `events` |
| Remote statement row and balance          | `ledger.test.ts` folding test + browser §3                     |
| Browser credential containment            | `ledger-credit` source scan + browser §3                       |
| API unavailable: no local/server write    | `ledger-credit` (2) + browser case 5                           |
| Retry after restore                       | browser case 6                                                 |
| Production refusal with flags forced true | `ledger-gate` (3)                                              |
| Cross-tenant statement isolation          | `ledger.test.ts` (4)                                           |
| Immutable event / duplicate handling      | `ledger.test.ts` (2)                                           |

## 3. Browser evidence — 7 cases

The throwaway profile held one local-only party (`LEDGER LOCAL ONLY`, ₹777) so
which source produced a balance was never ambiguous.

**Case 1 — remote statement renders · PASS**

```
header       : alpha party 1 · They owe you · ₹1,500     ← from the API
local log    : contains only LEDGER LOCAL ONLY at 777
statementReq : GET /api/vyora-dev/parties/pty_aaaaaaa1-…/statement?limit=200
directApi    : []            ← browser never touched :4000
identity hdr : absent from every request
```

**Case 2 — record a credit through the UI · PASS**

```
before : They owe you ₹1,500
after  : They owe you ₹4,800          ← 1,500 + 3,300
POST   : /api/vyora-dev/parties/pty_aaaaaaa1-…/credits
logUnchanged: true
```

**Case 3 — it became an immutable event · PASS**

```
events           : CreditRecorded | aggregate pty_aaaaaaa1-… | amount 3300 | given
entry_projection : txn_f4e269d5-… | given | 3300 | event_id present
```

**Case 4 — local storage untouched · PASS** — byte-identical before and after.

**Case 5 — API stopped, write fails safely · PASS**

```
header before : LEDGER LOCAL ONLY · ₹777
header after  : LEDGER LOCAL ONLY · ₹777      ← unchanged
logUnchanged  : true
error         : "Write failed. Nothing was saved. DEPENDENCY_UNAVAILABLE …
                 Nothing was written locally either — this entry went nowhere."
```

After restarting the API, the database contained exactly **one** entry at that
amount — the earlier successful one. The failed write left nothing anywhere.

**Case 6 — retry after restore · PASS**

```
before: ₹4,800   after: ₹8,100   logUnchanged: true   error: null
```

**Case 7 — flags absent · PASS** _(fresh profile, `.next` cleared)_

```
header       : LEDGER LOCAL ONLY · ₹777     ← local statement
formPresent  : false                        ← dev credit form renders nothing
statementReq : []                           ← zero proxy requests
GET  statement -> 404   POST credits -> 404 ← server gate refuses independently
```

The server-side refusal shows the gate stack working:

> _"Ledger writes require ledger reads to be enabled first. Ledger reads require
> Party reads to be enabled first. `NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED`
> is not `"true"` (default: disabled)."_

### Credential containment

Every case: 9 scripts scanned for the identity value **and**
`x-vyora-dev-identity` → **0 hits**; page source → false; `localStorage` →
false; no browser request carried an identity header; zero requests to `:4000`.

## 4. API validation

```
migrations   : applied 001_init.sql, 002_entry_statement_fields.sql
type-check   : clean
contract lint: 0 errors, 0 warnings
contract bundle: every $ref resolved
tests        : 7 files, 98 passed
```

## 5. Two pre-existing assertions were updated, deliberately

Both pinned a surface this milestone intentionally grew. **Replaced, not
relaxed** — each still pins exactly, just to the new value, with the reason in a
comment beside it.

- `contract.test.ts` — _"declares exactly the eight approved operations"_ → ten.
  A companion assertion was added requiring the ledger paths to expose only
  `GET` and `POST`, so no delete or replace verb can appear unnoticed.
- `migrations.test.ts` — the applied-migration list now includes `002`, with a
  new assertion that `event_id` and `description` exist on `entry_projection`.

No other existing test was modified, skipped or weakened.

## 6. A real defect this slice exposed

The first statement read returned:

```
"date": "Wed Jul 01 2026 00:00:00 GMT+0530 (India Standard Time)"
```

`pg` parses `date` columns into JavaScript `Date` objects. A business date is a
calendar day in the _merchant's_ timezone, not an instant — parsing it
re-interprets it in the server's timezone and serialises a full timestamp. That
breaks the contract's `format: date`, and can shift an evening sale onto the
wrong trading day, which is the kind of error a merchant discovers only when a
day's closing total refuses to reconcile.

Fixed in `db/pool.ts` beside the existing `bigint` parser: OID 1082 returns the
string PostgreSQL already provides.

## 7. Known local-environment limitation

`npm run format:check` still fails on Windows for files nobody edited —
`core.autocrlf=true` rewrites LF→CRLF on checkout while the committed blobs are
LF, and Linux CI passes. Reformatting would write CRLF into commits, so
`type-check`, `lint`, `test:run` and `build` were run individually instead.
Documented in `development-prerequisites.md` §4.5.

## 8. Safety confirmations

- **Synthetic data only.** Every party and entry came from `seed.ts` or was
  typed into a throwaway browser profile.
- **No real merchant or pilot data** was read, migrated, uploaded or modified.
- **No dual writes.** The device log was byte-identical across every remote
  case, success and failure alike.
- **No payment, recovery, closing, deletion, sync or migration** was added.
- **Loopback only.** Browser → `127.0.0.1:3000`, server → `127.0.0.1:4000`.
- **Nothing pushed, merged or deployed;** no PR, no secrets, no Vercel change.

## 9. Teardown

API, web and browser processes stopped; all three temporary profiles deleted;
databases dropped and recreated; PostgreSQL stopped. The extra `dev_identities`
fixture row lived only in the synthetic database and went with it.

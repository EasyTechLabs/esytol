# Web Party Write — Validation Report

> VYORA-PLATFORM-010, run 2026-08-09 on the founder's Windows 10 machine.
> Development-only, localhost-only, synthetic data only.
> Design: `web-party-write-integration.md`.

---

## 0. Result

**PASS** — 47 new automated tests and 7 browser cases.

Nothing was pushed, merged, deployed, or sent to a cloud service. No secret was
added, no release control touched, no Vercel setting changed.

## 1. Environment

| Component  | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| PostgreSQL | 16.14, `127.0.0.1:55432`, database dropped and recreated for this run |
| API        | `vyora-api` on `http://127.0.0.1:4000`                                |
| Web        | `next dev` on `http://127.0.0.1:3000`                                 |
| Browser    | Edge 150 headless, **throwaway profile**, deleted afterwards          |
| Branch     | `feat/party-writes-dev`, based on `develop`                           |

Flags set **only** in the temporary `next dev` process, never in a file:

```
NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true
NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=true
NEXT_PUBLIC_VYORA_API_URL=http://127.0.0.1:4000
VYORA_API_DEV_IDENTITY=<redacted — synthetic fixture identity>
```

Committed default, verified unchanged:

```
.env.example: NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=false
.env.example: NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED=false
```

## 2. Automated tests — 47 new, all passing

| File                               | Tests | Covers                                                                                   |
| ---------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| `party-write-gate.test.ts`         |    15 | flag defaults, writes ⊆ reads, production refusal                                        |
| `party-write-adapter.test.ts`      |    19 | proxy routing, Idempotency-Key, If-Match, conflicts, credential containment, server gate |
| `party-write-integration.test.tsx` |    13 | destination selection, no dual write, no fallback                                        |

Against the milestone's required list:

| Required proof                                         | Where                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Default mode uses local Party writes                   | `party-write-integration` — local target, log changes, `fetch` never called |
| Remote write mode impossible in production             | `party-write-gate` (2) + `party-write-adapter` server gate (1)              |
| Browser never receives the development identity        | `party-write-adapter` (3) — source scan + request-header scan               |
| Remote create changes only API data, not local storage | `party-write-integration` (2)                                               |
| Remote update sends `If-Match`                         | `party-write-adapter` (1) + `party-write-integration` (1)                   |
| Stale update rejected without overwrite                | `party-write-adapter` (2) + `party-write-integration` (3)                   |
| API failure → no local write, no partial write         | `party-write-integration` (3)                                               |
| Existing Vyora tests still pass                        | §5                                                                          |

### The assertion that matters most

`no dual writes › a remote create calls the remote writer exactly once and the
device zero times` spies on `Storage.prototype.setItem` and requires **zero**
writes to `vyora.events.v2`, while the remote writer is called exactly once.

## 3. Browser evidence — 7 cases, fresh profile

The throwaway profile was seeded with one distinctive local party
(`W LOCAL BASELINE`) so which destination a write reached was never ambiguous.

**Case 1 — create through the UI · PASS**

```
rows        : E2E WRITE PARTY 7Q · alpha party 1/2/3 · Proxy Probe
writeNotice : "DEV: Party writes go to the local API. Nothing is written to
               this device while this is on. No dual writes."
logUnchanged: true          ← local log byte-identical
POST        : http://127.0.0.1:3000/api/vyora-dev/parties
request hdrs: idempotency-key, content-type, … (no identity header)
directApi   : []            ← browser never touched :4000
```

**Case 2 — it reached the API · PASS**

```
party_projection: pty_51d10d15-… | E2E WRITE PARTY 7Q | version 1
events          : ContactCreated | aggregate pty_51d10d15-… | E2E WRITE PARTY 7Q
counts          : parties 5 → 7, events 10 → 12
```

**Case 3 — local storage untouched · PASS** — `logUnchanged: true`, and the
device log still contains only `W LOCAL BASELINE`.

**Case 4 — update and ETag · PASS**

```
PATCH If-Match "1"  → 200, etag "2", name "E2E WRITE PARTY 7Q RENAMED"
PATCH If-Match "1"  → 412 VERSION_CONFLICT
                      'If-Match "1" is stale; the party is at "2".'
server after stale  : E2E WRITE PARTY 7Q RENAMED, version 2   ← NOT overwritten
```

The stale attempt tried to set the name to `SHOULD NOT WIN`. It did not.

**Case 5 — API stopped, write fails safely · PASS**

```
writeNotice : "DEV: Party API write failed. Nothing was saved.
               DEPENDENCY_UNAVAILABLE: Could not reach the local API …
               Nothing was written locally either — this write went nowhere."
logUnchanged: true
rows        : W LOCAL BASELINE      ← the attempted party never appears
```

And after restarting the API:

```
party_projection where name like 'SHOULD NEVER EXIST%' → 0
events         where payload like '%SHOULD NEVER EXIST%' → 0
```

The failed write left nothing on the device **and** nothing on the server.

**Case 6 — retry after restore · PASS**

```
writeNotice : violet "writes go to the local API" (no error)
logUnchanged: true
API         : RETRY SUCCEEDS 4K | version 1
```

**Case 7 — flags absent · PASS** _(brand-new profile, `.next` cleared)_

```
writeNotice   : null            ← renders nothing
logUnchanged  : false           ← local write happened, as it should
log contains  : DEFAULT LOCAL CREATE 3M
proxy requests: []              ← zero API/proxy calls
API contains  : 0 rows matching 'DEFAULT LOCAL CREATE%'
proxy POST    : 404 (server-side gate refuses independently)
```

> The second profile was mandatory: Vyora's service worker would otherwise have
> served the flag-enabled bundle and the case would have appeared to fail. That
> trap was documented in VYORA-PLATFORM-007 and it recurred here exactly as
> predicted.

### Credential containment

Across every case: 9 scripts scanned for the identity value **and**
`x-vyora-dev-identity` → **0 hits**; page source → false; `localStorage` →
false; and no browser write request carried an identity header.

## 4. Feature-flag proof

| Claim                                | Evidence                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Both flags default off               | `.env.example` shows `false` for both                                           |
| Only `"true"` enables                | 6 rejected values asserted per flag                                             |
| Writes ⊆ reads                       | `decidePartyWrites` calls `decidePartyApi`; 4 refusal reasons asserted for both |
| Reads on + writes off → local writes | asserted directly                                                               |
| Production ignores both              | asserted for every URL shape, plus a server-gate test                           |

## 5. Validation

**API, against a freshly created database**

```
migrations   : applied: 001_init.sql
type-check   : clean
contract lint: 0 errors, 0 warnings
tests        : 6 files, 80 passed
```

**Web** — see §7 for the final figures and the one caveat.

## 6. One pre-existing test was changed, deliberately

`tests/vyora/party-dev-proxy.test.ts` contained
`the proxy is read-only › exports no write handler on either route`, added in
VYORA-PLATFORM-005. It was correct then and is wrong now, because this milestone
adds `POST` and `PATCH` on purpose.

It was **replaced, not relaxed**. The surface is still pinned — now to
`GET`+`POST` on the collection and `GET`+`PATCH` on the item — and a second test
asserts `DELETE` and `PUT` remain absent from both routes. The change is
recorded in a comment at the assertion so the next reader sees why it moved.

No other existing test was modified, skipped or weakened.

## 7. A local-environment limitation worth knowing

`npm run format:check` fails on this machine for ~62 files that this milestone
never touched, including all of `vyora-api/`.

Diagnosed rather than assumed:

```
git config core.autocrlf     → true      (Git rewrites LF→CRLF on checkout)
committed blob line endings  → 0 CRLF, 100 LF   (correct in the repository)
working-tree line endings    → 100 CRLF, 0 LF   (a Windows checkout artifact)
diff of a flagged file       → 1,100c1,100 with identical text
CI on the same commit        → CI @ bab1584 → success
```

So the files are correct in Git and correct on Linux; only the Windows working
tree differs, and only in line endings. **Reformatting would write CRLF into the
commits and make the repository worse**, so it was not done.

`type-check`, `lint`, `test:run` and `build` were run individually instead.

Root cause: the repository has **no `.gitattributes`**, so nothing normalises
line endings. This is pre-existing and unrelated to this milestone, but it means
`npm run validate` cannot pass locally on Windows for any file that arrived via
checkout. Worth a one-line fix in a future milestone.

## 8. Safety confirmations

- **Synthetic data only.** Every party came from `src/seed/seed.ts` or was typed
  into a throwaway browser profile.
- **No real merchant or pilot data** was read, migrated, uploaded or modified.
- **No dual writes.** Asserted by test and observed in the browser: the remote
  path left the device log byte-identical in every case.
- **No sync, payments, entries, recovery, deletion or cloud auth** was
  implemented.
- **Loopback only.** The only outbound calls were browser → `127.0.0.1:3000`
  and server → `127.0.0.1:4000`.
- **Nothing pushed, merged, or deployed.** No PR opened, no secret added, no
  release control or Vercel setting touched.

## 9. Teardown

Browser, web and API processes stopped; both temporary profiles deleted;
`vyora` and `vyora_test` dropped and recreated; PostgreSQL stopped. The extra
`dev_identities` fixture row existed only in the synthetic database and went
with it.

# Local End-to-End Verification — Web ↔ API Party Reads

> VYORA-PLATFORM-007, run 2026-08-06 on the founder's Windows 10 machine.
> Development-only, localhost-only, synthetic data only.
> Design: `web-party-read-integration.md` · Unit evidence: `web-party-read-validation.md`.

---

## 0. Result

**PASS** — all seven end-to-end cases.

Nothing was pushed, merged or deployed. No cloud setting was touched. No feature
was enabled for pilot users. The committed default remains **disabled**.

## 1. Environment

| Component    | Value                                                     |
| ------------ | --------------------------------------------------------- |
| PostgreSQL   | 16.14, `127.0.0.1:55432`, local cluster (not a service)   |
| API database | `vyora` — dropped, migrated and seeded fresh for this run |
| API          | `vyora-api` on `http://127.0.0.1:4000`                    |
| Web          | `next dev` on `http://127.0.0.1:3000`, Next 15.5.22       |
| Browser      | Edge 150 headless, driven over CDP, **throwaway profile** |
| Node         | v24.19.0                                                  |

**Browser isolation.** Each browser ran with a `--user-data-dir` pointing at a
temporary directory created for this run and deleted afterwards. No existing
browser profile was opened, so no real merchant `localStorage` was readable,
let alone modified. The local ledger used in these tests was written _into the
throwaway profile_ by the harness and is entirely synthetic.

## 2. Temporary flags (secrets redacted)

Set **only** in the temporary `next dev` process — never written to a file,
never committed:

```
NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true
NEXT_PUBLIC_VYORA_API_URL=http://127.0.0.1:4000
VYORA_API_DEV_IDENTITY=<redacted — synthetic fixture identity>
```

Committed configuration was verified unchanged throughout:

```
.env.example:63:NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=false
```

No `.env`, `.env.local`, `.env.development` or `.env.development.local` exists
in the repository — confirmed during the run. The flag could only have come
from the process environment.

> The development identity used was a **distinct fixture row** added to the
> synthetic database for this run (`INSERT INTO dev_identities …`), so that the
> credential is a unique string searchable in bundles. The default `alpha`
> fixture is a poor needle — "alpha" occurs naturally in minified CSS/JS and
> would have produced false positives.

## 3. Test cases and observed results

### Case 1 — Party list loads synthetic API parties · **PASS**

```
rows   : alpha party 1  ₹1,500  They owe you
         alpha party 2  ₹1,500  They owe you
         alpha party 3  ₹500    You owe them
notice : "DEV: reading parties from the local API. Read-only. Local data is not modified."
```

The throwaway profile's local ledger contained exactly one party
(`E2E LOCAL ONLY`, ₹4,242). The screen showed **the three API parties instead**,
which is what proves the remote source was actually used rather than merely
configured.

Note the third row is `You owe them` — a supplier position round-tripping
through the API, which is the practical demonstration that role is derived from
entry direction rather than stored.

### Case 2 — Party detail header uses API identity and balance · **PASS**

```
heading     : alpha party 1
header block: alpha party 1 · 900000001 · They owe you · ₹1,500
notice      : "DEV: reading parties from the local API…"
requests    : GET /api/vyora-dev/parties/pty_aaaaaaa1-…
direct :4000: (none)
```

As designed, only the **header identity and net** come from the API; statement
rows still come from the local log, because the API exposes no entry-level read.

A second detail check used a party that exists **only locally**. The API
returned `404`, and the screen fell back to the local record:

```
heading: E2E LOCAL ONLY · They owe you · ₹4,242
notice : "DEV: Party API read failed — showing local data.
          NOT_FOUND: No party pty_e2elocal in this workspace.
          Your local ledger is unchanged. Nothing was written."
```

A remote miss is not treated as evidence the party is gone.

### Case 3 — No credential in browser JS, network, page source or storage · **PASS**

| Check                                                                           | Result                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 9 loaded scripts searched for the identity value **and** `x-vyora-dev-identity` | **0 hits**                                                                                              |
| Page source (`outerHTML`) contains identity or header name                      | **false**                                                                                               |
| `localStorage` / `sessionStorage` / `cookie` contain identity                   | **false**                                                                                               |
| Request headers on the proxy call                                               | `sec-ch-ua-platform`, `Referer`, `User-Agent`, `sec-ch-ua`, `sec-ch-ua-mobile` — **no identity header** |

The browser's own request carries no credential. It is attached server-side.

### Case 4 — Traffic reaches the Next proxy, not the API directly · **PASS**

```
proxy requests  : GET http://127.0.0.1:3000/api/vyora-dev/parties?limit=200  → 200
direct :4000    : (none, in any case)
```

Across every case in this run, the browser made **zero** requests to
`127.0.0.1:4000`.

Independently confirmed that the API genuinely requires the credential:

```
GET http://127.0.0.1:4000/api/v1/parties          (no header)  → 401
GET /api/v1/me                (with dev identity header)       → merchantId 1111…1111
GET /api/v1/parties/pty_bbbbbbb1-…  (beta's party, alpha creds) → 404
```

So the proxy's upstream request is authenticated **and** workspace-scoped, and
the cross-tenant read is refused with `404`, never `403`.

### Case 5 — Fallback when the API is stopped · **PASS**

API process killed; web app left running.

```
proxy response : 502
notice         : "DEV: Party API read failed — showing local data.
                  DEPENDENCY_UNAVAILABLE: Could not reach the local API at
                  http://127.0.0.1:4000. Is it running? (fetch failed)
                  Your local ledger is unchanged. Nothing was written.  [Retry]"
rows           : E2E LOCAL ONLY  ₹4,242  They owe you
```

**No write attempted, by any measure:**

| Evidence                           | Result                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| POST/PATCH/PUT/DELETE from the app | **none**                                                                              |
| `localStorage` log after failure   | **byte-identical** to before                                                          |
| Storage keys present               | only `vyora.events.v2`                                                                |
| Synthetic API rows                 | `parties=5`, `events=10`, `entries=5`, `idempotency_keys=0` — unchanged from baseline |
| Write verbs in the API log         | **0**                                                                                 |

> The only non-GET request observed anywhere was
> `POST /__nextjs_original-stack-frames` — Next.js's own development error
> overlay, not application traffic. Recorded here rather than filtered out,
> because a report that quietly drops inconvenient rows is not evidence.

### Case 6 — Retry after the API is restored · **PASS**

API restarted with the page still open; **Retry** clicked in the notice.

```
before : DEPENDENCY_UNAVAILABLE …  rows = E2E LOCAL ONLY
after  : "DEV: reading parties from the local API…"
         rows = alpha party 1 / 2 / 3
local log unchanged across the retry: true
```

Recovery needed no reload and no local repair step.

### Case 7 — Default path: flag absent · **PASS**

Web restarted with the flag, API URL and identity **all unset**, `.next` cleared,
and a **brand-new browser profile**.

```
rows           : E2E LOCAL ONLY  ₹4,242  They owe you
notice         : null            ← renders nothing at all
proxy requests : []              ← no API/proxy request whatsoever
direct :4000   : []
```

Server-side, the proxy independently refuses:

```
GET /api/vyora-dev/parties → 404
{"error":{"code":"NOT_FOUND",
          "message":"NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED is not \"true\" (default: disabled)."}}
```

## 4. Two findings that are _not_ product defects

Both cost real time to chase, so they are recorded rather than quietly dropped.

### 4.1 Next dev mode cannot boot a browser client under the app's CSP

In `next dev`, React Refresh evaluates strings, which the app's CSP forbids:

```
EvalError: Evaluating a string as JavaScript violates the following Content
Security Policy directive because 'unsafe-eval' is not an allowed source
```

The client never hydrates and every Vyora screen sits on `Loading…`. This is
pre-existing, affects **any** browser testing of this app in dev mode, and is
unrelated to the Party integration — the production build ships no React
Refresh.

Worked around with CDP `Page.setBypassCSP`, a **browser-side** affordance that
changes no application code. It does not weaken this verification: credential
containment and request destinations are independent of CSP.

Worth a future decision: dev-mode CSP currently makes in-browser development of
this app impossible without a bypass.

### 4.2 A service worker will serve a stale bundle after the flag changes

Midway through, Case 7 appeared to **fail** — the browser issued a proxy request
with the flag unset. It reproduced after clearing `.next`, and again with
`Network.setCacheDisabled` and `clearBrowserCache`.

The cause was found by comparing the served bundle to the one on disk:

```
served to browser : flag: "true"
on disk           : flag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED
```

Next inlines `process.env.NEXT_PUBLIC_*` only when the variable is defined at
build time, so the on-disk chunk was correct. The browser was being served an
older chunk by **Vyora's own service worker**, which is scoped to `/vyora/` and
is not bypassed by CDP's cache controls. On a genuinely fresh profile the case
passed with zero proxy requests.

**Operational consequence, worth knowing:** after toggling the flag, a developer
must unregister the service worker or use a fresh profile. A plain reload — even
a hard one — can keep serving the previous bundle, and the symptom looks exactly
like the flag being ignored.

I reported this as a real defect before completing the diagnosis. It was not
one; the correction is recorded here because the intermediate claim was wrong.

## 5. Validation

**API, against a freshly created database**

```
migrations   : applied: 001_init.sql
type-check   : clean (exit 0)
contract lint: 0 errors, 0 warnings
tests        : Test Files 6 passed (6) · Tests 80 passed (80)
```

**Root, with the local PostgreSQL process stopped**

```
Test Files  124 passed (124)
     Tests  2395 passed (2395)
✓ Compiled successfully
exit 0
```

## 6. Safety confirmations

- **Synthetic data only.** Every party, phone number and amount came from
  `src/seed/seed.ts` or from the harness's throwaway browser profile.
- **No real merchant data left the browser.** No existing browser profile was
  opened; the only `localStorage` touched belonged to a temporary profile that
  was deleted at the end of the run.
- **No merchant data was sent anywhere.** The only outbound calls were browser →
  `127.0.0.1:3000` and server → `127.0.0.1:4000`. Both loopback.
- **Credentials stayed server-side.** Verified against loaded bundles, page
  source, all web storage, and the browser's own request headers.
- **Committed default remains `false`.** No repository configuration file was
  modified by this milestone.
- **Nothing pushed, merged or deployed.**

## 7. Teardown

API, web and browser processes stopped; both temporary browser profiles deleted;
`vyora` and `vyora_test` dropped and recreated empty; PostgreSQL stopped. The
extra `dev_identities` fixture row existed only in the synthetic database and
was removed with it.

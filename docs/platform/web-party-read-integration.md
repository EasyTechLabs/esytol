# Web Party Read Integration

> Development-only, read-only. The pilot experience is unchanged and the flag is
> off by default.
> Validation evidence: `web-party-read-validation.md`.

---

## 1. What this is

A developer can point the Vyora Parties screen at a locally running `vyora-api`
to check that the API returns what the web app expects. That is the entire
scope.

It is **not** cloud sync, **not** a migration, and **not** a change to where a
merchant's data lives. Nothing on this path writes anything, anywhere.

## 2. Why read-only

The API is the newer, less-proven half of the system. It has 80 tests and zero
merchants; the local event log has a pilot's worth of care behind it and is the
merchant's actual book.

A write boundary would let a development experiment mutate a pilot ledger. There
is no version of "careful" that makes that a good trade while the flag exists
for a developer's convenience — so the boundary simply has no write operation to
misuse. `PartySource` exposes `list` and `get`, and a test asserts those are the
only members. The proxy routes export `GET` and nothing else, and a test asserts
no `POST`, `PUT`, `PATCH` or `DELETE` exists.

Writes continue through the local command path, untouched by this milestone.

## 3. Why development-only

Three conditions must **all** hold, evaluated in one pure function
(`lib/vyora/party-api-config.ts`) so there is exactly one place to read and one
thing to test:

| #   | Condition                                                       | What it prevents                                                                                                 |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED` is exactly `"true"` | Absence, `""`, `"1"`, `"yes"` and `"TRUE"` all mean off. A flag that half-works is worse than one that does not. |
| 2   | the build is **not** a production build                         | A flag left on in a production build cannot switch anything on                                                   |
| 3   | the API URL is loopback                                         | A mistakenly-enabled non-production build cannot be pointed at another machine                                   |

Condition 2 carries the most weight. `NEXT_PUBLIC_*` values are **inlined at
build time**, so a stale enabled flag would otherwise ship inside the bundle to
real devices. Checking `NODE_ENV` at decision time makes "production ignores the
development flag" structurally true rather than a convention someone remembers.

Verified, not assumed: a production build was run with the flag set to `true`
and the credential set, and the development path stayed inert.

## 4. Why the browser never calls the API

**The development identity is a credential, and a credential in browser
JavaScript is a credential you have published.**

So the browser calls this app's own route — `/api/vyora-dev/parties` — which
attaches `VYORA_API_DEV_IDENTITY` server-side. That variable deliberately has
**no `NEXT_PUBLIC_` prefix**, so Next never inlines it into a client bundle.

```
Browser ──► /api/vyora-dev/parties ──► http://127.0.0.1:4000/api/v1/parties
            (Next route handler)        + x-vyora-dev-identity: <server-only>
```

The gate is **re-evaluated inside the route**, not trusted from the client. A
client-side check is a UI affordance; a hand-written `fetch` to that path
bypasses the UI entirely, so the route is the actual control. When the feature is
off it answers `404` rather than `403` — saying "forbidden" advertises that the
endpoint exists.

The route also forwards an **allow-list** of query parameters rather than passing
anything through, so it can only ever express a read the API already supports.

## 5. Why local and API parties are not merged

They are not the same data, and pretending otherwise is how a merchant loses
money.

- The local ledger holds the merchant's real parties, derived from their own
  event log.
- The API holds two **synthetic** seeded workspaces. Every name, phone number
  and amount in them is invented.

Automatically merging them would put fabricated parties into a real book, or
real parties into a synthetic one, with no record of which was which. Neither is
recoverable by inspection afterwards — the merchant would be left deciding which
of two similar rows is the one they are actually owed money by.

More fundamentally, **merging is a write**, and this milestone has no write
path. So the two sets stay separate: the remote source _replaces_ the displayed
rows while it is enabled and succeeding, and the notice says so on screen. The
local ledger is not consulted for a merge and is not modified either way.

The same reasoning blocks the obvious next request — "just import the API
parties into my local book". That is the migration in §7, and it is gated.

## 6. Failure behaviour

Any remote failure returns **local rows** plus a developer-visible error.

The remote path is never allowed to be the reason a party list looks empty. A
merchant's book showing nothing is indistinguishable, from the merchant's side,
from a merchant's book being lost — and one of those is a catastrophe.

Failure modes covered by tests: connection refused, HTTP 500, a non-JSON error
body, and a `null` answer for a party that exists locally. In every case the
stored log is byte-identical afterwards, and no read path calls `setItem`,
`removeItem` or `clear`.

The notice is deliberately technical (`DEV: Party API read failed — showing
local data`). It must never read like a merchant-facing message: a merchant who
sees "API unavailable" on their ledger has been told their book is broken, which
would be false. It renders **nothing at all** when the flag is off, so the
default screen is byte-identical to before this milestone.

## 7. Prerequisites before opt-in migration or event sync

None of the following is in scope here. Each is listed so the gap is explicit
rather than assumed away.

**Before any migration of local data to the API**

1. Real authentication — the development identity is a fixture, not a login.
2. Explicit, revocable merchant consent (ADR-0004).
3. A resolved answer for the delete/create race (`openapi-design.md` §6,
   deferred decision 1) — otherwise a migration can orphan an entry.
4. A merge strategy for parties that exist on both sides, with the merchant
   deciding, never an automatic rule.
5. A reversible migration: a merchant must be able to go back to local-only with
   nothing lost.

**Before event sync**

6. Everything above, plus the six Phase E preconditions in `migration-plan.md`.
7. Erasure versus immutable history resolved (deferred decision 2).
8. Pilot evidence that merchants actually want multi-device (ADR-0004).

**Not blocked by this milestone.** This integration is deleted by turning the
flag off, and removed entirely by deleting five files and two route handlers.

## 8. Enabling and disabling safely

### Enable, locally

1. Start the API and its database:

   ```bash
   "C:\Users\dell\pgsql16\bin\pg_ctl.exe" -D "C:\Users\dell\pgsql16\pgdata" \
     -o "-p 55432 -h 127.0.0.1" -l "C:\Users\dell\pgsql16\server.log" -w start
   cd vyora-api && npm run db:migrate && npm run db:seed && npm start
   ```

2. In `.env.local` (**never** `.env.example`, and never committed):

   ```
   NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED=true
   NEXT_PUBLIC_VYORA_API_URL=http://127.0.0.1:4000
   VYORA_API_DEV_IDENTITY=alpha
   ```

3. Restart `npm run dev`. `NEXT_PUBLIC_*` values are read at build time, so a
   running dev server will not pick them up.

4. Open `/vyora/parties`. A blue notice confirms reads are coming from the API.
   No notice means the gate refused — check the reason in the flag's decision.

### Disable

Set the flag back to `false`, or delete the three lines, and restart. That is
the whole rollback: no data to unwind, because nothing was written.

### Rules

- **Never** set `VYORA_API_DEV_IDENTITY` with a `NEXT_PUBLIC_` prefix. That
  publishes the credential to every browser that loads the app.
- **Never** point `NEXT_PUBLIC_VYORA_API_URL` at a non-loopback host. It will be
  refused, but the attempt means the intent was wrong.
- **Never** enable this in a deployed environment. It is ignored there, and
  setting it anyway hides the intent from the next person reading the config.
- The API's seeded data is synthetic. Do not use it to judge whether the
  merchant-facing experience looks right.

## 9. Files

| File                                           | Role                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `lib/vyora/party-source.ts`                    | the read interface + the local (default) implementation |
| `lib/vyora/party-api-config.ts`                | the three-condition gate, as one pure function          |
| `lib/vyora/party-source-remote.ts`             | the remote implementation; talks only to the proxy      |
| `app/api/vyora-dev/parties/forward.ts`         | server-side gate + credential + forwarder               |
| `app/api/vyora-dev/parties/route.ts`           | list proxy (`GET` only)                                 |
| `app/api/vyora-dev/parties/[partyId]/route.ts` | detail proxy (`GET` only)                               |
| `features/vyora/usePartySource.ts`             | source selection and local fallback                     |
| `features/vyora/PartySourceNotice.tsx`         | developer-visible banner; renders nothing by default    |

Two screens changed: `Parties.tsx` and `PartyStatement.tsx`. Both read through
the hook and render the notice; neither behaves differently while the flag is
off.

> `PartyStatement` takes only its **header identity and net** from the API. The
> statement rows always come from the local log, because the API exposes no
> entry-level read and inventing one is outside a read-only slice.

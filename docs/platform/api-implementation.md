# API Implementation

> `vyora-api/` — synthetic data, localhost only. No deployment, no web
> integration, no React Native app.
> Validation results: `api-validation-report.md`.

---

## 1. Shape

TypeScript + Fastify 5 + PostgreSQL 16 via `pg`. A modular monolith: one
process, internally partitioned into `system`, `parties` and `sync`, which talk
by function call rather than HTTP.

```
src/
  config.ts          startup gates
  contract.ts        openapi.yaml → Ajv validators
  server.ts          assembly, error handler, route collection
  errors.ts          the one error envelope
  idempotency.ts     Idempotency-Key replay, scoped per merchant
  auth/index.ts      tenant resolution
  events/apply.ts    the single event-application path
  modules/system|parties|sync
  db/pool.ts, db/migrate.ts
  seed/seed.ts
```

No ORM. Hand-written SQL and a numbered-migration runner, because an ORM that
derives schema from code can drop a column it no longer sees — and an
append-only event log is precisely the thing you cannot recover from that.

## 2. The contract is the validator, not a reference

`openapi.yaml` is parsed at boot and its `components.schemas` are handed
directly to Ajv. A request the contract forbids is rejected _by the contract_.

This works without a translation layer because OpenAPI 3.1 schemas **are** JSON
Schema 2020-12. `contract.validate("CreatePartyRequest", body)` compiles
`#/components/schemas/CreatePartyRequest` against the document itself, and
`ClientEvent`'s twelve-way discriminated union gives every event payload the
same treatment.

The alternative — generating types once and hand-writing the runtime checks —
produces two copies of the rules that drift apart quietly. Here there is one.

**Parity is a test, not a convention.** `tests/contract.test.ts` compares the
routes Fastify actually registered (collected via its `onRoute` hook) against
the contract's operations **in both directions**. An undocumented endpoint fails
as loudly as a missing one.

## 3. Tenancy

`resolveTenant` returns a `TenantContext { merchantId, userId, deviceId, authMode }`
and is the only way any handler reaches a workspace. Nothing downstream can name
one — there is no request field that carries a `merchantId`.

| Scheme       | Header                    | When                           |
| ------------ | ------------------------- | ------------------------------ |
| `bearerAuth` | `Authorization: Bearer …` | always                         |
| `devAuth`    | `X-Vyora-Dev-Identity: …` | only when all three of §4 hold |

Bearer tokens are rows in `access_tokens` — a local stand-in while the identity
provider stays a Phase E decision. The contract only requires "a validated token
resolves to a workspace", so swapping in a real provider is not a contract
change.

**Every query is scoped by `merchantId`.** Repository functions take it as a
required first argument; there is no overload that omits it.

Cross-tenant reads return **404, never 403**. A 403 confirms the resource
exists, which is itself a disclosure. `tests/tenant-isolation.test.ts` asserts
the cross-tenant 404 and the not-found 404 are byte-identical in code and status.

## 4. Development identity, fenced

1. **Distinct scheme** — `apiKey` in its own header, so accepting it is one
   explicit branch, not a special case inside bearer parsing.
2. **`VYORA_DEV_AUTH=true` required** — otherwise the header is ignored.
3. **Refused under `NODE_ENV=production`** — `loadConfig` throws `StartupError`
   and the process exits 1. Not a warning; warnings get ignored.
4. **Loopback only** — refused from any non-loopback address even when enabled.
5. **Fixture workspaces only** — the value resolves through `dev_identities`,
   which points only at seeded synthetic merchants. There is no path from this
   header to a real merchant record.
6. **Disclosed** — `GET /me` returns `authMode: "development"`, so a client can
   refuse to render fixtures as if they were the merchant's own book.

Controls 3 and 5 are what make "this can never become a production bypass"
structurally true rather than merely intended.

A second gate refuses any `DATABASE_URL` that is not loopback, so no
configuration slip can point this build at data that is not synthetic. Its error
message prints the host but never the connection string, which carries a
password.

## 5. Party writes are events

`POST /parties` and `PATCH /parties/{partyId}` do **not** write to
`party_projection`. They mint a `ContactCreated` / `ContactUpdated` event and
hand it to `appendAndApply`, exactly as `POST /sync/push` does.

A party created over REST and one created on a device are therefore
indistinguishable in the log — asserted directly in `tests/parties.test.ts`,
which reads the `events` table after each write.

Had REST updated a row _and_ written an event, there would be two
implementations of what a change means. They would diverge silently, because
each is individually self-consistent.

### Optimistic concurrency

`version` increments on every applied party event; the `ETag` is `"<version>"`.
`If-Match` is **required** on `PATCH` — omitting it is `428`, not a free pass.
An optional precondition is one a client forgets under deadline, and the failure
mode is a silently overwritten edit from another device.

### Merge-patch semantics

Absent key → unchanged. Explicit `null` → cleared. Implemented once, in the
`ContactUpdated` case of `applyToProjection`, with `Object.hasOwn` deciding
which columns the SQL touches.

## 6. Storage

Two kinds of table, and the distinction is the design:

- **`events`** — append-only, immutable, `PRIMARY KEY (merchant_id, event_id)`.
  Never updated, never deleted.
- **`party_projection`, `entry_projection`** — rebuildable caches. If a
  projection and the log disagree, the log wins.

**No balance column exists anywhere** — asserted by a test that scans
`information_schema.columns` for `%balance%` and requires an empty result.
Balance is folded per read in a `LATERAL` subquery.

`recorded_at` is `timestamptz(3)`. This is deliberate: cursors round-trip
through ISO-8601, which carries milliseconds. Microsecond storage truncates the
cursor on the way out, and the last event of every page is served again forever.
That bug was live until a pagination test caught it. Ties inside a millisecond
are what the `event_id` half of the cursor is for.

## 7. Sync

**Push.** Each event is judged independently — validated against its contract
schema, checked for snapshot type, then appended. A batch of 50 with one bad
event yields 49 accepted and 1 rejected. All-or-nothing would let one malformed
event from an old build wedge a device's outbox forever, and the merchant's book
would simply stop syncing.

Every submitted `eventId` lands in exactly one of `accepted`, `duplicate` or
`rejected` — tested.

Duplicate detection compares payloads **in SQL** (`payload = $1::jsonb`).
Comparing serialised strings is wrong: `jsonb` does not preserve key order, so a
genuine duplicate round-trips with its keys rearranged and gets misread as a
conflict. The client would then quarantine a perfectly good event. That bug was
also live until a test caught it.

Batch-level refusals (`schemaVersion` too old → `409`, oversized batch → `413`)
consume nothing, so a client's outbox survives being out of date.

**Pull.** Ordered by `(recorded_at, event_id)` — server receipt order, the only
total order every device agrees on. `occurred_at` drives the merchant-visible
timeline and is never the sort key: paginating by device clock lets a device
that was offline be skipped permanently.

A test pushes three events whose device clocks run _backwards_ and asserts the
pull order follows `recordedAt` while `occurredAt` descends. That is the
property, stated as an executable claim.

Cursors are HMAC-signed, so one this server did not issue is
`SYNC_CURSOR_INVALID` rather than silently accepted. A cursor before the
retention window is `SYNC_CURSOR_EXPIRED` — recoverable, since restarting with
no cursor re-applies idempotently.

**Snapshots** (`ImportCompleted`, `RestoreCompleted`) are rejected with
`SNAPSHOT_EVENT_UNSUPPORTED` and never stored. Their payloads are fully
specified in the contract anyway, so the server refuses them for the _right_
reason instead of reporting an unknown type — tested by asserting the two
reasons differ.

## 8. Errors

One envelope, one exit. `sendError` is the only place a failure response is
produced, and it sets `X-Request-Id` there rather than per route so no path can
forget it. Fastify's own 400/413 are re-wrapped, so malformed JSON does not
escape through a different shape.

A test table walks six distinct error paths and asserts the envelope, the code,
and that the header and body request ids **agree** — a client that logs only one
of them must still be able to correlate.

Unexpected errors are logged with their request id. An `INTERNAL_ERROR` the
server never logged is an incident nobody can diagnose; that gap existed briefly
and hid a real bug during this milestone.

## 9. Isolation from esytol

Own `package.json` and `package-lock.json`. No workspaces, no Turbo, no Nx, no
import rewrites. Nothing in `esytol` references `vyora-api`, verified by grep
across `app/`, `lib/`, `features/`, `.github/`, `next.config.ts` and
`package.json`.

No CI hook was added. The web pipeline is untouched, which was the safer reading
of "add only the narrowly required hooks after confirming they do not alter the
existing web deployment" — see `api-validation-report.md` §7.

## 10. What is deliberately absent

No web integration · no React Native app · no Docker Compose file · no deployed
environment · no real authentication provider · no rate limiting · no projection
rebuild command · no server-side log compaction.

The four deferred decisions from `openapi-design.md` §6 remain open and are
untouched by this implementation.

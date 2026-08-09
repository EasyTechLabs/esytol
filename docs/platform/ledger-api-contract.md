# Ledger API Contract

> The credit slice: how an existing web command becomes an immutable event, a
> row in PostgreSQL, a projection, and a statement line.
> Evidence: `ledger-credit-validation.md`.

---

## 1. No new ledger concepts

Nothing here invents a command, an event type or a payload. The chain below
already existed on merchants' devices in log format v2 and in the approved
contract; this milestone only adds the two HTTP operations that let the API
receive and return it.

## 2. The exact mapping

```
  existing web command      RecordCredit { contactName, amount, kind,
                                           description?, date?, dueDate? }
                            lib/vyora/commands.ts
            │
            │  executeCommand → resolveContact → createCreditRecorded
            ▼
  existing local event      CreditRecordedEvent {
                              id, at, type: "CreditRecorded",
                              transaction: Transaction {
                                id, partyId, amount,
                                kind: "given" | "taken",
                                description?, date, dueDate?, createdAt } }
                            lib/vyora/events.ts
            │
            │  POST /api/v1/parties/{partyId}/credits
            │  RecordCreditRequest { id, amount, kind, description?,
            │                        date, dueDate?, createdAt? }
            ▼
  API event payload         CreditRecordedPayload { transaction: TransactionRecord }
                            — byte-for-byte the same shape as the local event
                            vyora-api/openapi/openapi.yaml
            │
            │  appendAndApply()  ← the ONE server-side application path
            ▼
  PostgreSQL event          events (merchant_id, event_id, device_id, type,
                                    aggregate_id, payload jsonb,
                                    occurred_at, recorded_at)
                            append-only · PK (merchant_id, event_id)
            │
            │  applyToProjection()
            ▼
  projection                entry_projection (merchant_id, entry_id, party_id,
                                              entry_type, direction, amount,
                                              business_date, due_date,
                                              created_at, description, event_id)
                            rebuildable cache · NO balance column
            │
            │  GET /api/v1/parties/{partyId}/statement
            │  fold oldest-first: runningNet += signedAmount
            ▼
  statement projection      PartyStatement { partyId, rows[], balance }
                            StatementRow = LedgerEntry
                                         + signedAmount, runningNet, label
            │
            │  toLocalStatementRow()
            ▼
  web display               StatementRow = ActivityItem & { runningNet }
                            — the shape PartyStatement.tsx already renders
```

### Field-by-field

| Local `Transaction` | API request   | Column          | Statement row                                     |
| ------------------- | ------------- | --------------- | ------------------------------------------------- |
| `id`                | `id`          | `entry_id`      | `id`                                              |
| `partyId`           | _(path)_      | `party_id`      | `partyId`                                         |
| `amount`            | `amount`      | `amount`        | `amount`                                          |
| `kind`              | `kind`        | `direction`     | `direction`                                       |
| `description`       | `description` | `description`   | `note`                                            |
| `date`              | `date`        | `business_date` | `date`                                            |
| `dueDate`           | `dueDate`     | `due_date`      | `dueDate`                                         |
| `createdAt`         | `createdAt`   | `created_at`    | `createdAt`                                       |
| _(event `id`)_      | —             | `event_id`      | `eventId`                                         |
| —                   | —             | —               | `signedAmount`, `runningNet`, `label` _(derived)_ |

The last row is the point: everything a merchant reasons about — the running
balance, the sign, the label — is **computed**, never stored and never sent.

## 3. The principles, and where each is enforced

**Ledger writes are immutable events.** `POST …/credits` mints a
`CreditRecorded` event and hands it to `appendAndApply`. The `events` table is
append-only with `PRIMARY KEY (merchant_id, event_id)`; nothing updates or
deletes a row. A correction would be a further event, never an edit.

**The API never receives state replacement.** `RecordCreditRequest` has
`additionalProperties: false` and carries no balance, no totals and no party
fields. There is no `PUT`, and the statement endpoint is `GET` only.

**Statement reads are projections of accepted events.** `entry_projection` is a
cache; the running balance is folded per read in `readStatement`. If the
projection and the log disagree, the log wins and the projection is rebuilt — a
test asserts no column anywhere is named `%balance%`.

**No Customer/Supplier model.** `direction` is on the _entry_
(`given`/`taken`/`received`/`paid`); the party carries no role. The same party
can be `owes_merchant` one day and `merchant_owes` the next, and the seeded
fixtures include both so the tests actually exercise it.

**Tenant scope comes only from authentication.** Every query takes `merchantId`
from the resolved token. No path, query or body accepts one. Cross-tenant reads
return `404`, never `403`, so a caller cannot probe for another merchant's
parties.

**No deletion, snapshots, sync activation, cloud data or real identity.** The
ledger surface is exactly `POST …/credits` and `GET …/statement`. Deletion is
withheld because delete-versus-concurrent-entry has no safe automatic answer
(`openapi-design.md` §6, deferred decision 1).

## 4. What was added to the contract

Two operations, taking the approved surface from eight to ten:

```
POST /api/v1/parties/{partyId}/credits    → LedgerEntry
GET  /api/v1/parties/{partyId}/statement  → PartyStatement
```

Five schemas: `RecordCreditRequest`, `LedgerEntry`, `StatementRow`,
`PartyStatement`, plus the `Ledger` tag. Nothing existing was modified.

**This is not sync.** Sync reconciles two devices' logs and is still inert. These
operations append one event and read the projection back — a different shape for
a different purpose, deliberately kept separate so enabling one does not enable
the other.

## 5. One migration

`002_entry_statement_fields.sql` adds `description` and `event_id` to
`entry_projection`, plus a `(merchant_id, party_id, created_at, entry_id)` index.

Both fields were already carried by the event; the projection simply was not
surfacing them. `event_id` is the audit handle that lets a statement line be
traced to the exact immutable event that produced it. Additive and nullable, and
the projection is rebuildable from the log, so replay fills them in.

## 6. Ordering and the running balance

Statement rows are ordered by `(created_at, entry_id)`. The tiebreak matters:
two entries recorded in the same millisecond must not reorder between reads, or
the running balance would appear to change on refresh — which, to a merchant
checking a disputed total, looks exactly like the ledger being wrong.

`runningNet` is folded on the server and passed through to the client unchanged.
It is deliberately **not** recomputed in the browser: folding the same total
twice, in two languages, is how two copies eventually disagree.

## 7. A defect this slice exposed

The `pg` driver parses `date` columns into JavaScript `Date` objects, so the
first statement read returned:

```
"date": "Wed Jul 01 2026 00:00:00 GMT+0530 (India Standard Time)"
```

A business date is a **calendar day in the merchant's timezone**, not an
instant. Parsing it re-interprets it in the server's timezone and serialises a
full timestamp — breaking the contract's `format: date` and, worse, able to shift
an evening sale onto the wrong trading day.

Fixed in `db/pool.ts` beside the existing `bigint` parser: OID 1082 is returned
as the string PostgreSQL already provides.

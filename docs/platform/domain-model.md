# Vyora Platform — Domain Model

> Design only. No code, no schema, no migrations exist for any of this.
> Supersedes the `Customer`-centred sketch in VYORA-PLATFORM-001, which was wrong.

---

## 1. Party is the canonical entity

There is no `Customer` table and there never will be.

```
Party  ──< Entry (credit | payment)
```

A **Party** is one person or business the merchant deals with. **Role is derived from entries, not
stored on the party.** The same party can owe the merchant today and be owed tomorrow.

| Concept       | Definition                                                                             |
| ------------- | -------------------------------------------------------------------------------------- |
| **Party**     | a contact: `id`, `name`, `phone?`, `note?`                                             |
| **Customer**  | a _view_: parties whose net balance is positive (they owe the merchant)                |
| **Supplier**  | a _view_: parties whose net balance is negative (the merchant owes them)               |
| **Direction** | a property of the **entry**: `given`/`taken` for credit, `received`/`paid` for payment |

**API consequence:** the resource is `/parties`, never `/customers`. A `role` query parameter may
_filter_ by derived balance, but role is never persisted, never sent on create, and never assumed.
A party with no entries has no role at all.

**Balances are never stored.** Every balance is derived by folding entries. A server column holding
a balance would be a second source of truth and would drift the moment an event arrived late — which,
in an offline-first system, is the normal case rather than the exception.

## 2. Event envelope

Every event carries this envelope. The payload varies by type; the envelope never does.

| Field            | Purpose                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eventId`        | UUID. Globally unique, **client-generated**. The primary idempotency key.                                                                                                                                     |
| `merchantId`     | tenant boundary. Every query is scoped by it; there is no cross-merchant read path.                                                                                                                           |
| `deviceId`       | which device produced it. Required for cursors and debugging, never for authorisation.                                                                                                                        |
| `aggregateId`    | the party or entry the event concerns. Enables per-aggregate ordering.                                                                                                                                        |
| `type`           | e.g. `CreditRecorded`. Closed vocabulary. **Superseded:** the client still tolerates unknown types when folding its own log, but the sync endpoint **rejects** them — `sync-protocol.md` §5 gives the reason. |
| `payload`        | type-specific body.                                                                                                                                                                                           |
| `payloadVersion` | integer. Lets one type evolve without a new type name.                                                                                                                                                        |
| `schemaVersion`  | envelope version. Currently `1`.                                                                                                                                                                              |
| `occurredAt`     | when the merchant did it, **device clock**. Displayed to the merchant.                                                                                                                                        |
| `recordedAt`     | when the server accepted it, **server clock**. Used for cursors and ordering.                                                                                                                                 |
| `causationId`    | the event that caused this one (e.g. a restore replaying an original). Nullable.                                                                                                                              |
| `idempotencyKey` | defaults to `eventId`; separate field so a retried _command_ can be deduped.                                                                                                                                  |

**`occurredAt` and `recordedAt` must both exist.** A merchant recording offline for three days has an
`occurredAt` three days old and a `recordedAt` of now. Sorting a statement by `recordedAt` would show
their week in the wrong order; paginating a sync cursor by `occurredAt` would let a late device skip
events forever.

## 3. Events are immutable

Nothing is ever updated or deleted. Corrections are new events:

| Intent             | Mechanism                                                                        |
| ------------------ | -------------------------------------------------------------------------------- |
| fix a wrong amount | `EntryDeleted` + a fresh `CreditRecorded` (today's behaviour)                    |
| change a due date  | `DueDateChanged` — a patch event                                                 |
| remove a contact   | `ContactDeleted` — a **tombstone**; the party's history remains in the log       |
| undo               | drop the last event locally _before_ sync; after sync, emit a compensating event |

**Tombstones are not deletions.** `ContactDeleted` removes the party and its entries from the
_projection_; the events stay. This is what makes replay deterministic and what will make a future
"restore deleted contact" feature possible without new storage.

**Right-to-erasure is a separate mechanism** and is out of scope here — see ADR-0004. Immutability
and GDPR-style deletion genuinely conflict, and that conflict must be resolved before real merchant
data reaches a server.

## 4. Event types that must be preserved exactly

These are already on merchants' devices in log format **v2**. The server must ingest them without
translation:

`ContactCreated` · `ContactUpdated` · `ContactDeleted` · `CreditRecorded` · `PaymentRecorded` ·
`DueDateChanged` · `EntryDeleted` · `ContactReminded` · `DayClosed` · `BackupCreated` ·
`RestoreCompleted` · `ImportCompleted`

Three carry a **full snapshot** (`RestoreCompleted`, `ImportCompleted`) or are **audit-only**
(`BackupCreated`, `ContactReminded`, `DayClosed`). Snapshot events are the hardest sync case: they
replace an entire projection, so a server receiving one out of order would silently discard newer
events. **Snapshot events must be rejected by the sync endpoint in v1** and handled only by an
explicit, merchant-initiated restore flow.

## 5. Projections

The server stores events and derives read models — the same discipline as the client's Ledger Engine.

| Projection            | Contents                                                 |
| --------------------- | -------------------------------------------------------- |
| `party_projection`    | current party fields, derived net balance, last activity |
| `entry_projection`    | flattened credits and payments for statement queries     |
| `recovery_projection` | overdue aging, last reminder, priority inputs            |

Projections are **rebuildable from the event log at any time**. They are a cache, not a record. If a
projection and the log disagree, the log wins and the projection is rebuilt.

## 6. Sync protocol

Push and pull are independent and both cursor-based. **The client never sends state; the server never
overwrites.**

**Push** — client sends a batch of events from its outbox, oldest first.
Server responds with `accepted[]`, `duplicate[]` (already seen — success, not error), and
`rejected[]` with a reason. The client removes accepted _and duplicate_ events from its outbox.

**Pull** — client sends its last `recordedAt` cursor plus its `deviceId`.
Server returns events from other devices after that cursor, in `recordedAt` order, capped per page.
The client applies them through the **same `applyEvent`** used locally — no second reducer.

**Retry** — exponential backoff with jitter; the outbox is durable, so a device offline for a week
simply pushes a longer batch on reconnect. Retries are safe because `eventId` deduplicates.

**Device registration** — a device announces `deviceId` once and receives a cursor starting point.
An unknown `deviceId` is registered on first push; it is an identifier, not a credential.

### Conflicts that cannot happen

Because events are additive and immutable:

- **two devices recording entries simultaneously** — both are accepted; the projection folds both
- **the same event pushed twice** — deduplicated by `eventId`
- **out-of-order arrival** — the projection is rebuilt in `recordedAt` order
- **a device offline for weeks** — its events are late, not lost; `occurredAt` preserves the merchant's
  actual timeline

### Conflicts that need domain rules

| Case                                                                       | Proposed rule                                                                                       | Status                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Two devices create the same party by name                                  | Keep both; surface a merge prompt. Never auto-merge — merging two ledgers wrongly is unrecoverable. | **needs founder decision**         |
| `EntryDeleted` arrives for an entry another device already deleted         | Idempotent no-op                                                                                    | settled                            |
| `ContactUpdated` from two devices on the same field                        | Last-write-wins by `occurredAt`; ties broken by `eventId`                                           | **needs founder decision**         |
| `ContactDeleted` on one device, `CreditRecorded` for that party on another | Entry is orphaned. Proposal: resurrect the party as a tombstone-reversal and flag it.               | **unresolved — highest-risk case** |

## 7. Open questions

1. **Merchant identity.** `merchantId` is the tenant boundary, but Vyora has no accounts. What
   establishes it — a device-generated id promoted at first sync, or a real login? This blocks the
   auth design.
2. **Erasure vs immutability.** Crypto-shredding, log rewriting, or scoped hard deletion?
3. **Delete/create race** (§6) — no safe automatic answer exists.
4. **Do snapshot events ever sync?** Currently proposed: no. That means import/restore stays
   device-local, which may surprise a merchant who expects a restore to propagate.

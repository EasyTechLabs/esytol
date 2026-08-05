# Sync Protocol

> Design only. Implements ADR-0003 in contract form.
> Contract: `vyora-api/openapi/openapi.yaml` — `POST /api/v1/sync/push`, `GET /api/v1/sync/pull`.

---

## 1. The premise

**Sync transfers events. It never transfers state.**

The device's append-only log is the source of truth; `VyoraData` is a projection folded from it. The
server stores the same events and derives its own projections. Nothing in this protocol replaces one
side's ledger with the other's.

State-based sync fails here in a way that costs a merchant money. Two devices each `PATCH` a party
after a day offline, and one silently overwrites the other — an entry disappears, and the merchant
under-collects. Events are additive, so both survive and the fold reconciles them.

## 2. Two clocks, two jobs

| Field        | Clock  | Orders                        | Never used for             |
| ------------ | ------ | ----------------------------- | -------------------------- |
| `occurredAt` | device | the merchant-visible timeline | sync cursors               |
| `recordedAt` | server | the sync cursor               | anything the merchant sees |

Both are mandatory. A merchant who recorded offline for three days has an `occurredAt` three days old
and a `recordedAt` of now.

- Sort a statement by `recordedAt` → their week appears in the wrong order.
- Paginate a cursor by `occurredAt` → a device that was offline can be skipped **permanently**, because
  its late events sort before a cursor that has already moved past them.

The second failure is silent and unrecoverable without a full resync, which is why the cursor is
server-clock only.

## 3. Push

```
POST /api/v1/sync/push
Idempotency-Key: <uuid>

{ "deviceId": "<uuid>", "schemaVersion": 1, "events": [ …oldest first… ] }
```

No `merchantId`. The batch lands in the workspace the token resolves to, and there is no field
through which it could be directed elsewhere.

**Every event is judged independently.** A batch of 50 with one bad event yields 49 accepted and 1
rejected. All-or-nothing would let a single malformed event from an old build wedge a device's outbox
forever — the merchant's book would simply stop syncing, with no way out that does not involve
deleting their data.

```json
{
  "accepted": [{ "eventId": "evt_…", "recordedAt": "…" }],
  "duplicate": [{ "eventId": "evt_…", "recordedAt": "…" }],
  "rejected": [{ "eventId": "evt_…", "reason": "SNAPSHOT_EVENT_UNSUPPORTED", "message": "…" }],
  "cursor": "<opaque>",
  "serverTime": "…"
}
```

Every submitted `eventId` appears in exactly one of the three arrays.

**Status codes carry batch outcomes, not event outcomes.** `200` means the batch was processed —
including when every event in it was rejected. A non-`2xx` means the batch could not be processed at
all and nothing was consumed.

### Client rules

| Outcome     | Client action                                                                              |
| ----------- | ------------------------------------------------------------------------------------------ |
| `accepted`  | remove from outbox                                                                         |
| `duplicate` | remove from outbox — **this is a success**, the server already holds it                    |
| `rejected`  | remove from outbox, move to quarantine, surface to a developer. **Never retry unchanged.** |

Treating `duplicate` as an error is the classic mistake: the outbox never drains, and every sync
re-sends the same events forever. Re-queueing a `rejected` event is the same bug with a different
cause — a permanently invalid event retried forever blocks everything behind it.

## 4. Pull

```
GET /api/v1/sync/pull?cursor=<opaque>&deviceId=<uuid>&limit=50
```

Returns events in `recordedAt` order, ties broken by `eventId`, excluding the caller's own device by
default (those are already applied locally). `includeOwnDevice=true` exists only for recovery after
local data loss.

**Pulled events are applied through the same event-application path as locally created events.**
There is no second reducer. One implementation of "what this event means" means client and server
cannot drift in interpretation — a class of bug that is nearly impossible to detect once it starts,
because both sides are individually self-consistent.

The cursor is **opaque** and encodes `(recordedAt, eventId)`. Encoding a bare timestamp would skip or
repeat events that share a millisecond. Clients must never construct one.

## 5. Required behaviours

### Duplicate delivery

`eventId` is globally unique and is the idempotency key. A re-pushed event returns in `duplicate`
with its **original** `recordedAt`, so the event's position in history never moves. Retries are
therefore free, which is what makes an unreliable connection safe rather than merely tolerable.

### Invalid cursor

`400` + `SYNC_CURSOR_INVALID` — malformed, or not issued by this server. The client discards it and
restarts from no cursor. Local events are untouched.

### Expired cursor

`409` + `SYNC_CURSOR_EXPIRED` — well-formed but pointing before the retained window. The client
restarts the pull with no cursor and re-applies from the beginning. This is idempotent by
construction: re-applying an already-applied event is a no-op, because application is keyed on
`eventId`.

### Stale client

`409` + `SYNC_CLIENT_TOO_OLD` on pull, or `409` + `SYNC_SCHEMA_VERSION_UNSUPPORTED` on push when the
envelope `schemaVersion` is below `minSupportedSchemaVersion`. The **whole batch** is refused and
nothing is consumed, so the outbox survives intact and no data is lost by being out of date. The
client must upgrade. `GET /me` publishes `schemaVersion`, `minSupportedSchemaVersion` and
`maxBatchEvents` so a client can detect this before pushing rather than after.

### Retry

Exponential backoff with jitter. The outbox is durable, so a device offline for a week pushes a
longer batch on reconnect rather than losing anything. `429` carries `Retry-After`. Retries are safe
because `eventId` deduplicates — no request in this protocol is unsafe to repeat.

### Partial acceptance

The normal case, not an error path. See §3.

### Schema-version incompatibility

Two independent axes, deliberately separate:

- **`schemaVersion`** — the envelope. Batch-level. Refuses the whole request.
- **`payloadVersion`** — one event type's body shape. Event-level, rejected with
  `PAYLOAD_VERSION_UNSUPPORTED`, leaving the rest of the batch unaffected.

One event type evolving must not require a new type name, and must not stop a device from syncing
everything else it has.

### Unknown event types

Rejected with `UNKNOWN_EVENT_TYPE` rather than stored-and-ignored.

> This **deliberately diverges** from `domain-model.md` §2, which proposed storing unknown types and
> ignoring them. Storing an event the server cannot interpret means it will be handed to other
> devices during pull, and they cannot interpret it either — so an event from a newer build
> propagates into every device's log while affecting no projection. Rejecting at the boundary keeps
> the failure visible and local. The _client_ still tolerates unknown types when folding its own log
> (`applyInto` has a total `default` case), which is what protects a downgraded app from crashing.

## 6. Snapshot events are rejected in v1

`RestoreCompleted` and `ImportCompleted` carry a full projection snapshot. Both are **always
rejected** on push with `SNAPSHOT_EVENT_UNSUPPORTED`.

A snapshot replaces an entire projection. One arriving out of order would silently discard newer
events from another device — exactly the loss this protocol exists to prevent, and worse than the
state-sync failure because it destroys a whole book rather than one entry.

Their payload shape is nonetheless fully specified in the contract, so the server recognises the
event and rejects it **for the right reason** instead of reporting an unknown type. A merchant asking
"why didn't my restore sync?" deserves an answer better than "we don't know what that was."

Import and restore therefore remain device-local. Deferred decision #3 covers whether that should
ever change; allowing them later is additive and breaks nothing.

## 7. Conflicts

**Impossible by construction** — because events are additive and immutable:

- two devices recording entries at the same moment — both accepted, the fold merges them
- the same event pushed twice — deduplicated by `eventId`
- out-of-order arrival — the projection is rebuilt in `recordedAt` order
- a device offline for weeks — its events are late, not lost; `occurredAt` keeps the merchant's real
  timeline

**Needing a domain rule:**

| Case                                                                           | Proposal                                                                                               | Status                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `EntryDeleted` for an already-deleted entry                                    | idempotent no-op                                                                                       | settled                               |
| Two devices create the same party by name                                      | keep both, surface a merge prompt; **never auto-merge** — wrongly merging two ledgers is unrecoverable | founder decision                      |
| `ContactUpdated` on the same field from two devices                            | last-write-wins by `occurredAt`, ties broken by `eventId`                                              | founder decision                      |
| **`ContactDeleted` on one device, `CreditRecorded` for that party on another** | none that is safe                                                                                      | **unresolved — deferred decision #1** |

The last one has no good automatic answer. Resurrecting the party silently un-deletes something the
merchant chose to remove. Orphaning the entry loses money they are owed. Both events are accepted and
stored regardless — only the **projection rule** is undecided, so nothing is lost while it stays open.
It blocks Phase D, not Phase B.

## 8. Not in v1

Real-time push · server-initiated sync · conflict _resolution_ UI · compaction of the server log ·
selective/partial sync · cross-device presence.

Absent by decision, not by omission.

# Vyora — web sync

How the browser stays in step with a merchant's phones, and what it deliberately
does not do. Written for whoever picks this up next.

Read alongside `VyoraEventLog.md` (the local log) and, in `vyora-api`,
[ADR-0003] (the device is the unit of sync), [ADR-0015] (a cursor belongs to a
reader) and [ADR-0016] (the server decides which device recorded an event).

## 1. The browser is not a device

A browser **never registers a device**, holds no installation key, has no device
uuid and shows no device-management UI. That is a decision, not a gap:

- an installation key is 256 bits kept in a platform key store, and a browser
  has no equivalent — the same reasoning that keeps the session token in an
  `httpOnly` cookie rather than in `localStorage`;
- a merchant's device list is a security surface they are asked to review and
  revoke from, and filling it with browser profiles makes the one phone that is
  not theirs harder to spot.

So attribution is the server's job. See §3.

## 2. Local-first, unchanged

The browser works with no network at all. Everything is recorded locally first,
and syncing is something that happens to work already recorded — never a
precondition for recording it. A merchant can create a contact, give credit,
take a payment and close the day with the API switched off, close the browser,
reopen it, and find their book exactly as they left it.

`offline` is therefore a **state, not an error**, and the UI says so: _"Saved on
this device. 3 entries will send when you are back online."_

If IndexedDB is unavailable — private mode, an old browser — the app keeps
running on the existing `localStorage` ledger. Sync is an addition to this
product, never a requirement for using it.

## 3. Reading and writing

|                        | Pull              | Push                                               |
| ---------------------- | ----------------- | -------------------------------------------------- |
| Needs a device?        | no ([ADR-0015])   | no ([ADR-0016])                                    |
| What the browser sends | `cursor`, `limit` | `schemaVersion`, `events`                          |
| Attribution            | n/a               | the server resolves an eligible device of the shop |

**Pull.** A cursor identifies a position in the shop's log, not a reader. The
browser sends no `deviceId` and no `includeOwnDevice`, so nothing is excluded
and it reads its own pushed events back. That is harmless: storing an event
already held is a no-op, and it is what lets a pending event learn the server's
clock and take its true place in the order (§5).

**Push.** The browser sends no `deviceId`. The API attributes every event to a
device belonging to an active member of the shop and records the acting person
separately in `actor_person_id` — the device answers _where_ a change entered
the system, the person answers _who_ made it.

`events.device_id` remains `NOT NULL`, and since migration 012 it has a foreign
key. Nothing about the event store changed to make web sync work.

**A shop with no registered device cannot be written to, from any client.** The
API answers `409` with a sentence the merchant can act on:

> This shop has no phone registered yet, so nothing can be recorded. Open Vyora
> on a phone and sign in once.

That is [ADR-0007] held rather than weakened. A browser-only shop is a shop
whose book has never existed on a phone, and inventing a device so it could
would be a fiction in the ledger.

## 4. Where the data lives

**IndexedDB**, database `vyora`, two stores: `events` and `meta`.

The old `localStorage` log is still read, still migrated from, and **never
deleted**. It moved for two reasons: the origin cap is a hard ~5 MB shared with
everything else on the domain, and `saveLog` re-serialises the entire log on
every append — O(E²) over a session, the same shape ENG-010 spent a milestone
removing from the fold.

Measured, per entry recorded, against a book of that size:

|   Book | Record one entry | Startup (read + fold + index) | Apply a pulled page of 200 |
| -----: | ---------------: | ----------------------------: | -------------------------: |
|  1,000 |          0.59 ms |                         28 ms |                      78 ms |
|  5,000 |          0.64 ms |                        117 ms |                      64 ms |
| 10,000 |          0.71 ms |                        219 ms |                      48 ms |
| 20,000 |          0.40 ms |                        495 ms |                      22 ms |

Recording is flat, startup is linear in the size of the book, and applying a
page depends on the page rather than on the book. `sync-scale.test.ts` asserts
those shapes by counting database operations rather than by timing them, so the
guarantee does not depend on how fast the machine running CI happens to be.

## 5. Ordering, which is the whole design

A projection is a fold, so the order events are folded in _is_ the balance. Two
clients holding the same events in different orders would show different money.

Every stored event carries an `order` key:

```
confirmed   "2026-08-15T09:14:22.115Z|evt_7f3a…"   the server's own order
pending     "~2026-08-15T09:20:01.004Z"            this browser's clock
```

`~` sorts after any digit, so the log reads as **the shared history, then the
work this browser has not sent yet**. When an event is acknowledged it is
rewritten with the server's `recordedAt` and moves into its true place. Once
every client has pushed, every client folds the identical sequence — convergence
as a property rather than a hope.

Pending events are ordered by their own instant, which `nowISO` guarantees is
strictly increasing on this device. Two that share an instant — a v1-migrated
log carries entity `createdAt` values, and two tabs each hold their own counter
— tie, and IndexedDB breaks an index tie by primary key, which is insertion
order.

## 6. The cycle

```
PUSH → PULL → APPLY → ADVANCE CURSOR → SYNCED
```

- **Push first**, so the server's log already holds this browser's work before
  we ask what we are missing. One round trip converges instead of two.
- **The cursor advances only with the page it describes**, in one IndexedDB
  transaction. A browser closed mid-page replays that page rather than stepping
  over it, and replay is free because every applier is idempotent.
- **A failed push never discards queued work.** A pending event is cleared only
  on the server's own acknowledgement — and `duplicate` counts as one, because
  it means the server already holds that id.
- **A failed pull leaves the push half succeeded.** Both halves report
  separately; "sync failed" would hide that the merchant's work is safe.

There is **one** orchestrator. Screens do not call push or pull; they ask for a
sync and get the one already in flight. Every trigger — startup, sign-in, a
local mutation, coming back online, the manual button — lands there.

The whole cycle runs inside `withLedgerLock`, the mutex from WEB-MULTITAB-001,
rather than a second lock of its own: applying a pulled page _is_ a ledger
write, and two mutexes guarding one resource is a race with extra steps.

## 7. Idempotency

Three independent guarantees, and they overlap on purpose:

1. **The event id.** `evt_…`, minted once when the merchant acts and never
   regenerated. The server deduplicates on it, so a retry after an unknown
   outcome cannot duplicate an entry.
2. **The local unique index.** `events.by_id` is unique, so an event that
   arrives twice cannot be stored twice.
3. **The idempotency key.** Minted once per batch, stored before the request,
   cleared only when the server answers. A key regenerated per attempt would
   make every retry a new batch.

## 8. Authentication

The existing model, unchanged. The token is an `httpOnly` cookie set by a route
handler and read only on this server; browser JavaScript cannot read it. Sync
calls go to `/api/vyora-sync/*` on this app, which attaches the credential and
forwards. The same gate applies as to sign-in: **no production, loopback API
only**, re-evaluated per request.

A signed-out browser does not sync — the forwarder answers `401` itself without
a round trip. An expired session moves the engine to `auth-required` and stops;
nothing queued is lost.

## 9. Snapshots do not travel

`RestoreCompleted` and `ImportCompleted` carry a whole projection and are
refused by sync in both directions. One arriving out of order would discard
newer events from another client — the exact data loss event-based sync exists
to prevent. They are filtered client-side too, so a browser that has restored a
backup pushes the events either side of it without spending a round trip being
told no.

**Consequence worth knowing:** importing a backup in the browser changes what
this browser shows, and does not change what any other client shows. Restore is
a local recovery action, not a way to publish a book.

## 10. Recovery and reset

- **A stuck sync.** Everything is retryable and nothing is lost by waiting; the
  cursor only ever moves forward with data actually applied.
- **Signing out, or changing shop.** `clearAll` empties both stores, cursor
  included. A cursor is a position in _one_ shop's log — keeping it would have
  the next person's first pull start where the last one got to, and skip
  everything before it permanently.
- **Starting the browser's copy again.** Clear the site's data. The shop's log
  is on the server and on the phones; the next sync reads it back from the
  beginning. Nothing the merchant recorded elsewhere is at risk.
- **A migration that fails verification** leaves itself unmarked, clears the
  partial copy, and leaves the merchant on `localStorage` — working, with the
  reason in the return value.

## 11. Mobile and web differ in exactly two ways

|                          | Mobile                     | Web                            |
| ------------------------ | -------------------------- | ------------------------------ |
| Registers a device       | yes                        | **no**                         |
| Sends `deviceId` on push | yes, and it is checked     | **no** — the server attributes |
| Local store              | SQLite, one file per shop  | IndexedDB, one database        |
| Pull                     | may exclude its own device | excludes nothing               |
| Idempotency              | event id + outbox key      | event id + outbox key          |
| Fold                     | one implementation         | one implementation             |

Everything below the transport is shared: the same event vocabulary, the same
payload shapes, the same ids, the same cursor contract. There is no third
ledger implementation, and this milestone did not create one.

[ADR-0003]: ../../vyora-api/docs/adr/0003-event-based-sync-and-projections.md
[ADR-0007]: ../../vyora-api/docs/adr/0007-financial-proposals-and-approval.md
[ADR-0015]: ../../vyora-api/docs/adr/0015-a-cursor-belongs-to-a-reader-not-a-device.md
[ADR-0016]: ../../vyora-api/docs/adr/0016-the-server-decides-which-device-recorded-an-event.md

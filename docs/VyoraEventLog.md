# Vyora Event Log

> **Status:** ✅ Implemented (ARCH-002) · **Scope:** internal architecture — no UI change, no
> workflow change · **Storage format change + migration: yes** (unavoidable; see §3) ·
> **Last Updated:** 2026-08-01

Every change to a merchant's ledger is an event. The event log is what lives on the device; ledger
state is derived from it.

- **Source:** [`lib/vyora/events.ts`](../lib/vyora/events.ts) · persistence in
  [`lib/vyora/store.ts`](../lib/vyora/store.ts)
- **Tests:** [`tests/vyora/events.test.ts`](../tests/vyora/events.test.ts)
- **Builds on:** [Ledger Engine v2](VyoraLedgerEngine.md) (ARCH-001), unchanged by this milestone

---

## 1. The model

```
LedgerEvent[]  ──reduceEvents──►  VyoraData  ──buildLedger──►  Ledger  ──►  screens
  (persisted)                    (projection)                 (indexes)
```

`VyoraData` is no longer stored. It is a **projection** — a fold of the log — and the ARCH-001
index engine derives from it exactly as before. That layering is deliberate: ARCH-002 slots in
_underneath_ ARCH-001 without touching it, and no screen changed.

Both derivations stay incremental on the capture path. Recording a credit folds one event into the
previous projection and one entry into the previous indexes. The log is never re-read and the ledger
is never re-derived to record an entry, so capture speed does not decay as the log grows.

### The rules that make replay safe

- `applyEvent` is **pure and total**. Every event type has a case, and an unrecognised one (a log
  written by a newer build) leaves state untouched rather than throwing into a merchant's screen.
- **No ambient state inside the fold.** No clocks, no randomness, no id generation. Every value an
  event needs — ids, timestamps, the resolved date — is captured when the event is _created_. This
  is what makes "fold the same log twice, get the same state" true rather than aspirational.

## 2. The events

| Event              | Effect on state                         | Producer today                                        |
| ------------------ | --------------------------------------- | ----------------------------------------------------- |
| `ContactCreated`   | appends a contact                       | ✅ contact creation, and inline create during capture |
| `ContactUpdated`   | sets only the fields it carries         | ❌ none — no rename/edit UI exists (Mission C1)       |
| `ContactDeleted`   | removes the contact **and its entries** | ❌ none — no contact delete exists                    |
| `CreditRecorded`   | appends a transaction                   | ✅ Record credit                                      |
| `PaymentRecorded`  | appends a payment                       | ✅ Record payment                                     |
| `DueDateChanged`   | sets or clears a due date               | ❌ none — no edit UI exists (Mission C1)              |
| `EntryDeleted`     | removes a transaction or payment by id  | ✅ delete from a statement row                        |
| `BackupCreated`    | **none** — audit only                   | ❌ none — no backup exists (Mission E1)               |
| `RestoreCompleted` | replaces the projection with a snapshot | ❌ none — no restore exists (Mission E1)              |
| `ImportCompleted`  | replaces the projection with a snapshot | ❌ none — no import exists (Mission E1)               |

**Six of the ten have no producer yet, and that is a deliberate call rather than an oversight.**
Unlike an in-memory index, the log is a _persisted format_: once merchants have logs on disk, adding
event types later means version negotiation. Fixing the vocabulary now is cheap; changing it later
is not. To keep this from being untested dead code, **every reducer case is exercised directly in
the test suite** — a reducer only needs an event, not a producer.

`ContactDeleted` removing entries as well is a **product assumption worth confirming**: leaving them
behind would drop their value from the dashboard (totals derive from contacts) while they stayed
visible in the timeline — a balance the merchant could not reconcile.

## 3. Storage and migration

| Key               | Contents                                            | Written?                            |
| ----------------- | --------------------------------------------------- | ----------------------------------- |
| `vyora.events.v2` | `{version: 2, events: [...]}` — the source of truth | yes                                 |
| `vyora.alpha.v1`  | the pre-ARCH-002 state blob                         | **never** — read once for migration |
| `vyora.clock.v1`  | how far this browser's clock has counted            | yes — on every write                |

### `vyora.clock.v1` — why the clock has a floor on disk

`createdAt` resolves to the millisecond, and minting an event is pure JavaScript with no I/O between
two of them, so entries recorded back to back collided **294 times in 300**. The timeline breaks a
tie in favour of the transaction side, which is right when the credit really was first and wrong
when it was not — a payment recorded first then folded second gives the merchant a running balance
that never happened.

So the clock (`lib/vyora/clock.ts`) never mints the same instant twice, and the floor is persisted
here so a reload — or a device clock moved backwards — cannot reissue one already spent.

- It is **not in the log**, because how far a clock has counted is not a ledger fact.
- It is **not in an export**, because a backup must not carry another device's clock.
- It **survives "erase all my data"**, like the PWA flags: it is a fact about this browser, and
  keeping it is strictly safer than dropping it.
- A device with entries but no floor falls back to the highest event `at` in its **own log** — never
  to an entry's `createdAt`, which an imported backup supplies from the exporting device.

The provider seeds the clock before anything can be recorded and writes the floor **before**
`saveLog`, and even if that write fails: a floor without its entries wastes an instant, which
nothing can perceive; entries without their floor let the next load reissue one.

### Two tabs — a hazard that predates all of this

`saveLog` writes the **whole log** from one tab's memory, and there is no `storage` listener, no
`BroadcastChannel` and no `navigator.locks` anywhere in `VyoraProvider`. Two open tabs therefore
**lose data outright**: whichever saves last overwrites everything the other recorded since both
loaded. This is not caused by the clock work — it has always been true and was simply never written
down.

It also bounds the clock guarantee, and the bound is worth stating precisely rather than glossing:

- Two tabs cannot read-modify-write the floor atomically, so in principle they can mint the same instant.
- In practice that collision **cannot reach a stored ledger**, because a persisted log only ever contains one tab's writes since its last load — the other tab's entries are already gone. Concurrent tabs destroy entries rather than misorder them.

So the guarantee is **per log**: within any log that actually exists on disk, no two entries share a
`createdAt`. Making concurrent tabs safe is a separate problem, and a real one.

On first read of a device still holding v1 state, `migrateLegacyData` converts it into the log that
folds back to exactly that state, persists it under the v2 key, and **leaves the v1 key untouched**.
If anything about v2 goes wrong, the merchant's original data is still sitting there.

Two details that matter:

- **Array order is preserved.** The index engine merges the two entry arrays in O(N) on the
  assumption that each is `createdAt`-ascending, which the append-only v1 store guaranteed.
  Re-ordering during migration would silently cost that. Tests assert order survives.
- **Each migrated event carries the entity's own `createdAt`**, not the upgrade time, so a migrated
  log reads as the history it actually was.

**Explicit erase removes both keys.** Non-destructive migration is about automatic version upgrades;
"erase all my data on this device" is not a migration. Leaving v1 behind would both resurrect the
data on the next load and ignore what the merchant asked for.

## 4. What the log buys

- **Audit trail.** `eventsForParty(events, id)` returns every event that touched one contact.
  _Limitation:_ `EntryDeleted` and `DueDateChanged` identify an entry, not a contact, so they do not
  appear in a contact's trail without resolving the entry first.
- **Undo.** `revertLastEvent` drops the last event and re-folds. Correct _because_ the log is
  append-only — there is no per-action inverse to write and keep in sync. The primitive exists; no
  UI consumes it (ARCH-002 forbids UI changes).
- **Timeline.** The log is ordered history, exposed on the provider as `events`.
- **Future sync / cloud / conflict resolution.** Two devices exchanging append-only events can
  converge; two devices exchanging mutable state cannot. **No sync, cloud, network, or backend code
  ships here, and none is planned** — cloud remains an evidence-gated spike per `ProgramPlan.md`.
  This milestone only removes the data model as the thing that would block it.

## 5. The cost: the log only grows

This is the real trade and it should not be buried. Previously a delete _removed_ bytes; now it
_adds_ a tombstone. `localStorage` is a hard ~5 MB — **shared across the whole `esytol.com` origin**,
not reserved for Vyora.

Rough arithmetic: a `CreditRecorded` event serialises to ~330 bytes (event id + timestamp + the
transaction). That puts the ceiling near **~15,000 events** before quota pressure, against ~25,000
entries under the old state-only format. A single merchant recording 20 entries a day reaches that
in about two years.

Mitigations, in order of preference:

1. `compactEvents(events)` folds the log down to the shortest log producing the same projection —
   tombstones and audit notes dropped. It **discards the audit trail**, so it is deliberately _not_
   automatic: that is a product decision, not an engine one.
2. Writes already fail safe. `saveLog` returns `false` on quota exhaustion and never crashes a
   screen — but the merchant is not yet _told_. **That gap is real**: a silent write failure means
   entries appear saved and are lost on reload. Surfacing it needs UI, which ARCH-002 excludes.
   Flagged as a known limitation, not fixed here.

## 6. Developer guide

**Adding a new kind of change**

1. Add the event interface and put it in the `LedgerEvent` union.
2. Add a `create…` constructor — the **only** place that event is minted, and the only place a
   clock or id generator may be touched.
3. Add its `applyEvent` case. Keep it pure; keep the switch total.
4. Test the reducer case directly, even with no producer.
5. If it is a clean single-entry append, pass a `LedgerAppend` to `commit` so the ledger folds
   incrementally; otherwise omit it and the ledger rebuilds.

**Recording something from a screen** — nothing changed. `useVyora()` still exposes `recordCredit`,
`recordPayment`, `createParty`, `deleteEntry`, `reset`, plus `ledger` and now `events`.

**Reading** — unchanged; go through the ARCH-001 indexes. Never fold the log in a screen.

```bash
npm run test:run    # domain + ledger + event-log suites
npm run validate    # type-check → lint → format:check → tests → build
```

## 7. Deliberately not built

- **Sync, cloud, conflict resolution.** Named as _benefits_ in the brief; they are enabled, not
  implemented. Building them would mean a backend and light identity, which `ProgramPlan.md` gates
  behind pilot evidence and the product principles rule out by default.
- **Undo UI, timeline screen, audit screen.** ARCH-002 states no UI changes. The primitives exist
  and are tested; nothing renders them.
- **Automatic compaction.** Needs a policy (when, and what the merchant is told about losing
  history) — a product decision.
- **Per-device identity / vector clocks.** Genuine conflict resolution needs them. Adding them now
  would be guessing at a sync design that does not exist.

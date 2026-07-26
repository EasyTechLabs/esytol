# Vyora — Ledger Event Log (ARCH-002)

**Objective:** every change becomes an event; the ledger state is **derivable from
the events**. Foundation for a perfect audit trail, richer timeline/undo, and future
sync / cloud / conflict resolution. **No UI changes, existing workflows unchanged.**

---

## 1. Model

`lib/vyora/events.ts` defines an append-only, typed event log stored on `VyoraData`
(`events?: LedgerEvent[]` — optional, migration-safe).

**Events**

| Event                     | Payload                             | Emitted by                                                     |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `ContactCreated`          | `party`                             | createParty · new-contact on credit/payment · restore          |
| `ContactUpdated`          | `partyId`, `patch{name,phone,note}` | editParty                                                      |
| `CreditRecorded`          | `transaction`                       | recordCredit · restore                                         |
| `PaymentRecorded`         | `payment`                           | recordPayment · restore                                        |
| `DueDateChanged`          | `transactionId`, `dueDate?`         | (reserved — no edit-due-date workflow yet)                     |
| `ContactDeleted`          | `partyId`                           | deleteContact                                                  |
| `EntryDeleted`            | `entryId`                           | deleteEntry                                                    |
| `BackupCreated`           | —                                   | backup (audit only)                                            |
| `RestoreCompleted`        | `snapshot`                          | restore (checkpoint)                                           |
| `ImportCompleted`         | `snapshot`, `summary`               | file import + Import Wizard (checkpoint)                       |
| `Checkpoint` _(internal)_ | `snapshot`                          | compaction · integrity repair · demo seed/reset · initial seed |

Each event carries an `id` and `at` (ISO timestamp).

---

## 2. State is derived from events

**`reduceEvents(events) → { parties, transactions, payments }`** folds the log:
a checkpoint (or import/restore) **resets** state to its snapshot; every other event
applies its **delta**. This is the proof that the active ledger is a pure function of
the event log.

```
∀ history:  reduceEvents(history)  ===  the materialized { parties, transactions, payments }
```

**Design — materialized projection + log of record.** The materialized arrays on
`VyoraData` are kept as a fast working projection (so mutations stay O(1), the Ledger
Engine reads them unchanged, and **no UI/workflow changes**). The event log is the
append-only record of truth, written in lock-step with every mutation. The regression
tests prove the two are always consistent — including deriving the **full 120-contact
/ 2,200-transaction demo shop** byte-for-byte from a single checkpoint.

**Checkpoints keep the log self-sufficient and bounded.** Bulk operations
(import / restore / demo / integrity repair) and compaction write one `Checkpoint`
that carries a full snapshot and subsumes prior events. On first load, pre-event data
(upgraded users) is seeded with a checkpoint so the log is self-sufficient from day
one. Past `EVENT_LOG_CAP` (1,000) events the log auto-compacts to a checkpoint —
storage stays bounded; state stays derivable.

---

## 3. Benefits unlocked

- **Perfect audit trail** — every change is a typed, timestamped event.
- **Timeline** — the log _is_ the history (richer than reconstructing from records).
- **Undo** — snapshot-undo already reverts the log with the state; event granularity
  enables per-event undo/redo next.
- **Future sync / cloud** — events are the natural unit to append + ship. A device
  sends its new events; a server appends them.
- **Conflict resolution** — append-only, id + timestamped events are mergeable
  (last-writer / CRDT strategies) far more cleanly than diffing snapshots.

---

## 4. No behaviour change — proof

Events are **additive metadata**. The materialized `parties`/`transactions`/`payments`
the Ledger Engine and every screen read are byte-identical to before, so:

- The full suite (**2,051 tests**) passes unchanged — including the ARCH-001 engine
  equivalence tests — proving no merchant-visible number moved.
- `tests/vyora/events.test.ts` proves derivation: a CRUD event stream reduces to the
  expected ledger; `ContactDeleted` cascades to entries; `DueDateChanged` patches;
  checkpoints reset + continue; `BackupCreated` is audit-only; and a checkpoint
  derives the whole demo shop byte-for-byte.

`npm run validate` green: tsc + lint + 2,051 tests + build. Traceability: ARCH-002.

---

## 5. Developer notes

- **Adding a mutation:** emit its event in the provider action alongside the commit
  (`logEvent(next, { type: … })`), and — if it's a bulk/wholesale change —
  `checkpoint(next, …)` instead. Cover the new event in `reduceEvents` + a derivation
  test.
- **Reading the log:** `data.events` (append-only). `reduceEvents(data.events)` gives
  the derived state; `compactEvents(data, id, at)` snapshots + compacts.
- **Undo** commits a prior full snapshot (which includes its own `events`), so the log
  reverts consistently with the state.

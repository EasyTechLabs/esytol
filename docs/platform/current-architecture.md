# Current Architecture — Vyora as it exists today

> Factual description of the shipped implementation at commit `ab015aa`, 2026-08-05.
> No proposals here; see `target-architecture.md` for the intended future state.

---

## 1. Shape

```
┌───────────────────────────────────────────────┐
│ Next.js App Router  (app/vyora/*)             │
│   10 routes, all client-rendered after mount  │
└───────────────┬───────────────────────────────┘
                │ useVyora()
┌───────────────▼───────────────────────────────┐
│ VyoraProvider  — the single write boundary    │
│   holds { events, ledger }, dispatches cmds   │
└───────────────┬───────────────────────────────┘
                │
   ┌────────────▼─────────────┐
   │ Command Engine           │  validate → execute → emit → CommandResult
   └────────────┬─────────────┘
                │ LedgerEvent[]
   ┌────────────▼─────────────┐
   │ Event Log (append-only)  │  reduceEvents → VyoraData (projection)
   └────────────┬─────────────┘
                │
   ┌────────────▼─────────────┐
   │ Ledger Engine            │  one normalized index set per data version
   └────────────┬─────────────┘
                │
   ┌────────────▼─────────────┐
   │ localStorage (4 keys)    │  the only persistence. No network.
   └──────────────────────────┘
```

## 2. Data flow

**Read:** `localStorage` → `reduceEvents` → `VyoraData` → `buildLedger` → indexes → screens.
Screens read indexes only; none scans the ledger.

**Write:** screen → `dispatch(Command)` → `executeCommand` validates → emits `LedgerEvent[]` →
`applyEvent` folds into the projection → `appendToLedger` folds into the indexes → `saveLog`
persists. A failed persist is reported as `STORAGE_FULL`, never silently.

## 3. The seven frozen layers

| Layer           | Milestone | Guarantee                                                                            |
| --------------- | --------- | ------------------------------------------------------------------------------------ |
| Ledger Engine   | ARCH-001  | one index set per data version; O(N + P log P) build; balances derived, never stored |
| Event Log       | ARCH-002  | append-only; state is a projection; replay is deterministic                          |
| Command Engine  | ARCH-003  | the only mutation path; validates before executing; merchant-readable errors         |
| Workflow Engine | ARCH-004  | explicit state machines; no impossible states                                        |
| Module Registry | ARCH-005  | features declare their own routes/commands; the shell knows none by name             |
| Debug Bus       | ENG-008   | local diagnostics, off by default, nothing leaves the device                         |
| Golden Ledger   | QA-001    | 500-contact / 15,000-entry canonical fixture behind every test                       |

## 4. Domain model

```ts
Party        { id, name, phone?, note?, createdAt }
Transaction  { id, partyId, amount, kind: "given"|"taken", description?, date, dueDate?, createdAt }
Payment      { id, partyId, amount, kind: "received"|"paid", note?, date, createdAt }
VyoraData    { version, parties[], transactions[], payments[] }   // a PROJECTION, not stored
```

**Direction lives on the entry, not the party.** One contact can be a customer and a supplier in the
same book. This is the most important modelling fact for any future API.

## 5. Event vocabulary

`ContactCreated` · `ContactUpdated` · `ContactDeleted` · `CreditRecorded` · `PaymentRecorded` ·
`DueDateChanged` · `EntryDeleted` · `ContactReminded` · `DayClosed` · `BackupCreated` ·
`RestoreCompleted` · `ImportCompleted`

`applyEvent` is **pure and total** — an unrecognised event from a newer build leaves state untouched
rather than throwing. Nothing ambient (clock, randomness, id generation) runs inside the fold, which
is what makes replay deterministic.

## 6. Command surface

`CreateContact` · `RecordCredit` · `RecordPayment` · `DeleteEntry` · `DeleteContact` ·
`RestoreEntry` · `RecordReminder` · `CloseDay` · `ImportLedger` · `ExportLedger` · `BackupLedger`

Every command returns `CommandResult` — `{ ok: true, value, events }` or `{ ok: false, error }`.
A rejected command emits **nothing**.

## 7. Performance (measured, ENG-010)

| Entries | Cold start (replay + index build) |
| ------- | --------------------------------- |
| 2,000   | 2.55 ms                           |
| 10,000  | 10.83 ms                          |
| 20,000  | 22.13 ms                          |

Replay is O(E). At 20,000 entries it is 0.49 ms; index build dominates the remainder.

## 8. Offline and PWA

- Service worker scoped to `/vyora/` only — the rest of the esytol origin is untouched
- Static offline page with no framework dependency
- Update banner; **never** auto-refreshes
- Manifest declared in `app/vyora/layout.tsx`, not the root layout

## 9. What does not exist today

No server · no database · no account · no login · no session · no API · no sync · no telemetry ·
no analytics · no multi-device support · no cross-device conflict resolution.

**Every one of these is deliberate**, documented in `vyora/README.md` and `ProgramPlan.md`, and
validated by the discovery mission's finding that merchants' primary objection to existing apps is
data leaving their phone.

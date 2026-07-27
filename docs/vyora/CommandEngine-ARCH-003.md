# Vyora — Command Engine (ARCH-003)

**Objective:** no UI mutates the store directly. Every ledger change goes through a
**command** with one shape — **Validate → Execute → Emit Event → Return Result**.

---

## 1. Audit — starting point

Verified before building: **no component imports store mutations or writes the ledger
store** (`vyora.alpha.v1`) directly. Components already call provider actions; the
provider was the sole mutation path. The direct `localStorage` writes that exist in
components are **auxiliary UI keys** — entry drafts, contact filters, recent searches,
install/tour dismiss flags, the day-closing log — _not_ the ledger (see §5).

ARCH-003 formalises the mutation path into an explicit, pure Command Engine.

---

## 2. The commands

`lib/vyora/commands.ts` — each command is a **pure function** `(data, input, ctx) →
CommandResult` and follows the same four steps:

```ts
export type CommandResult<V = void> =
  | { ok: true; data: VyoraData; value: V } // Execute → next data + Return value
  | { ok: false; error: string }; // Validate failed → no mutation
```

| Command         | Validates          | Emits                                      |
| --------------- | ------------------ | ------------------------------------------ |
| `createContact` | name required      | `ContactCreated`                           |
| `recordCredit`  | amount > 0         | `ContactCreated?` + `CreditRecorded`       |
| `recordPayment` | amount > 0         | `ContactCreated?` + `PaymentRecorded`      |
| `deleteEntry`   | entry exists       | `EntryDeleted`                             |
| `deleteContact` | contact exists     | `ContactDeleted`                           |
| `restoreEntry`  | trash entry exists | re-add events per record                   |
| `importLedger`  | —                  | `ImportCompleted` (checkpoint)             |
| `exportLedger`  | —                  | _(none — read + counter, no state change)_ |
| `backupLedger`  | —                  | `BackupCreated`                            |

Event id/timestamp come from an injected `CommandCtx` (`{ newId, now }`), so commands
are deterministic and unit-testable. Events use the ARCH-002 log + compaction, so
**the state a command produces is derivable from the events it emits** — proven.

---

## 3. Dispatch

The provider is now a thin **dispatcher**. Each action builds the command, runs it,
and on success commits; on a validation failure it surfaces the error and does not
mutate:

```ts
const r = recordCreditCmd(data, input, cmdCtx);
if (!r.ok) {
  toast.info(r.error);
  return "";
}
commit(r.data); // the only place the store is written
return r.value;
```

Components are unchanged — they still call `useVyora().recordCredit(...)` etc. The
public action signatures and behaviour are identical; only the internals moved into
commands. `commit → saveData` remains the single writer of the ledger store.

---

## 4. Regression tests

`tests/vyora/commands.test.ts` covers: validation rejections (empty name, non-positive
amount, deleting/restoring a missing record), execute+emit+return for each command,
and — tying ARCH-002 together — that after a sequence of commands
`reduceEvents(data.events)` equals the produced ledger.

The **full suite (2,059 tests) passes unchanged** — including the ARCH-001 engine
equivalence and ARCH-002 derivation tests — proving the refactor moved logic without
changing any merchant-visible behaviour.

`npm run validate` green: tsc + lint + 2,059 tests + build. Traceability: ARCH-003.

---

## 5. Scope note (honest)

The Command Engine governs the **ledger** — the data of record. Auxiliary UI state
still uses `localStorage` directly in a few components (entry drafts, contact filters,
recent searches, install/tour dismiss flags, the day-closing log). These are
component-local, non-shared, non-audited UI preferences — not the ledger — so they are
intentionally out of the command path. Routing them through a small `uiStorage`
wrapper for strict "no component touches localStorage" compliance is a clean, low-risk
follow-up if desired.

**Not yet commands:** `editParty` (ContactUpdated), backup-file `restore` / file
`applyImport` (RestoreCompleted/ImportCompleted checkpoints), `updateSettings`, and
demo seed/reset still run as provider actions (they already validate/execute/emit
events centrally). They can be migrated to the command form for full uniformity.

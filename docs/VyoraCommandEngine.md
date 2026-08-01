# Vyora Command Engine

> **Status:** ✅ Implemented (ARCH-003) · **Scope:** internal architecture — no storage format
> change, no data migration · **Last Updated:** 2026-08-01

The only way to change a merchant's ledger. Every command runs the same four steps —
**validate → execute → emit events → return a result**.

- **Source:** [`lib/vyora/commands.ts`](../lib/vyora/commands.ts)
- **Tests:** [`tests/vyora/commands.test.ts`](../tests/vyora/commands.test.ts)
- **Builds on:** [Event Log](VyoraEventLog.md) (ARCH-002) → [Ledger Engine v2](VyoraLedgerEngine.md)
  (ARCH-001), neither changed by this milestone

---

## 1. Why

Before ARCH-003 the business rules lived in the screens. `CreditEntry.tsx` decided that an amount
had to be positive and a contact name non-empty — and nothing else did. That put a rule in a
component, made it unenforceable from anywhere except that one form, and meant every future screen
had to remember it.

Now `validateCommand` is the single statement of what is allowed, and it is used **twice**: to decide
whether the save button is live, and to guard execution. The button and the guard cannot disagree,
because they are the same function.

```
Command ──validate──► execute ──► LedgerEvent[] ──► VyoraData ──► Ledger ──► screens
             │
             └──► CommandError (plain language, no events emitted)
```

`executeCommand` performs **no I/O**. It reads a context and returns events plus a value; persisting
is the provider's job. That is what makes the whole rule set testable without a browser.

## 2. The commands

| Command         | Emits                                           | Returns                            |
| --------------- | ----------------------------------------------- | ---------------------------------- |
| `CreateContact` | `ContactCreated`                                | the contact                        |
| `RecordCredit`  | `ContactCreated`? + `CreditRecorded`            | the contact                        |
| `RecordPayment` | `ContactCreated`? + `PaymentRecorded`           | the contact                        |
| `DeleteEntry`   | `EntryDeleted`                                  | the entry id                       |
| `DeleteContact` | `ContactDeleted`                                | id + how many entries went with it |
| `RestoreEntry`  | `CreditRecorded` / `PaymentRecorded` (replayed) | the entry id                       |
| `ImportLedger`  | `ImportCompleted`                               | contact + entry counts             |
| `ExportLedger`  | **nothing**                                     | `{fileName, contents}`             |
| `BackupLedger`  | `BackupCreated`                                 | `{fileName, contents}`             |

**A rejected command emits nothing at all.** Half-applied writes are how a ledger silently stops
adding up, so every command is tested for it rather than trusted.

**`RecordCredit` / `RecordPayment` create-or-reuse the contact** — typing a known name records
against that contact instead of minting a duplicate ledger for the same person. That is the Alpha
capture behaviour, moved out of the store and into a rule.

**`RestoreEntry` is only possible because ARCH-002 keeps history.** A deleted entry's original
recording event is still in the log, so restoring re-emits the original row — same id, date and
amount — rather than asking the merchant to retype what they lost. The replayed event gets a fresh
event id and timestamp, because the restore genuinely happened now.

**Export emits nothing; Backup does.** Export is a read — recording an event every time a merchant
looks at their own data would grow the log without adding history. "I took a backup" is
`BackupLedger`'s job. Both share one serializer. _This split is a judgement call and worth
confirming._

## 3. Errors are written for a shopkeeper

`CommandError` carries a stable `code` for machines and a `message` for the merchant. The message is
plain language and never leaks the code:

| Situation                                | Message                                           |
| ---------------------------------------- | ------------------------------------------------- |
| amount is 0, negative or not a number    | Enter an amount greater than ₹0.                  |
| no contact name                          | Enter a name.                                     |
| malformed date                           | Pick a valid date.                                |
| entry already deleted                    | That entry is no longer here.                     |
| restoring an entry whose contact is gone | Add the contact back before restoring this entry. |
| a file that is not a Vyora backup        | That file is not a Vyora backup.                  |

`field` says which input to point at, so a screen can highlight it without knowing the rule.

## 4. The rule, enforced as a test

"No component should write localStorage or store directly" is a convention until something checks
it. `commands.test.ts` reads the actual source of every file under `features/vyora` and `app/vyora`
and fails if any of them:

- mentions `localStorage`,
- imports `@/lib/vyora/store` anywhere except the single write boundary
  (`features/vyora/VyoraProvider.tsx`),
- mints an event directly instead of dispatching a command.

## 5. Using it

```tsx
const { dispatch, canRun } = useVyora();

const command: Command = {
  type: "RecordCredit",
  contactName: name,
  amount: Number(amount),
  kind: "given",
};

<BigButton disabled={!canRun(command)} onClick={() => dispatch(command)}>
  Save
</BigButton>;
```

`dispatch` returns the `CommandResult`. Screens currently check `.ok` and move on; **no screen yet
renders `error.message`** — see limitations.

**Adding a command:** add it to the `Command` union, add a `validateCommand` case, add an
`executeCommand` case returning `succeed(value, events)`, and test both the rejection and the
success. If it emits a clean single-entry append, the provider's `toLedgerAppend` gives it the
incremental ledger path automatically.

## 6. Deliberately not built

- **No screen renders `error.message` yet.** Validation now produces good merchant-facing text, but
  the entry screens still only disable the button — the message is computed and dropped. Wiring it
  up is UI work worth doing next; the strings are already there.
- **`reset` is not a command.** "Erase everything on this device" clears the log rather than
  appending to it, so it does not fit the validate-execute-emit shape. It stays on the provider.
- **`DeleteContact`, `RestoreEntry`, `ImportLedger`, `ExportLedger`, `BackupLedger` have no UI.**
  They are fully implemented and tested; no screen calls them, because ARCH-003 asked for the engine,
  not the surfaces. `RestoreEntry` in particular is what an undo affordance would sit on.

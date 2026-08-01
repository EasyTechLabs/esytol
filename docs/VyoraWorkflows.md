# Vyora Workflow State Machines

> **Status:** ✅ Implemented (ARCH-004) · **Scope:** internal architecture + the two entry screens ·
> **No storage format change, no data migration** · **Last Updated:** 2026-08-01

Every workflow that writes to the ledger is one explicit machine.

- **Machine:** [`lib/vyora/workflow.ts`](../lib/vyora/workflow.ts) (pure)
- **React binding:** [`features/vyora/useWorkflow.ts`](../features/vyora/useWorkflow.ts)
- **Tests:** [`tests/vyora/workflow.test.ts`](../tests/vyora/workflow.test.ts)
- **Builds on:** [Command Engine](VyoraCommandEngine.md) (ARCH-003) → [Event Log](VyoraEventLog.md)
  (ARCH-002) → [Ledger Engine v2](VyoraLedgerEngine.md) (ARCH-001)

---

## 1. The machine

```
idle ──edit──► editing ⇄ valid ──submit──► saving ──resolved──► success
                  ▲                            │                   │
                  └──────── edit ──── failure ◄┘                 undo
                                                                    │
                                                        idle ◄── undone
```

**No boolean explosion.** Credit entry would otherwise carry `isSaving`, `isValid`, `hasSaved`,
`hasFailed`, `isUndoing` — five booleans, 32 combinations, six of them legal. Here the state _is_
the status, and the data each status needs travels with it.

**No impossible states**, by construction and asserted by an exhaustive sweep over every
(state × event) pair:

| Invariant                                             | How                                                |
| ----------------------------------------------------- | -------------------------------------------------- |
| a `valid` draft never carries an error                | only `editing` and `failure` have an `error` field |
| `editing` always says why                             | `error` is required, not optional                  |
| `undo` never exists without something to undo         | it carries a non-null `undoCommand`                |
| an in-flight write cannot be edited underneath itself | `saving` and `undo` ignore `EDIT`                  |
| a write cannot start twice                            | `SUBMIT` is accepted only from `valid`             |
| a result cannot arrive for a write that never started | `RESOLVED` is accepted only from `saving`          |

Any event that is not legal in the current state returns the state **unchanged** — an ignored
transition, never an invalid one.

`transition(state, event, rules)` is pure: no React, no dispatch, no I/O. The rules it needs (is
this draft valid? what would undo this?) are injected, which is why one machine drives all four
workflows.

## 2. About `saving`

Dispatch is **synchronous** — Vyora is local-first and there is no network to wait for — so
`useWorkflow` runs SUBMIT and RESOLVED back to back and commits only the final state. **`saving`
never paints.** It is modelled anyway because it is what makes a double submit impossible, and it is
the seam an async write would use later without touching a screen.

One caveat the machine alone cannot cover: `state` inside the hook is a render-time value, so two
`submit()` calls in the _same tick_ would both read `valid`. `useWorkflow` holds a `useRef` latch for
exactly that window; the machine handles every later one.

## 3. The four workflows

| Workflow          | Draft                                       | Command         | Undo                          |
| ----------------- | ------------------------------------------- | --------------- | ----------------------------- |
| `creditWorkflow`  | contact, amount, kind, note, date, due date | `RecordCredit`  | delete the entry just created |
| `paymentWorkflow` | contact, amount, kind, note, date           | `RecordPayment` | delete the entry just created |
| `importWorkflow`  | file payload                                | `ImportLedger`  | **none**                      |
| `backupWorkflow`  | _(nothing)_                                 | `BackupLedger`  | **none**                      |

**Undo is derived from the events the command emitted**, not its return value — capture commands
return the _contact_, so the entry id comes from the `CreditRecorded` / `PaymentRecorded` event. That
only works because ARCH-002 keeps the events and ARCH-003 hands them back on the result.

**Import and backup report themselves as not undoable** rather than offering an undo that would
quietly do nothing. Undoing an import would need a pre-import snapshot, which nothing captures; a
backup has nothing to reverse.

Validation is **not** re-implemented here — `rules.validate` calls the command engine, so "valid"
means the command would actually be accepted, and the tests assert that against the real engine.

## 4. Using it

```tsx
const definition = useMemo(() => creditWorkflow(todayISO()), []);
const { draft, status, error, canSubmit, edit, submit, reset } = useWorkflow(definition);

<AmountField value={draft.amount} onChange={(amount) => edit({ amount })} />;
{
  status === "failure" && error && <p role="alert">{error.message}</p>;
}
<BigButton disabled={!canSubmit} onClick={submit}>
  Save
</BigButton>;
```

A screen holds no `isSaving` / `hasFailed` flags of its own. Purely presentational state (whether the
optional date fields are expanded) stays local — it is not part of the write.

**Errors now render.** Failures surface the command engine's plain-language message in an
`role="alert"` block. Errors are shown only in `failure`, not `editing` — nagging an untouched form
is worse than a disabled button.

## 5. Deliberately not built

- **Undo has no affordance.** `canUndo` and `undo()` are implemented and tested, but nothing renders
  them. Where undo lives — a toast, a banner, an entry in the statement — is a product decision
  ARCH-004 does not specify, and the two entry screens navigate away on save, so there is no honest
  place to put it without inventing UX. This is the remaining gap.
- **Import and backup have no screens.** Their machines and commands are complete and tested; no UI
  calls them, because ARCH-004 asked for the workflows, not the surfaces.
- **`saving` cannot be observed.** See §2 — correct by design, but no spinner exists because there is
  nothing to wait for.

# Vyora Due Dates & Smart Credit Capture

> **Status:** ✅ Implemented (V2-003) · **Merchant capability:** aging & recovery accuracy (core
> capability 5) · **No new engine, no new index** · **Last Updated:** 2026-08-01

- **Domain:** [`lib/vyora/duedates.ts`](../lib/vyora/duedates.ts) (pure)
- **Tests:** [`tests/vyora/duedates.test.ts`](../tests/vyora/duedates.test.ts)

---

## 1. The problem

Merchants skip due dates because entering one means opening a calendar. Without them, Recovery can
only tell _old_ from _recent_ — never _late_ from _not yet due_. Every improvement to the Recovery
workspace is capped by how many entries carry a real due date.

## 2. What changed for the merchant

**One tap.** `Today · 7 days · 15 days · 30 days · 45 days · Custom` on the credit screen. The
calendar only opens if they ask for it.

**The date, in words.** Instead of "30 days" the screen says **"Due 18 Aug · Tuesday"** — a period
is arithmetic the merchant has to do; a date with a weekday is something they can picture, and
answers "is that a market day?" instantly.

**It remembers, twice over.** The last period chosen becomes the default, _and_ it is remembered
per contact — so a customer who always takes 45 days gets 45 pre-selected next time. The suggested
chip is marked with a dot until a due date is set.

**The statement now reads like a bill.** Every credit shows `Issued …`, and where a due date exists,
`Due 18 Aug · Due in 5 days` or `Overdue by 12 days` in red.

**The dashboard shows what is coming.** Today / This week / Overdue, tapping through to the Recovery
workspace.

## 3. Where the numbers come from

Everything reads the **existing** `DueIndex` (ARCH-001) and the transaction index. The aging
arithmetic is imported from `recovery.ts`, not re-implemented — `duedates.ts` adds presentation and
totals, no second source of truth.

| Surface                | Reads                                                 |
| ---------------------- | ----------------------------------------------------- |
| Credit chips + preview | pure date maths + settings                            |
| Statement due line     | `transactionsByParty` (existing index)                |
| Dashboard totals       | `due.dueDatesAscending` + `due.transactionsByDueDate` |
| Recovery               | `earliestDueDateByParty` — unchanged from V2-001      |

## 4. Two honesty rules kept in code

**Nothing estimated is ever called overdue.** Only a real due date that has passed earns the word.
An undated credit still ages — it is labelled "45d old", stays in bucket `current`, and reports
`daysOverdue: 0`. Tested against the Golden Ledger across every contact.

**Dashboard figures are scheduled credit, not unpaid balances.** Vyora does not allocate payments to
individual entries, so a partly-settled credit still shows its full face value in "coming due". The
card says so in its caption rather than implying an outstanding figure.

## 5. Where the per-contact preference lives

In **settings** (`contactCreditDays`, keyed by contact id), not on `Party`.

Putting it on the contact would mean changing `types.ts` and the `ContactUpdated` event payload —
i.e. touching two frozen layers for a convenience default. The trade-off is stated plainly below.

## 6. Known limitations

- **Per-contact credit periods do not travel with an export.** They are a device preference, not a
  ledger fact, so restoring a backup on a new phone restores the ledger but not these defaults.
  Moving them onto `Party` would fix it and would require unfreezing the schema — **your call.**
- **Existing entries have no due dates.** This makes _new_ capture better; it cannot retro-fit
  history. Recovery stays age-based for older rows until they settle.
- **Dashboard "coming due" counts face value**, not remaining balance — see §4.
- **No per-entry settlement**, so "overdue" is a property of the account's oldest due date, not of a
  specific unpaid invoice. Right for a chase list, wrong for a legal statement.
- **The spec's example read "Due 18 Aug · Thursday"** — 18 Aug 2026 is a Tuesday. The code computes
  the real weekday; the example was illustrative.

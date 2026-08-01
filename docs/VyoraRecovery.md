# Vyora Recovery Workspace

> **Status:** ✅ Implemented (V2-001) · **Merchant capability:** recover money (core capability 5+6) ·
> **Last Updated:** 2026-08-01

- **Domain:** [`lib/vyora/recovery.ts`](../lib/vyora/recovery.ts) (pure)
- **Screen:** [`features/vyora/screens/Recovery.tsx`](../features/vyora/screens/Recovery.tsx) · route
  `/vyora/recovery`
- **Tests:** [`tests/vyora/recovery.test.ts`](../tests/vyora/recovery.test.ts) — run against the
  [Golden Ledger](VyoraGoldenLedger.md)

---

## 1. The merchant problem

A merchant knows _someone_ owes them; they don't know _who first_. Today that means opening
Contacts, tapping into each statement, doing arithmetic in their head, and trying to remember
whether they already called. So they chase whoever they happen to think of — usually not the
biggest, oldest or most winnable.

**One screen now answers all of it:** who · phone · outstanding · age · priority · last payment ·
last reminder · what to do next. Statement, message and call history expand in place.

## 2. Priority — deterministic, no AI

A fixed weighted score out of 100. Same ledger, same order, every time.

| Component             | Weight | Score                                                                     |
| --------------------- | ------ | ------------------------------------------------------------------------- |
| **Outstanding**       | 40%    | relative to the largest debt in _this_ merchant's list                    |
| **Aging**             | 30%    | days, saturating at 90                                                    |
| **Payment behaviour** | 20%    | days since their last payment, saturating at 90; **never paid = full 20** |
| **Reminder recency**  | 10%    | days since last reminder, saturating at 14; **never reminded = full 10**  |

Two consequences worth knowing:

- **Reminder recency scores _low_ when recent** — a contact reminded today drops the whole 10 points,
  so the list stops pushing someone the merchant just called. Calling twice in a day costs goodwill.
- **Outstanding is scored relative to the merchant's own biggest debt**, so the scale means the same
  thing on a ₹5,000 ledger and a ₹5,00,000 one.

Ties break on outstanding, then contact id — stable across runs rather than dependent on how the
ledger happened to be built. The screen shows the score, and the breakdown is on the badge tooltip,
so the order is never a mystery.

**Aging counts undated credit too.** A credit with no agreed due date is _old_, not _late_ — it is
labelled "45d old", never "45d overdue", but it still scores. Due dates are optional and rarely
filled today; scoring only formal overdue would give almost every row zero there and collapse the
list to "biggest first". **This is a product judgement worth confirming.**

## 3. Messages — three tones, all safe

`gentle` · `normal` · `firm`. All three name the person and the amount, state the due date and last
payment when known, and ask politely. **Firm is direct, not aggressive.**

The standing test is _"would you be comfortable sending this to a customer you can't afford to
lose?"_ A test asserts that no tone contains any of: _legal, police, court, lawyer, notice, cheat,
fraud, shame, defaulter, blacklist, warning, or else, last chance, immediately, consequences,
action will_.

**Vyora never sends anything.** Share hands the text to the merchant's own share sheet
(`navigator.share`, clipboard fallback) — one-way, merchant-sent, no backend, no automated dunning.
Cancelling the share sheet records nothing: "last reminder" must never claim a message that was
never sent.

## 4. What this reused, and the one unavoidable addition

| Layer                          | Used for                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| **Ledger Engine** (ARCH-001)   | outstanding, ranking, statement preview, and `DueIndex` — built then, **first consumed now** |
| **Event Log** (ARCH-002)       | last reminder + full call history, **derived** — so no schema change                         |
| **Command Engine** (ARCH-003)  | `RecordReminder`, validated like every other write                                           |
| **Module Registry** (ARCH-005) | the Recovery module; nav picked it up **without editing the shell**                          |
| **Golden Ledger** (QA-001)     | every test, at 500 contacts / 15,000 entries                                                 |

**Unavoidable addition:** the `ContactReminded` event and the `RecordReminder` command. "Last
reminder" and "call history" cannot exist without recording that a reminder happened, and the Event
Log's documented purpose is exactly this — it is what let the feature ship **without a schema
change**. Both were added through the published extension paths in `VyoraEventLog.md` §6 and
`VyoraCommandEngine.md` §5. No engine was modified, redesigned or replaced.

## 5. Known limitations

- **The shop signature is empty** — there is nowhere to set a shop name (no Settings screen). The
  message omits the signature rather than faking one.
- **Sharpness depends on due dates**, which are optional and rarely filled. WP A1.4 (15/30-day
  presets on credit entry) is what turns this from "mostly aged" into "mostly overdue".
- **Payments are not allocated to specific entries.** Aging uses the oldest due date on the account,
  not per-entry settlement. Right for a chase list, wrong for a legal statement.
- **`paymentHabit` needs 3+ payments** and a clear favourite weekday, or it says nothing rather than
  guessing.
- **No bulk actions** — reminders are one contact at a time, by design for now.

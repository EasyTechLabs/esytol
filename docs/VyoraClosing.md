# Vyora Daily Closing

> **Status:** ✅ Implemented (V2-004) · **Merchant capability:** daily loop + cash-flow foresight ·
> **No new engine, no new index** · **Last Updated:** 2026-08-01

- **Domain:** [`lib/vyora/closing.ts`](../lib/vyora/closing.ts) (pure)
- **Screen:** [`features/vyora/screens/Closing.tsx`](../features/vyora/screens/Closing.tsx) · route
  `/vyora/closing`
- **Tests:** [`tests/vyora/closing.test.ts`](../tests/vyora/closing.test.ts)

---

## 1. The problem

Every evening a merchant asks four questions — what came in, what I gave out, what went out, who do
I chase tomorrow. Vyora could answer all four, across four screens, which is why the day never got
closed. Now it is one screen, top to bottom, in the order the questions are asked.

## 2. Where every number comes from

Nothing on this screen is a new calculation:

| Figure                             | Source                                              |
| ---------------------------------- | --------------------------------------------------- |
| Collected · Paid out               | `readDashboardTotals` → statistics index (ARCH-001) |
| Due tomorrow / this week / overdue | `dueSummary` → `DueIndex`                           |
| Who to chase tomorrow              | `buildRecoveryList` (V2-001), same priority order   |
| Today's activity                   | timeline index, filtered to today                   |

**One deliberate exception.** _Credit given on a date_ is the single figure no index carries —
`StatisticsIndex` keeps payments by date but not credits. Building a second index for one screen is
exactly what the freeze forbids, so it is a single linear scan, run once when the merchant opens
closing. Documented rather than hidden.

## 3. `DayClosed` — a signature, not a transaction

Closing a day emits one audit-only event. **No balance moves, no entry is touched**, and a test
asserts the ledger is byte-identical afterwards.

The event carries the summary the merchant actually reviewed. That looks like storing a derived
value, and it is deliberate: **a back-dated entry recorded next week must not silently rewrite a day
already signed off.** That is precisely why a paper book carries a closing entry, and it is tested —
history stays put when a late entry arrives.

Closing the same day twice keeps the latest sign-off.

## 4. Wins are deterministic and never flattering

No AI, no encouragement the numbers do not support. A win appears only when it happened:

- **Collected** — only if money came in
- **Accounts closed** — contacts who paid today and are now at zero
- **Customers added** — contacts created today
- **Recovery rate** — collected today ÷ what was overdue, capped at 100%, and **only shown when
  something was actually overdue**. A percentage out of nothing means nothing.

A quiet day shows no wins at all, which is the honest outcome.

## 5. Notes

Drafts save to the device as the merchant types (`dayNotes`, keyed by date), so they can jot at 4pm
and still be writing at 8pm. On **Finish today** the note is copied into the `DayClosed` event, where
it becomes part of the signed-off record.

## 6. Known limitations

- **Closing history lives on the closing screen, not in Settings.** The brief put it under
  Settings → Closing History; keeping it on `/vyora/closing` means the merchant never leaves the one
  screen the milestone exists to consolidate. Easy to move if you disagree.
- **"Accounts closed" counts contacts at zero who paid today** — it cannot distinguish an account
  settled today from one that was already at zero when a small payment landed. Fixing it properly
  needs per-entry settlement, which Vyora does not do.
- **Upcoming figures are scheduled credit, not unpaid balances** — same caveat as the dashboard, and
  captioned on screen.
- **Notes are per device.** They live in settings, not the ledger, so they do not travel with an
  export. The signed-off copy inside `DayClosed` does.
- **No timezone handling.** "Today" is the device's local date, so a merchant closing after midnight
  closes the new day. Inherited from Alpha, not introduced here.

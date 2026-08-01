/**
 * Vyora — Daily Closing (V2-004).
 *
 * Every evening a merchant asks four questions: what came in, what I gave out,
 * what went out, and who I chase tomorrow. Vyora could answer all four — across
 * four screens. This answers them in one.
 *
 * **Nothing here is a new calculation.** Every figure is read from an existing
 * selector or index:
 *  - money in/out → `readDashboardTotals` (ARCH-001 statistics index),
 *  - what's coming due → `dueSummary` → `DueIndex`,
 *  - who to chase → `buildRecoveryList` (V2-001),
 *  - today's activity → the timeline index.
 *
 * The only pass this module makes over raw rows is the one thing no index
 * carries: credit **given on a specific date**. `StatisticsIndex` keeps payments
 * by date but not credits, and building a second index for one screen would be
 * exactly the architecture the freeze forbids — so it is a single linear scan,
 * run once when the merchant closes the day.
 */

import type { Ledger } from "./ledger";
import type { ActivityItem } from "./types";
import type { LedgerEvent } from "./events";
import type { MerchantSettings } from "./settings";
import { readDashboardTotals } from "./ledger";
import { dueSummary, addDays, type DueSummary } from "./duedates";
import { buildRecoveryList, type RecoveryItem } from "./recovery";

export interface DaySummary {
  readonly date: string;
  /** Payments received today. */
  readonly collected: number;
  /** Credit handed out today. */
  readonly creditGiven: number;
  /** Payments the merchant made today. */
  readonly paidOut: number;
  /** collected − paidOut. What the till actually did. */
  readonly netCash: number;
  /** How the book's receivable moved today: creditGiven − collected. */
  readonly outstandingChange: number;
  readonly entryCount: number;
}

export interface DayWin {
  readonly label: string;
  readonly value: string;
}

export interface DailyClosing {
  readonly date: string;
  readonly summary: DaySummary;
  /** Today's entries, newest first. */
  readonly activity: readonly ActivityItem[];
  readonly tomorrow: readonly RecoveryItem[];
  readonly week: DueSummary;
  readonly dueTomorrowAmount: number;
  readonly dueTomorrowCount: number;
  readonly wins: readonly DayWin[];
  readonly notes: string;
  readonly closed: boolean;
}

function inr(amount: number): string {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

/**
 * The one figure no index carries: credit given, and contacts added, on a date.
 * A single linear pass rather than a second index for one screen.
 */
function scanDay(ledger: Ledger, date: string) {
  let creditGiven = 0;
  let creditCount = 0;
  for (const t of ledger.data.transactions) {
    if (t.date !== date || t.kind !== "given") continue;
    creditGiven += t.amount;
    creditCount += 1;
  }
  let contactsAdded = 0;
  for (const p of ledger.data.parties) {
    if (p.createdAt.slice(0, 10) === date) contactsAdded += 1;
  }
  let paymentCount = 0;
  let settledToday = 0;
  for (const p of ledger.data.payments) {
    if (p.date !== date || p.kind !== "received") continue;
    paymentCount += 1;
    // An account the merchant fully cleared today.
    if ((ledger.balances.netByParty.get(p.partyId) ?? 0) === 0) settledToday += 1;
  }
  return { creditGiven, creditCount, contactsAdded, paymentCount, settledToday };
}

/**
 * Deterministic wins. No AI, no encouragement the numbers do not support — a
 * win is only shown when it actually happened.
 */
function buildWins(
  summary: DaySummary,
  scan: ReturnType<typeof scanDay>,
  overdueAtStart: number
): DayWin[] {
  const wins: DayWin[] = [];
  if (summary.collected > 0) wins.push({ label: "Collected", value: inr(summary.collected) });
  if (scan.settledToday > 0) {
    wins.push({
      label: scan.settledToday === 1 ? "Account closed" : "Accounts closed",
      value: String(scan.settledToday),
    });
  }
  if (scan.contactsAdded > 0) {
    wins.push({
      label: scan.contactsAdded === 1 ? "Customer added" : "Customers added",
      value: String(scan.contactsAdded),
    });
  }
  // Recovery rate: of what was overdue, how much came back today. Only shown
  // when something WAS overdue — a rate out of nothing means nothing.
  if (overdueAtStart > 0 && summary.collected > 0) {
    const rate = Math.min(100, Math.round((summary.collected / overdueAtStart) * 100));
    wins.push({ label: "Recovery rate", value: `${rate}%` });
  }
  return wins;
}

/** Everything the closing screen shows, derived in one place. */
export function buildDailyClosing(
  ledger: Ledger,
  events: readonly LedgerEvent[],
  settings: MerchantSettings,
  today: string
): DailyClosing {
  const totals = readDashboardTotals(ledger, today);
  const scan = scanDay(ledger, today);
  const week = dueSummary(ledger, today);
  const tomorrowDate = addDays(today, 1);

  const summary: DaySummary = {
    date: today,
    collected: totals.todaysCollections,
    creditGiven: scan.creditGiven,
    paidOut: totals.todaysPayments,
    netCash: totals.todaysCollections - totals.todaysPayments,
    outstandingChange: scan.creditGiven - totals.todaysCollections,
    entryCount: scan.creditCount + scan.paymentCount,
  };

  // Who is due TOMORROW, ranked by the same priority the workspace uses.
  const recovery = buildRecoveryList(ledger, events, today);
  const dueTomorrowIds = new Set<string>();
  let dueTomorrowAmount = 0;
  let dueTomorrowCount = 0;
  for (const t of ledger.due.transactionsByDueDate.get(tomorrowDate) ?? []) {
    if (t.kind !== "given") continue;
    dueTomorrowIds.add(t.partyId);
    dueTomorrowAmount += t.amount;
    dueTomorrowCount += 1;
  }
  const tomorrow = recovery.filter((item) => dueTomorrowIds.has(item.party.id));

  return {
    date: today,
    summary,
    activity: ledger.timeline.newestFirst.filter((item) => item.date === today),
    tomorrow,
    week,
    dueTomorrowAmount,
    dueTomorrowCount,
    wins: buildWins(summary, scan, week.overdueAmount),
    notes: settings.dayNotes[today] ?? "",
    closed: events.some((e) => e.type === "DayClosed" && e.date === today),
  };
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface ClosedDay {
  readonly date: string;
  readonly at: string;
  readonly summary: DaySummary;
  readonly notes: string;
}

/**
 * The last N days the merchant signed off, newest first.
 *
 * Read back from the `DayClosed` events rather than recomputed. A day's report
 * is what the merchant actually reviewed when they closed it — back-dating an
 * entry later must not silently rewrite a day they already signed off, which is
 * exactly why a paper book carries a closing entry.
 */
export function closingHistory(events: readonly LedgerEvent[], limit = 30): readonly ClosedDay[] {
  const byDate = new Map<string, ClosedDay>();
  for (const event of events) {
    if (event.type !== "DayClosed") continue;
    // A day closed twice keeps the latest sign-off.
    byDate.set(event.date, {
      date: event.date,
      at: event.at,
      summary: event.summary,
      notes: event.notes,
    });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

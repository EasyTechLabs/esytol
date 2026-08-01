/**
 * Vyora — due dates made effortless (V2-003).
 *
 * Merchants skip due dates because entering one means opening a calendar. So
 * the calendar becomes optional: one tap picks a period, and the app shows the
 * **real date in words** — "Due 18 Aug · Thursday" — because "30 days" is a
 * number a merchant has to translate, and a date is one they can picture.
 *
 * Pure functions over the **existing** `DueIndex` (ARCH-001). No new engine, no
 * new index, no duplicated arithmetic — the aging maths lives in `recovery.ts`
 * and is imported, not re-implemented.
 */

import type { Ledger } from "./ledger";
import { daysBetween } from "./recovery";

/** The one-tap periods, in days. 0 = due today. */
export const CREDIT_PERIODS = [0, 7, 15, 30, 45] as const;
export type CreditPeriod = (typeof CREDIT_PERIODS)[number];

/** The default when a merchant has expressed no preference at all. */
export const DEFAULT_CREDIT_PERIOD: CreditPeriod = 30;

export function periodLabel(days: number): string {
  return days === 0 ? "Today" : `${days} days`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseISO(date: string): Date | null {
  const time = Date.parse(date.length <= 10 ? date + "T00:00:00Z" : date);
  return Number.isNaN(time) ? null : new Date(time);
}

/** `2026-08-01` + 17 → `2026-08-18`. UTC throughout, so no timezone drift. */
export function addDays(fromISO: string, days: number): string {
  const base = parseISO(fromISO);
  if (!base) return fromISO;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export interface DuePreview {
  readonly iso: string;
  /** "18 Aug" */
  readonly short: string;
  /** "Thursday" */
  readonly weekday: string;
}

/**
 * The date a merchant can actually picture.
 *
 * A period alone ("30 days") asks them to do the arithmetic; showing the day of
 * the week too is what makes "is that a market day?" answerable at a glance.
 */
export function previewDueDate(dueISO: string): DuePreview | null {
  const date = parseISO(dueISO);
  if (!date) return null;
  return {
    iso: dueISO,
    short: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`,
    weekday: WEEKDAYS[date.getUTCDay()],
  };
}

/**
 * How long is left, or how late it is.
 *
 * Only ever says "overdue" about a real due date — an undated credit is old,
 * not late, and calling it late would be a lie the merchant might act on.
 */
export function remainingLabel(dueISO: string, today: string): string {
  const days = daysBetween(today, dueISO);
  if (days === 0) return "Due today";
  if (days > 0) return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  const late = -days;
  return late === 1 ? "Overdue by 1 day" : `Overdue by ${late} days`;
}

/** True when a due date has genuinely passed. */
export function isOverdue(dueISO: string, today: string): boolean {
  return daysBetween(today, dueISO) < 0;
}

// ─── Dashboard totals ────────────────────────────────────────────────────────

export interface DueSummary {
  readonly todayAmount: number;
  readonly todayCount: number;
  readonly weekAmount: number;
  readonly weekCount: number;
  readonly overdueAmount: number;
  readonly overdueCount: number;
}

/**
 * What is coming due, straight off `DueIndex`.
 *
 * Only credit the merchant GAVE counts — a supplier's due date is money going
 * out, not money to collect.
 *
 * **These are scheduled amounts, not unpaid balances.** Vyora does not allocate
 * payments to individual entries, so a partly-settled credit still shows its
 * full face value here. Labelled that way on screen rather than implied to be
 * an outstanding figure.
 */
export function dueSummary(ledger: Ledger, today: string): DueSummary {
  const weekEnd = addDays(today, 7);
  let todayAmount = 0;
  let todayCount = 0;
  let weekAmount = 0;
  let weekCount = 0;
  let overdueAmount = 0;
  let overdueCount = 0;

  for (const date of ledger.due.dueDatesAscending) {
    const entries = ledger.due.transactionsByDueDate.get(date) ?? [];
    for (const entry of entries) {
      if (entry.kind !== "given") continue;
      if (date < today) {
        overdueAmount += entry.amount;
        overdueCount += 1;
      } else if (date === today) {
        todayAmount += entry.amount;
        todayCount += 1;
        weekAmount += entry.amount;
        weekCount += 1;
      } else if (date <= weekEnd) {
        weekAmount += entry.amount;
        weekCount += 1;
      }
    }
  }

  return { todayAmount, todayCount, weekAmount, weekCount, overdueAmount, overdueCount };
}

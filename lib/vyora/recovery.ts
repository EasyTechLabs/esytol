/**
 * Vyora — Recovery Workspace (V2-001).
 *
 * The merchant's problem is not missing numbers — it is that the numbers are
 * spread across screens, so they chase whoever comes to mind rather than
 * whoever matters. This turns the whole ledger into one ranked worklist:
 * **who · phone · outstanding · age · priority · last payment · last reminder ·
 * what to do next**, with the statement, the message and the call history one
 * tap away.
 *
 * Reuses the frozen layers, adds none:
 *  - outstanding and ranking read the **Ledger Engine** balance index,
 *  - ages read **DueIndex**, built in ARCH-001 and unused until now,
 *  - last payment reads the transaction index,
 *  - last reminder and call history are **derived from the Event Log**, which is
 *    why none of this needs a schema change: a reminder is an event, not a
 *    column on a contact.
 *
 * Sending is the merchant's own share sheet. **No backend, no network, no
 * automation, no dunning** — Vyora never contacts anyone.
 *
 * Pure functions only. No AI, no ML, no randomness: the same ledger always
 * produces the same list in the same order.
 */

import type { Party, Payment, Transaction } from "./types";
import type { Ledger, StatementRow } from "./ledger";
import type { LedgerEvent } from "./events";

/** Aging buckets, per the MLP epic breakdown (WP A1.1). */
export type AgeBucket = "current" | "0-30" | "30-60" | "60+";

export interface ReminderRecord {
  readonly at: string;
  readonly tone: ReminderTone;
}

/** How each component contributed. Shown to the merchant so the order is never a mystery. */
export interface PriorityBreakdown {
  readonly outstanding: number;
  readonly aging: number;
  readonly behaviour: number;
  readonly reminder: number;
}

export interface RecoveryItem {
  readonly party: Party;
  readonly phone?: string;
  /** Rupees they owe the merchant. Always positive — suppliers never appear. */
  readonly outstanding: number;
  readonly oldestDueDate?: string;
  /** Days past the oldest due date. 0 when nothing is formally late. */
  readonly daysOverdue: number;
  /** Days since the oldest credit was given — available even with no due date. */
  readonly daysOutstanding: number;
  /** The age this row is ranked and labelled by. */
  readonly agingDays: number;
  readonly bucket: AgeBucket;
  readonly lastPaymentAt?: string;
  readonly lastPaymentAmount?: number;
  readonly daysSinceLastPayment?: number;
  readonly lastRemindedAt?: string;
  readonly daysSinceReminder?: number;
  readonly reminderHistory: readonly ReminderRecord[];
  /** 0–100, deterministic. */
  readonly priority: number;
  readonly priorityBreakdown: PriorityBreakdown;
  /** What to do next, in plain words. */
  readonly suggestedAction: string;
  /** e.g. "usually pays on Mondays" — from their own payment history. */
  readonly paymentHabit?: string;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/** Weights, fixed and published. Changing these changes every merchant's worklist. */
export const PRIORITY_WEIGHTS = {
  outstanding: 0.4,
  aging: 0.3,
  behaviour: 0.2,
  reminder: 0.1,
} as const;

/** Scores saturate at these, so one ancient debt cannot flatten the whole list. */
export const AGING_CAP_DAYS = 90;
export const BEHAVIOUR_CAP_DAYS = 90;
export const REMINDER_CAP_DAYS = 14;

function toTime(isoDate: string): number {
  return Date.parse(isoDate.length <= 10 ? isoDate + "T00:00:00Z" : isoDate);
}

/** Whole days from `from` to `to`. Negative means `from` is in the future. */
export function daysBetween(from: string, to: string): number {
  const a = toTime(from);
  const b = toTime(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / DAY_MS);
}

export function bucketFor(days: number): AgeBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "30-60";
  return "60+";
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// ─── Event-log derived facts ─────────────────────────────────────────────────

/**
 * Every reminder the merchant recorded, per contact, oldest first.
 *
 * One pass over the log, so the whole worklist costs O(events) rather than a
 * scan per contact. This is the call history *and* the source of "last
 * reminded" — no field on `Party`, no schema change.
 */
export function remindersByParty(
  events: readonly LedgerEvent[]
): ReadonlyMap<string, ReminderRecord[]> {
  const byParty = new Map<string, ReminderRecord[]>();
  for (const event of events) {
    if (event.type !== "ContactReminded") continue;
    const existing = byParty.get(event.partyId);
    const entry = { at: event.at, tone: event.tone as ReminderTone };
    if (existing) existing.push(entry);
    else byParty.set(event.partyId, [entry]);
  }
  return byParty;
}

// ─── Per-contact facts ───────────────────────────────────────────────────────

function oldestCreditDate(transactions: readonly Transaction[]): string | undefined {
  let oldest: string | undefined;
  for (const t of transactions) {
    if (t.kind !== "given") continue;
    if (!oldest || t.date < oldest) oldest = t.date;
  }
  return oldest;
}

function latestReceipt(payments: readonly Payment[]): Payment | undefined {
  let latest: Payment | undefined;
  for (const p of payments) {
    if (p.kind !== "received") continue;
    if (!latest || p.date > latest.date) latest = p;
  }
  return latest;
}

/**
 * The weekday this contact usually pays on.
 *
 * Claimed only when there is a real pattern — at least three payments and a
 * clear favourite. Guessing a habit from two data points would be a confident
 * lie on a screen the merchant is meant to trust.
 */
function paymentHabitFor(payments: readonly Payment[]): string | undefined {
  const received = payments.filter((p) => p.kind === "received");
  if (received.length < 3) return undefined;
  const counts = new Array<number>(7).fill(0);
  for (const payment of received) {
    const time = toTime(payment.date);
    if (!Number.isNaN(time)) counts[new Date(time).getUTCDay()] += 1;
  }
  let best = 0;
  for (let i = 1; i < 7; i++) if (counts[i] > counts[best]) best = i;
  return counts[best] >= Math.max(3, received.length * 0.4)
    ? "usually pays on " + WEEKDAYS[best]
    : undefined;
}

/** What to do next. Reminder recency wins, because calling twice in a day costs goodwill. */
function suggestedActionFor(
  daysSinceReminder: number | undefined,
  daysOverdue: number,
  hasPhone: boolean
): string {
  if (daysSinceReminder !== undefined) {
    if (daysSinceReminder <= 0) return "Reminded today — wait";
    if (daysSinceReminder < 3) return `Reminded ${daysSinceReminder}d ago — wait`;
    if (daysSinceReminder < 7) return `Follow up if unpaid (${daysSinceReminder}d since reminder)`;
    return `Follow up again — ${daysSinceReminder}d since last reminder`;
  }
  if (!hasPhone) return "Add a phone number to follow up";
  return daysOverdue > 0 ? "Call now — never contacted" : "Send a reminder";
}

// ─── The worklist ────────────────────────────────────────────────────────────

interface Draft {
  readonly item: Omit<RecoveryItem, "priority" | "priorityBreakdown" | "suggestedAction">;
  readonly agingScore: number;
  readonly behaviourScore: number;
  readonly reminderScore: number;
}

/**
 * The recovery worklist, highest priority first.
 *
 * **Priority is deterministic**: a fixed weighted score out of 100 —
 * 40% outstanding · 30% aging · 20% payment behaviour · 10% reminder recency.
 * No AI, no ML, no randomness. The outstanding component is scored relative to
 * the largest debt in this merchant's own list, so the scale means something on
 * a ledger of ₹500 and a ledger of ₹5,00,000 alike.
 *
 * Only contacts who owe the merchant appear. A supplier is a payable, not a
 * collection, and chasing one is a mistake that cannot be taken back.
 */
export function buildRecoveryList(
  ledger: Ledger,
  events: readonly LedgerEvent[],
  today: string
): readonly RecoveryItem[] {
  const reminders = remindersByParty(events);
  const drafts: Draft[] = [];
  let maxOutstanding = 0;

  for (const { party, net } of ledger.balances.ranked) {
    if (net <= 0) continue;
    maxOutstanding = Math.max(maxOutstanding, net);

    const dueDate = ledger.due.earliestDueDateByParty.get(party.id);
    const daysOverdue = dueDate ? Math.max(0, daysBetween(dueDate, today)) : 0;

    const transactions = ledger.transactions.transactionsByParty.get(party.id) ?? [];
    const payments = ledger.transactions.paymentsByParty.get(party.id) ?? [];
    const oldestCredit = oldestCreditDate(transactions);
    const daysOutstanding = oldestCredit ? Math.max(0, daysBetween(oldestCredit, today)) : 0;

    // A credit with no agreed due date is OLD, not LATE. It is still ranked by
    // age — otherwise, with due dates optional and rarely filled, almost every
    // row would score zero here and the list would collapse to "biggest first".
    const agingDays = daysOverdue > 0 ? daysOverdue : daysOutstanding;

    const receipt = latestReceipt(payments);
    const daysSinceLastPayment = receipt
      ? Math.max(0, daysBetween(receipt.date, today))
      : undefined;

    const history = reminders.get(party.id) ?? [];
    const lastRemindedAt = history.length ? history[history.length - 1].at : undefined;
    const daysSinceReminder = lastRemindedAt
      ? Math.max(0, daysBetween(lastRemindedAt.slice(0, 10), today))
      : undefined;

    drafts.push({
      item: {
        party,
        phone: party.phone,
        outstanding: net,
        oldestDueDate: dueDate && daysOverdue > 0 ? dueDate : undefined,
        daysOverdue,
        daysOutstanding,
        agingDays,
        bucket: bucketFor(daysOverdue),
        lastPaymentAt: receipt?.date,
        lastPaymentAmount: receipt?.amount,
        daysSinceLastPayment,
        lastRemindedAt,
        daysSinceReminder,
        reminderHistory: history,
        paymentHabit: paymentHabitFor(payments),
      },
      agingScore: clamp100((agingDays / AGING_CAP_DAYS) * 100),
      // Never paid is the worst behaviour there is; otherwise, how long it has
      // been since they last put money in.
      behaviourScore:
        daysSinceLastPayment === undefined
          ? 100
          : clamp100((daysSinceLastPayment / BEHAVIOUR_CAP_DAYS) * 100),
      // Recently reminded scores LOW, so the list stops pushing someone the
      // merchant just called.
      reminderScore:
        daysSinceReminder === undefined
          ? 100
          : clamp100((daysSinceReminder / REMINDER_CAP_DAYS) * 100),
    });
  }

  const items = drafts.map(({ item, agingScore, behaviourScore, reminderScore }) => {
    const outstandingScore = maxOutstanding > 0 ? (item.outstanding / maxOutstanding) * 100 : 0;
    const breakdown: PriorityBreakdown = {
      outstanding: outstandingScore * PRIORITY_WEIGHTS.outstanding,
      aging: agingScore * PRIORITY_WEIGHTS.aging,
      behaviour: behaviourScore * PRIORITY_WEIGHTS.behaviour,
      reminder: reminderScore * PRIORITY_WEIGHTS.reminder,
    };
    const priority =
      breakdown.outstanding + breakdown.aging + breakdown.behaviour + breakdown.reminder;
    return {
      ...item,
      priority: Math.round(priority),
      priorityBreakdown: breakdown,
      suggestedAction: suggestedActionFor(
        item.daysSinceReminder,
        item.daysOverdue,
        Boolean(item.phone)
      ),
    };
  });

  // Ties break on outstanding then contact id, so the order is stable across
  // runs rather than dependent on how the ledger happened to be built.
  return items.sort(
    (a, b) =>
      b.priority - a.priority ||
      b.outstanding - a.outstanding ||
      a.party.id.localeCompare(b.party.id)
  );
}

/** Portfolio headline for the top of the workspace. */
export function recoveryTotals(items: readonly RecoveryItem[]) {
  let overdueAmount = 0;
  let overdueCount = 0;
  let pendingAmount = 0;
  for (const item of items) {
    pendingAmount += item.outstanding;
    if (item.daysOverdue > 0) {
      overdueAmount += item.outstanding;
      overdueCount += 1;
    }
  }
  return { overdueAmount, overdueCount, pendingAmount, totalCount: items.length };
}

/** The last few statement rows, newest first — enough to recognise the account. */
export function statementPreview(
  ledger: Ledger,
  partyId: string,
  limit = 5
): readonly StatementRow[] {
  const rows = ledger.timeline.statementByParty.get(partyId) ?? [];
  return rows.slice(Math.max(0, rows.length - limit)).reverse();
}

// ─── What to say ─────────────────────────────────────────────────────────────

export type ReminderTone = "gentle" | "normal" | "firm";

export const REMINDER_TONES: readonly ReminderTone[] = ["gentle", "normal", "firm"];

function inr(amount: number): string {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

/**
 * A neutral reminder the merchant sends themselves.
 *
 * All three tones stay relationship-safe. The standing test is *"would you be
 * comfortable sending this to a customer you can't afford to lose?"* — no
 * threats, no shaming, no mention of legal action, no deadline the merchant
 * never agreed. "Firm" is direct, not aggressive. Vyora never sends it.
 */
export function buildReminderMessage(
  item: RecoveryItem,
  options: { shopName?: string; tone?: ReminderTone } = {}
): string {
  const tone = options.tone ?? "normal";
  const from = options.shopName?.trim();
  const lines: string[] = [`Namaste ${item.party.name},`, ""];

  if (tone === "gentle") {
    lines.push(`A gentle reminder that ${inr(item.outstanding)} is pending on your account.`);
  } else if (tone === "normal") {
    lines.push(`This is a reminder that ${inr(item.outstanding)} is pending on your account.`);
  } else {
    lines.push(`${inr(item.outstanding)} is still pending on your account.`);
  }

  if (item.daysOverdue > 0 && item.oldestDueDate) {
    lines.push(`It was due on ${item.oldestDueDate}, ${item.daysOverdue} days ago.`);
  }
  if (item.lastPaymentAt && item.lastPaymentAmount) {
    lines.push(`Last payment received: ${inr(item.lastPaymentAmount)} on ${item.lastPaymentAt}.`);
  }

  lines.push("");
  if (tone === "gentle") {
    lines.push("Whenever convenient, please let me know when you can settle it. Thank you!");
  } else if (tone === "normal") {
    lines.push("Please let me know when you can settle it. Thank you.");
  } else {
    lines.push("Please arrange to settle it at the earliest, or let me know a date. Thank you.");
  }

  if (from) lines.push("", `— ${from}`);
  return lines.join("\n");
}

/**
 * Several reminders in one share.
 *
 * Reuses `buildReminderMessage` per contact rather than writing a second
 * template, so bulk and single reminders can never drift apart in tone. The
 * merchant still sends it themselves — this only saves them opening the sheet
 * once per person.
 */
export function buildBulkReminderMessage(
  items: readonly RecoveryItem[],
  options: { shopName?: string; tone?: ReminderTone } = {}
): string {
  return items.map((item) => buildReminderMessage(item, options)).join("\n\n---\n\n");
}

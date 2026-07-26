/**
 * Vyora — Customer 360 profile (V1-002). One pure function that derives everything
 * the customer profile shows, so no screen re-computes a value: status, lifetime
 * credit/payment, outstanding, average payment time, last activity, and the
 * relationship stats (customer since, longest delay, largest purchase/payment).
 *
 * The recovery SCORE is intentionally NOT computed here — it is portfolio-relative
 * and must match the Home/Collect ranking, so the screen reads it from the shared
 * recovery sweep (`rankOverdue`). "Unknown stays unknown": average payment time and
 * longest delay are `null` until there is real evidence.
 */

import type { VyoraData } from "./types";
import { partyNet } from "./selectors";
import { agingForParty, allocateFifo, daysBetween } from "./aging";

export type CustomerStatus = "settled" | "overdue" | "due-soon" | "good";

export interface CustomerProfile {
  status: CustomerStatus;
  outstanding: number; // signed net (+ they owe you)
  lifetimeCredit: number; // total credit extended (given)
  lifetimePayment: number; // total payments they made (received)
  /** Average days a credit takes to be fully paid (FIFO). Null until one is settled. */
  avgPaymentDays: number | null;
  lastActivity: string | null; // latest entry date (YYYY-MM-DD)
  customerSince: string; // contact created date (YYYY-MM-DD)
  /** Longest a credit went past its due date (settled or currently open). Null if none dued. */
  longestDelayDays: number | null;
  largestPurchase: number; // biggest single credit given
  largestPayment: number; // biggest single payment received
}

const byDateThenId = <T extends { date: string; id: string }>(a: T, b: T) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function customerProfile(
  data: VyoraData,
  partyId: string,
  today: string
): CustomerProfile | null {
  const party = data.parties.find((p) => p.id === partyId);
  if (!party) return null;

  const net = partyNet(data, partyId);
  const aging = agingForParty(data, partyId, today);

  const given = data.transactions
    .filter((t) => t.partyId === partyId && t.kind === "given")
    .sort(byDateThenId);
  const received = data.payments
    .filter((p) => p.partyId === partyId && p.kind === "received")
    .sort(byDateThenId);

  let lifetimeCredit = 0;
  let largestPurchase = 0;
  for (const t of given) {
    lifetimeCredit += t.amount;
    if (t.amount > largestPurchase) largestPurchase = t.amount;
  }
  let lifetimePayment = 0;
  let largestPayment = 0;
  for (const p of received) {
    lifetimePayment += p.amount;
    if (p.amount > largestPayment) largestPayment = p.amount;
  }

  let lastActivity: string | null = null;
  for (const t of data.transactions)
    if (t.partyId === partyId && (lastActivity === null || t.date > lastActivity))
      lastActivity = t.date;
  for (const p of data.payments)
    if (p.partyId === partyId && (lastActivity === null || p.date > lastActivity))
      lastActivity = p.date;

  // FIFO cash application: each payment settles the oldest open credit first.
  const settledDays: number[] = [];
  const delays: number[] = [];
  let pi = 0;
  let avail = 0;
  let lastPayDate: string | null = null;
  for (const c of given) {
    while (avail < c.amount && pi < received.length) {
      avail += received[pi]!.amount;
      lastPayDate = received[pi]!.date;
      pi += 1;
    }
    if (avail >= c.amount) {
      avail -= c.amount;
      if (lastPayDate) {
        settledDays.push(Math.max(0, daysBetween(c.date, lastPayDate)));
        if (c.dueDate) delays.push(Math.max(0, daysBetween(c.dueDate, lastPayDate)));
      }
    } else if (c.dueDate && c.dueDate < today) {
      delays.push(daysBetween(c.dueDate, today)); // still open + overdue → current delay
    }
  }
  const avgPaymentDays = settledDays.length
    ? Math.round(settledDays.reduce((a, b) => a + b, 0) / settledDays.length)
    : null;
  const longestDelayDays = delays.length ? Math.max(...delays) : null;

  // Status — same rule as the ledger statement (single definition).
  let nearestFutureDueDays: number | null = null;
  for (const lot of allocateFifo(given, lifetimePayment)) {
    if (lot.openAmount <= 0 || !lot.dueDate || lot.dueDate < today) continue;
    const d = daysBetween(today, lot.dueDate);
    if (nearestFutureDueDays === null || d < nearestFutureDueDays) nearestFutureDueDays = d;
  }
  let status: CustomerStatus;
  if (net === 0) status = "settled";
  else if (aging.overdueAmount > 0) status = "overdue";
  else if (net > 0 && nearestFutureDueDays !== null && nearestFutureDueDays <= 7)
    status = "due-soon";
  else status = "good";

  return {
    status,
    outstanding: net,
    lifetimeCredit,
    lifetimePayment,
    avgPaymentDays,
    lastActivity,
    customerSince: party.createdAt.slice(0, 10),
    longestDelayDays,
    largestPurchase,
    largestPayment,
  };
}

/**
 * Vyora Alpha — pure selectors.
 *
 * Every number the UI shows is derived here from the raw data — balances are
 * never stored, so they can never drift out of sync. Pure functions only:
 * deterministic, trivially testable, no side effects.
 */

import type {
  VyoraData,
  Party,
  Transaction,
  Payment,
  PartyBalance,
  DashboardTotals,
  ActivityItem,
} from "./types";

/** Signed effect of a credit entry on "they owe me". given → +, taken → −. */
export function transactionEffect(t: Transaction): number {
  return t.kind === "given" ? t.amount : -t.amount;
}

/** Signed effect of a payment on "they owe me". received → −, paid → +. */
export function paymentEffect(p: Payment): number {
  return p.kind === "paid" ? p.amount : -p.amount;
}

/** Round to whole rupees for display/summing (Alpha deals in rupees, not paise). */
export function rupees(n: number): number {
  return Math.round(n);
}

/** A party's net position. + = they owe the merchant; − = the merchant owes them. */
export function partyNet(data: VyoraData, partyId: string): number {
  let net = 0;
  for (const t of data.transactions) if (t.partyId === partyId) net += transactionEffect(t);
  for (const p of data.payments) if (p.partyId === partyId) net += paymentEffect(p);
  return rupees(net);
}

/** All parties with their net, sorted by absolute exposure (biggest first). */
export function allBalances(data: VyoraData): PartyBalance[] {
  return data.parties
    .map((party) => ({ party, net: partyNet(data, party.id) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/** Today's date as YYYY-MM-DD in the device's local timezone. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The six dashboard headline numbers. */
export function dashboardTotals(data: VyoraData, today: string = todayISO()): DashboardTotals {
  let receivable = 0;
  let payable = 0;
  for (const { net } of allBalances(data)) {
    if (net > 0) receivable += net;
    else if (net < 0) payable += -net;
  }
  let todaysCollections = 0;
  let todaysPayments = 0;
  for (const p of data.payments) {
    if (p.date !== today) continue;
    if (p.kind === "received") todaysCollections += p.amount;
    else todaysPayments += p.amount;
  }
  return {
    receivable: rupees(receivable),
    payable: rupees(payable),
    net: rupees(receivable - payable),
    todaysCollections: rupees(todaysCollections),
    todaysPayments: rupees(todaysPayments),
  };
}

function partyName(data: VyoraData, partyId: string): string {
  return data.parties.find((p) => p.id === partyId)?.name ?? "Unknown";
}

function transactionLabel(t: Transaction): string {
  return t.kind === "given" ? "Credit given" : "Credit taken";
}
function paymentLabel(p: Payment): string {
  return p.kind === "received" ? "Payment received" : "Payment made";
}

/** Every entry as a unified activity item, newest first. */
export function allActivity(data: VyoraData): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const t of data.transactions) {
    items.push({
      id: t.id,
      partyId: t.partyId,
      partyName: partyName(data, t.partyId),
      date: t.date,
      createdAt: t.createdAt,
      amount: t.amount,
      signedAmount: transactionEffect(t),
      label: transactionLabel(t),
      note: t.description,
      reference: t.reference,
      type: "transaction",
    });
  }
  for (const p of data.payments) {
    items.push({
      id: p.id,
      partyId: p.partyId,
      partyName: partyName(data, p.partyId),
      date: p.date,
      createdAt: p.createdAt,
      amount: p.amount,
      signedAmount: paymentEffect(p),
      label: paymentLabel(p),
      note: p.note,
      type: "payment",
    });
  }
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Recent activity for the dashboard. */
export function recentActivity(data: VyoraData, limit = 12): ActivityItem[] {
  return allActivity(data).slice(0, limit);
}

/** A single party's full statement, OLDEST first, with a running balance. */
export function partyStatement(
  data: VyoraData,
  partyId: string
): Array<ActivityItem & { runningNet: number }> {
  const items = allActivity(data)
    .filter((i) => i.partyId === partyId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  let running = 0;
  return items.map((i) => {
    running = rupees(running + i.signedAmount);
    return { ...i, runningNet: running };
  });
}

/** Instant, case-insensitive party search over name + phone. Empty query → all, biggest-exposure first. */
export function searchParties(data: VyoraData, query: string): PartyBalance[] {
  const q = query.trim().toLowerCase();
  const all = allBalances(data);
  if (!q) return all;
  return all.filter(
    ({ party }) =>
      party.name.toLowerCase().includes(q) || (party.phone ?? "").toLowerCase().includes(q)
  );
}

/** Find a party by exact (case-insensitive, trimmed) name — for inline create-or-reuse during fast entry. */
export function findPartyByName(data: VyoraData, name: string): Party | undefined {
  const n = name.trim().toLowerCase();
  return data.parties.find((p) => p.name.trim().toLowerCase() === n);
}

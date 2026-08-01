/**
 * Vyora — the PRE-v2 selectors, copied verbatim, plus a deterministic ledger
 * generator. Test support only; never imported by application code.
 *
 * ARCH-001 replaced these O(P×N) sweeps with the Ledger Engine. Keeping a
 * faithful copy is what makes the refactor checkable: `ledger.test.ts` asserts
 * the engine produces identical values and ordering, and `ledger.bench.ts`
 * measures the engine against the very code it replaced rather than against a
 * remembered number.
 *
 * Do not "improve" anything in this file — its only job is to be the old
 * behaviour, warts included.
 */

import type { VyoraData, Party, Transaction, Payment, ActivityItem } from "@/lib/vyora/types";

// ─── The old selectors, verbatim ─────────────────────────────────────────────

export function refPartyNet(data: VyoraData, partyId: string): number {
  let net = 0;
  for (const t of data.transactions) {
    if (t.partyId === partyId) net += t.kind === "given" ? t.amount : -t.amount;
  }
  for (const p of data.payments) {
    if (p.partyId === partyId) net += p.kind === "paid" ? p.amount : -p.amount;
  }
  return Math.round(net);
}

export function refAllBalances(data: VyoraData) {
  return data.parties
    .map((party) => ({ party, net: refPartyNet(data, party.id) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

function refPartyName(data: VyoraData, partyId: string): string {
  return data.parties.find((p) => p.id === partyId)?.name ?? "Unknown";
}

export function refAllActivity(data: VyoraData): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const t of data.transactions) {
    items.push({
      id: t.id,
      partyId: t.partyId,
      partyName: refPartyName(data, t.partyId),
      date: t.date,
      createdAt: t.createdAt,
      amount: t.amount,
      signedAmount: t.kind === "given" ? t.amount : -t.amount,
      label: t.kind === "given" ? "Credit given" : "Credit taken",
      note: t.description,
      type: "transaction",
    });
  }
  for (const p of data.payments) {
    items.push({
      id: p.id,
      partyId: p.partyId,
      partyName: refPartyName(data, p.partyId),
      date: p.date,
      createdAt: p.createdAt,
      amount: p.amount,
      signedAmount: p.kind === "paid" ? p.amount : -p.amount,
      label: p.kind === "received" ? "Payment received" : "Payment made",
      note: p.note,
      type: "payment",
    });
  }
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function refPartyStatement(data: VyoraData, partyId: string) {
  const items = refAllActivity(data)
    .filter((i) => i.partyId === partyId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  let running = 0;
  return items.map((i) => {
    running = Math.round(running + i.signedAmount);
    return { ...i, runningNet: running };
  });
}

export function refRecentActivity(data: VyoraData, limit = 12) {
  return refAllActivity(data).slice(0, limit);
}

export function refSearchParties(data: VyoraData, query: string) {
  const q = query.trim().toLowerCase();
  const all = refAllBalances(data);
  if (!q) return all;
  return all.filter(
    ({ party }) =>
      party.name.toLowerCase().includes(q) || (party.phone ?? "").toLowerCase().includes(q)
  );
}

export function refFindPartyByName(data: VyoraData, name: string): Party | undefined {
  const n = name.trim().toLowerCase();
  return data.parties.find((p) => p.name.trim().toLowerCase() === n);
}

export function refDashboardTotals(data: VyoraData, today: string) {
  let receivable = 0;
  let payable = 0;
  for (const { net } of refAllBalances(data)) {
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
    receivable: Math.round(receivable),
    payable: Math.round(payable),
    net: Math.round(receivable - payable),
    todaysCollections: Math.round(todaysCollections),
    todaysPayments: Math.round(todaysPayments),
  };
}

// ─── Deterministic generator ─────────────────────────────────────────────────

/** Seeded LCG — reproducible datasets so a benchmark run is comparable to the last. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const BASE_MS = Date.parse("2026-07-01T00:00:00.000Z");
const DAY_MS = 86_400_000;

/** An ISO instant n seconds after the base — the `createdAt` axis. */
export const stamp = (n: number) => new Date(BASE_MS + n * 1000).toISOString();

/** A YYYY-MM-DD business date n DAYS after the base — the `date` axis. */
export const businessDate = (n: number) =>
  new Date(BASE_MS + n * DAY_MS).toISOString().slice(0, 10);

/**
 * A ledger containing every shape the indexes special-case: ties in `createdAt`
 * (two entries in the same second), parties with and without phones, duplicate
 * party names, entries with and without due dates, and parties carrying no
 * entries at all.
 */
export function generateData(seed: number, partyCount: number, entryCount: number): VyoraData {
  const rng = makeRng(seed);
  const parties: Party[] = [];
  for (let i = 0; i < partyCount; i++) {
    parties.push({
      id: "p" + i,
      name: i % 7 === 0 ? "Shared Name" : "Party " + i,
      phone: i % 3 === 0 ? "98000" + i : undefined,
      createdAt: stamp(i),
    });
  }

  const transactions: Transaction[] = [];
  const payments: Payment[] = [];
  for (let i = 0; i < entryCount; i++) {
    // Halving the counter makes consecutive entries share a second, which is
    // what exercises the stable tie-break in the timeline.
    const createdAt = stamp(Math.floor(i / 2));
    const partyId = "p" + Math.floor(rng() * partyCount);
    const amount = Math.floor(rng() * 5000) + 1;
    if (rng() < 0.6) {
      transactions.push({
        id: "t" + i,
        partyId,
        amount,
        kind: rng() < 0.7 ? "given" : "taken",
        description: rng() < 0.5 ? "note " + i : undefined,
        date: businessDate(i % 30),
        dueDate: rng() < 0.4 ? businessDate((i % 30) + 15) : undefined,
        createdAt,
      });
    } else {
      payments.push({
        id: "y" + i,
        partyId,
        amount,
        kind: rng() < 0.5 ? "received" : "paid",
        note: rng() < 0.3 ? "paid " + i : undefined,
        date: businessDate(i % 30),
        createdAt,
      });
    }
  }
  return { version: 1, parties, transactions, payments };
}

export interface AppendStep {
  next: VyoraData;
  change: { party?: Party; transaction?: Transaction; payment?: Payment };
}

/**
 * One append-only change, shaped exactly like the provider's capture path:
 * sometimes a brand-new party, sometimes a credit, sometimes a payment, always
 * strictly newer than everything already in `data`.
 */
export function makeAppend(data: VyoraData, step: number, rng: () => number): AppendStep {
  const createdAt = stamp(100_000 + step);
  const wantsNewParty = rng() < 0.25 || data.parties.length === 0;
  const party: Party | undefined = wantsNewParty
    ? {
        id: "np" + step,
        name: "New Party " + step,
        phone: step % 2 ? "77" + step : undefined,
        createdAt,
      }
    : undefined;
  const parties = party ? [...data.parties, party] : data.parties;
  const partyId = party ? party.id : parties[Math.floor(rng() * parties.length)].id;
  const amount = Math.floor(rng() * 3000) + 1;

  if (rng() < 0.5) {
    const transaction: Transaction = {
      id: "nt" + step,
      partyId,
      amount,
      kind: rng() < 0.6 ? "given" : "taken",
      date: businessDate(step % 30),
      dueDate: rng() < 0.5 ? businessDate((step % 30) + 10) : undefined,
      createdAt,
    };
    const next: VyoraData = { ...data, parties, transactions: [...data.transactions, transaction] };
    return { next, change: { party, transaction } };
  }

  const payment: Payment = {
    id: "ny" + step,
    partyId,
    amount,
    kind: rng() < 0.5 ? "received" : "paid",
    date: businessDate(step % 30),
    createdAt,
  };
  const next: VyoraData = { ...data, parties, payments: [...data.payments, payment] };
  return { next, change: { party, payment } };
}

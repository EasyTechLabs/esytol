/**
 * Vyora — Ledger Engine v2 (ARCH-001). ONE normalized index built in a single O(N)
 * pass, from which every merchant-visible calculation is served. Replaces the old
 * O(parties × transactions) sweeps: contacts are grouped once, so per-party aging,
 * balances, recovery ranking, due amounts, stats, timeline, search, and profiles are
 * all derived without ever rescanning the ledger.
 *
 * Correct by construction: the engine reuses the exact same pure primitives as the
 * standalone selectors (`agingFromCredits`, `rankOverdueWith`, `customerProfileFrom`,
 * `merchantInsights`, `todayTotals`, `allActivity`), so its indexes are byte-identical
 * to the functions they replace — proven by the equivalence regression tests.
 *
 * Immutable (frozen), memoized by the provider (rebuilt only when `data` changes),
 * and cheap to rebuild. No schema change, no data migration, no UI/behaviour change.
 */

import type { VyoraData, Party, Transaction, Payment, ActivityItem } from "./types";
import {
  agingFromCredits,
  allocateFifo,
  rankOverdueWith,
  type PartyAging,
  type OverdueRow,
  type OpenRow,
  type PartyRecoveryStats,
} from "./aging";
import { allActivity, todayISO, rupees, todayTotals, type TodayTotals } from "./selectors";
import { customerProfileFrom, type CustomerProfile } from "./customer";
import { merchantInsights, type MerchantInsights } from "./insights";
import { formatMoney, formatDate } from "./format";

/** A contact's entries, grouped and (for given/received) sorted oldest-first. */
export interface PartyEntries {
  given: Transaction[];
  taken: Transaction[];
  received: Payment[];
  paid: Payment[];
}

export type SearchKind = "contact" | "credit" | "payment";
export interface SearchItem {
  kind: SearchKind;
  id: string;
  partyId: string;
  title: string;
  subtitle: string;
  text: string; // lowercased searchable blob
}

/** The recovery view — every recovery number the Home/Collect/Closing screens need. */
export interface RecoveryView {
  overdue: OverdueRow[]; // scored + ranked (single source)
  open: OpenRow[]; // owed but not overdue
  overdueTotal: number;
  overdueContactCount: number;
  highestPriority: OverdueRow | null;
  top5: OverdueRow[];
  dueToday: number;
  dueTodayCount: number;
  dueTomorrow: number;
  dueTomorrowCount: number;
  outstanding: number;
  totalGiven: number;
  totalReceived: number;
}

export interface LedgerEngine {
  today: string;
  parties: Party[];
  partyIndex: Map<string, Party>;
  txnIndex: Map<string, PartyEntries>;
  balanceIndex: Map<string, number>;
  agingIndex: Map<string, PartyAging>;
  recovery: RecoveryView;
  statistics: {
    insights: MerchantInsights;
    today: TodayTotals;
    totalGiven: number;
    totalReceived: number;
  };
  timeline: ActivityItem[];
  getNet: (id: string) => number;
  getAging: (id: string) => PartyAging;
  getProfile: (id: string) => CustomerProfile | null;
  getSearchIndex: () => SearchItem[];
}

const byDateThenId = <T extends { date: string; id: string }>(a: T, b: T) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function nextDay(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

/** Build the full ledger index in one O(N) pass. */
export function buildLedgerEngine(data: VyoraData, today: string = todayISO()): LedgerEngine {
  const tomorrow = nextDay(today);

  const partyIndex = new Map<string, Party>();
  for (const p of data.parties) partyIndex.set(p.id, p);

  // ── ONE pass: group every entry by party, accumulate net + last activity ──
  const txnIndex = new Map<string, PartyEntries>();
  const balanceIndex = new Map<string, number>();
  const receivedTotal = new Map<string, number>();
  const lastActivity = new Map<string, string>();
  const recStats = new Map<string, PartyRecoveryStats>();
  const entriesOf = (id: string): PartyEntries => {
    let e = txnIndex.get(id);
    if (!e) {
      e = { given: [], taken: [], received: [], paid: [] };
      txnIndex.set(id, e);
    }
    return e;
  };
  const stats = (id: string): PartyRecoveryStats => {
    let s = recStats.get(id);
    if (!s) {
      s = { given: 0, received: 0, txnCount: 0 };
      recStats.set(id, s);
    }
    return s;
  };
  const touch = (id: string, date: string) => {
    const l = lastActivity.get(id);
    if (!l || date > l) lastActivity.set(id, date);
  };
  const addNet = (id: string, delta: number) =>
    balanceIndex.set(id, (balanceIndex.get(id) ?? 0) + delta);

  for (const t of data.transactions) {
    touch(t.partyId, t.date);
    if (t.kind === "given") {
      entriesOf(t.partyId).given.push(t);
      addNet(t.partyId, t.amount); // given → +
      const s = stats(t.partyId);
      s.given += t.amount;
      s.txnCount += 1;
    } else {
      entriesOf(t.partyId).taken.push(t);
      addNet(t.partyId, -t.amount); // taken → −
    }
  }
  for (const p of data.payments) {
    touch(p.partyId, p.date);
    if (p.kind === "received") {
      entriesOf(p.partyId).received.push(p);
      addNet(p.partyId, -p.amount); // received → −
      receivedTotal.set(p.partyId, (receivedTotal.get(p.partyId) ?? 0) + p.amount);
      stats(p.partyId).received += p.amount;
    } else {
      entriesOf(p.partyId).paid.push(p);
      addNet(p.partyId, p.amount); // paid → +
    }
  }
  // Round net to whole rupees (matches partyNet) + sort the FIFO-relevant lists.
  for (const p of data.parties) {
    balanceIndex.set(p.id, rupees(balanceIndex.get(p.id) ?? 0));
    const e = txnIndex.get(p.id);
    if (e) {
      e.given.sort(byDateThenId);
      e.received.sort(byDateThenId);
    }
  }

  // ── Per-party aging + recovery + due, all from grouped data (Σ O(entries_p) = O(N)) ──
  const agingIndex = new Map<string, PartyAging>();
  const overdue: OverdueRow[] = [];
  const open: OpenRow[] = [];
  let overdueTotal = 0;
  let outstanding = 0;
  let dueToday = 0;
  let dueTodayCount = 0;
  let dueTomorrow = 0;
  let dueTomorrowCount = 0;
  let totalGiven = 0;
  let totalReceived = 0;

  for (const party of data.parties) {
    const e = txnIndex.get(party.id);
    const given = e?.given ?? [];
    const pool = receivedTotal.get(party.id) ?? 0;
    const net = balanceIndex.get(party.id) ?? 0;
    totalGiven += stats(party.id).given;
    totalReceived += pool;

    const aging = agingFromCredits(party.id, given, pool, today);
    agingIndex.set(party.id, aging);
    outstanding += aging.openReceivable;

    // Due today / tomorrow from the same FIFO lots (matches the dashboard sweep).
    let ddToday = 0;
    let ddTomorrow = 0;
    for (const lot of allocateFifo(given, pool)) {
      if (lot.openAmount <= 0 || !lot.dueDate) continue;
      if (lot.dueDate === today) ddToday += lot.openAmount;
      else if (lot.dueDate === tomorrow) ddTomorrow += lot.openAmount;
    }
    dueToday += ddToday;
    dueTomorrow += ddTomorrow;
    if (ddToday > 0) dueTodayCount += 1;
    if (ddTomorrow > 0) dueTomorrowCount += 1;

    if (aging.openReceivable <= 0) continue; // nothing owed → not chased
    if (aging.overdueAmount > 0 && aging.daysOverdue !== null) {
      overdueTotal += aging.overdueAmount;
      overdue.push({
        partyId: party.id,
        overdueAmount: aging.overdueAmount,
        daysOverdue: aging.daysOverdue,
        openReceivable: aging.openReceivable,
        net,
      });
    } else {
      open.push({
        partyId: party.id,
        openReceivable: aging.openReceivable,
        oldestOpenDays: aging.oldestOpenDays ?? 0,
        net,
      });
    }
  }
  open.sort((a, b) => {
    if (b.oldestOpenDays !== a.oldestOpenDays) return b.oldestOpenDays - a.oldestOpenDays;
    return b.openReceivable - a.openReceivable;
  });
  // Pre-sort by leverage exactly as collectList does, so ranking is byte-identical to useCollect.
  overdue.sort((a, b) => {
    const la = a.overdueAmount * a.daysOverdue;
    const lb = b.overdueAmount * b.daysOverdue;
    if (lb !== la) return lb - la;
    return b.daysOverdue - a.daysOverdue;
  });
  const rankedOverdue = rankOverdueWith(overdue, recStats);

  const recovery: RecoveryView = {
    overdue: rankedOverdue,
    open,
    overdueTotal: rupees(overdueTotal),
    overdueContactCount: rankedOverdue.length,
    highestPriority: rankedOverdue[0] ?? null,
    top5: rankedOverdue.slice(0, 5),
    dueToday: rupees(dueToday),
    dueTodayCount,
    dueTomorrow: rupees(dueTomorrow),
    dueTomorrowCount,
    outstanding: rupees(outstanding),
    totalGiven: rupees(totalGiven),
    totalReceived: rupees(totalReceived),
  };

  // Stats + timeline reuse the existing O(N) selectors (identical output).
  const statistics = {
    insights: merchantInsights(data, today),
    today: todayTotals(data, today),
    totalGiven: recovery.totalGiven,
    totalReceived: recovery.totalReceived,
  };
  const timeline = allActivity(data);

  // ── O(1)/O(entries_p) accessors ──
  const getNet = (id: string) => balanceIndex.get(id) ?? 0;
  const getAging = (id: string) => agingIndex.get(id) ?? agingFromCredits(id, [], 0, today);
  const getProfile = (id: string): CustomerProfile | null => {
    const party = partyIndex.get(id);
    if (!party) return null;
    const e = txnIndex.get(id) ?? { given: [], taken: [], received: [], paid: [] };
    return customerProfileFrom(
      e.given,
      e.received,
      getNet(id),
      getAging(id),
      lastActivity.get(id) ?? null,
      party.createdAt.slice(0, 10),
      today
    );
  };

  // Search index — built on demand (no cost until the overlay opens), from O(1) indexes.
  let searchCache: SearchItem[] | null = null;
  const getSearchIndex = (): SearchItem[] => {
    if (searchCache) return searchCache;
    const items: SearchItem[] = [];
    for (const p of data.parties) {
      const net = getNet(p.id);
      items.push({
        kind: "contact",
        id: p.id,
        partyId: p.id,
        title: p.name,
        subtitle: p.phone || (net === 0 ? "Settled" : formatMoney(net)),
        text: [p.name, p.phone, p.note, String(Math.abs(net))]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }
    for (const t of data.transactions) {
      const name = partyIndex.get(t.partyId)?.name ?? "Contact";
      const label = t.kind === "given" ? "Credit given" : "Credit taken";
      items.push({
        kind: "credit",
        id: t.id,
        partyId: t.partyId,
        title: `${label} · ${formatMoney(t.amount)}`,
        subtitle: `${name} · ${formatDate(t.date)}${t.reference ? ` · Ref ${t.reference}` : ""}`,
        text: [name, t.reference, t.description, String(t.amount)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }
    for (const p of data.payments) {
      const name = partyIndex.get(p.partyId)?.name ?? "Contact";
      const label = p.kind === "received" ? "Payment received" : "Payment made";
      items.push({
        kind: "payment",
        id: p.id,
        partyId: p.partyId,
        title: `${label} · ${formatMoney(p.amount)}`,
        subtitle: `${name} · ${formatDate(p.date)}${p.mode ? ` · ${p.mode.toUpperCase()}` : ""}`,
        text: [name, p.reference, p.note, p.mode, String(p.amount)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }
    searchCache = items;
    return items;
  };

  return Object.freeze({
    today,
    parties: data.parties,
    partyIndex,
    txnIndex,
    balanceIndex,
    agingIndex,
    recovery,
    statistics,
    timeline,
    getNet,
    getAging,
    getProfile,
    getSearchIndex,
  });
}

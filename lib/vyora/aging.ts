/**
 * Vyora — aging engine (Epic A · Mission A1 · Cap 5 · D12).
 *
 * Pure, deterministic aging over the existing ledger. Given the merchant's data
 * and "today", it answers: which receivables are still open, how old are they,
 * and who is overdue and by how much. Nothing is stored — aging is always
 * DERIVED, so it can never drift out of sync (the same invariant balances hold
 * in `selectors.ts`).
 *
 * Rules baked in (approved Epic A design — do not change without a design change):
 *  - RECEIVABLE side only. We age what customers owe the merchant by
 *    FIFO-allocating `received` payments against `given` credits, oldest first.
 *    The payable side is never "chased" — a supplier chases the merchant, not
 *    the other way round — so a net-payable contact never appears as overdue.
 *  - Overdue requires a REAL due date. A credit is `overdue` only if it has a
 *    `dueDate` that has passed and is still open. Undated debts age from their
 *    entry date ("open N days") and are NEVER reported as a fabricated "overdue".
 *  - `today` is always INJECTED (YYYY-MM-DD). No wall-clock inside these
 *    functions, so every result is deterministic and unit-testable.
 */

import type { VyoraData, Transaction } from "./types";
import { partyNet, rupees } from "./selectors";

export type AgingBucket = "0-30" | "30-60" | "60+";

/** A single `given` credit after FIFO payment allocation. */
export interface AllocationLot {
  transactionId: string;
  /** Original credit amount (rupees). */
  amount: number;
  /** Business date of the credit (YYYY-MM-DD). */
  date: string;
  /** Optional due date (YYYY-MM-DD). */
  dueDate?: string;
  /** The date aging is measured from: `dueDate ?? date`. */
  basisDate: string;
  /** Amount still outstanding on this credit after allocation (rupees). */
  openAmount: number;
}

/** One still-open credit, aged as of `today`. */
export interface OpenLot {
  transactionId: string;
  openAmount: number;
  basisDate: string;
  /** Whole days from `basisDate` to `today` (negative if not yet due). */
  ageDays: number;
  bucket: AgingBucket;
  /** True only when a real due date has passed and the lot is still open. */
  overdue: boolean;
}

/** A party's receivable aging. */
export interface PartyAging {
  partyId: string;
  /** Σ open receivable across this party's lots (rupees). */
  openReceivable: number;
  /** Σ open amount on lots that are truly overdue (rupees). */
  overdueAmount: number;
  /** Max days past due among overdue lots, or null if nothing is overdue. */
  daysOverdue: number | null;
  /** Max age among open lots, or null if nothing is open. */
  oldestOpenDays: number | null;
  buckets: Record<AgingBucket, number>;
  lots: OpenLot[];
}

/** One row of the "Who to chase today" list. */
export interface OverdueRow {
  partyId: string;
  overdueAmount: number;
  daysOverdue: number;
  openReceivable: number;
  /** Full signed net for context (+ = they owe the merchant). */
  net: number;
}

/** Portfolio-wide receivable aging totals. */
export interface PortfolioAging {
  buckets: Record<AgingBucket, number>;
  overdueTotal: number;
  openReceivableTotal: number;
  overdueContactCount: number;
}

const emptyBuckets = (): Record<AgingBucket, number> => ({ "0-30": 0, "30-60": 0, "60+": 0 });

/** Whole days between two YYYY-MM-DD dates (`to` − `from`). Pure; no wall-clock. */
export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

function bucketFor(ageDays: number): AgingBucket {
  if (ageDays < 30) return "0-30";
  if (ageDays < 60) return "30-60";
  return "60+";
}

/**
 * FIFO-allocate a pool of received payments against a party's `given` credits,
 * oldest first (by basis date, then creation order). Returns every credit with
 * its remaining open amount. The payable side (`taken`/`paid`) is out of scope.
 */
export function allocateFifo(credits: Transaction[], paidPool: number): AllocationLot[] {
  const ordered = [...credits].sort((a, b) => {
    const ba = a.dueDate ?? a.date;
    const bb = b.dueDate ?? b.date;
    if (ba !== bb) return ba < bb ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
  let pool = Math.max(paidPool, 0);
  return ordered.map((c) => {
    const applied = Math.min(c.amount, pool);
    pool -= applied;
    return {
      transactionId: c.id,
      amount: c.amount,
      date: c.date,
      dueDate: c.dueDate,
      basisDate: c.dueDate ?? c.date,
      openAmount: rupees(c.amount - applied),
    };
  });
}

/** A party's receivable aging as of `today`. */
export function agingForParty(data: VyoraData, partyId: string, today: string): PartyAging {
  const credits = data.transactions.filter((t) => t.partyId === partyId && t.kind === "given");
  let paidPool = 0;
  for (const p of data.payments) {
    if (p.partyId === partyId && p.kind === "received") paidPool += p.amount;
  }

  const buckets = emptyBuckets();
  const lots: OpenLot[] = [];
  let openReceivable = 0;
  let overdueAmount = 0;
  let daysOverdue: number | null = null;
  let oldestOpenDays: number | null = null;

  for (const lot of allocateFifo(credits, paidPool)) {
    if (lot.openAmount <= 0) continue;
    const ageDays = daysBetween(lot.basisDate, today);
    const bucket = bucketFor(ageDays);
    const overdue = Boolean(lot.dueDate) && (lot.dueDate as string) < today;

    buckets[bucket] = rupees(buckets[bucket] + lot.openAmount);
    openReceivable += lot.openAmount;
    oldestOpenDays = oldestOpenDays === null ? ageDays : Math.max(oldestOpenDays, ageDays);
    if (overdue) {
      overdueAmount += lot.openAmount;
      daysOverdue = daysOverdue === null ? ageDays : Math.max(daysOverdue, ageDays);
    }

    lots.push({
      transactionId: lot.transactionId,
      openAmount: lot.openAmount,
      basisDate: lot.basisDate,
      ageDays,
      bucket,
      overdue,
    });
  }

  return {
    partyId,
    openReceivable: rupees(openReceivable),
    overdueAmount: rupees(overdueAmount),
    daysOverdue,
    oldestOpenDays,
    buckets,
    lots,
  };
}

/**
 * "Who to chase today" — every contact with an overdue receivable, ordered by
 * highest recovery leverage first: `overdueAmount × daysOverdue` (desc),
 * tie-broken by the most overdue (oldest) first. Net-payable contacts and
 * contacts whose debts are open-but-not-yet-due are correctly excluded.
 */
export function overdueList(data: VyoraData, today: string): OverdueRow[] {
  const rows: OverdueRow[] = [];
  for (const party of data.parties) {
    const aging = agingForParty(data, party.id, today);
    if (aging.overdueAmount > 0 && aging.daysOverdue !== null) {
      rows.push({
        partyId: party.id,
        overdueAmount: aging.overdueAmount,
        daysOverdue: aging.daysOverdue,
        openReceivable: aging.openReceivable,
        net: partyNet(data, party.id),
      });
    }
  }
  return rows.sort((a, b) => {
    const la = a.overdueAmount * a.daysOverdue;
    const lb = b.overdueAmount * b.daysOverdue;
    if (lb !== la) return lb - la;
    return b.daysOverdue - a.daysOverdue;
  });
}

/** Portfolio-wide receivable aging totals as of `today`. */
export function portfolioAging(data: VyoraData, today: string): PortfolioAging {
  const buckets = emptyBuckets();
  let overdueTotal = 0;
  let openReceivableTotal = 0;
  let overdueContactCount = 0;

  for (const party of data.parties) {
    const aging = agingForParty(data, party.id, today);
    buckets["0-30"] = rupees(buckets["0-30"] + aging.buckets["0-30"]);
    buckets["30-60"] = rupees(buckets["30-60"] + aging.buckets["30-60"]);
    buckets["60+"] = rupees(buckets["60+"] + aging.buckets["60+"]);
    overdueTotal += aging.overdueAmount;
    openReceivableTotal += aging.openReceivable;
    if (aging.overdueAmount > 0) overdueContactCount += 1;
  }

  return {
    buckets,
    overdueTotal: rupees(overdueTotal),
    openReceivableTotal: rupees(openReceivableTotal),
    overdueContactCount,
  };
}

/** The compact recovery summary for the dashboard card. */
export interface RecoverySummary {
  /** Total open receivable across the portfolio (rupees). */
  outstanding: number;
  /** Total overdue amount (rupees). */
  overdueTotal: number;
  /** How many contacts are overdue. */
  overdueContactCount: number;
  /** The single highest-leverage overdue contact to chase first, or null if none. */
  highestPriority: OverdueRow | null;
}

/**
 * One-pass recovery summary — outstanding, overdue total, overdue count, and the
 * highest-priority contact — computed from a SINGLE `agingForParty` sweep per
 * contact (no calling `portfolioAging` + `overdueList` separately, which would
 * double the FIFO work). Ranking matches `overdueList` (overdueAmount × daysOverdue).
 */
export function recoverySummary(data: VyoraData, today: string): RecoverySummary {
  let outstanding = 0;
  let overdueTotal = 0;
  const overdue: OverdueRow[] = [];
  for (const party of data.parties) {
    const aging = agingForParty(data, party.id, today);
    outstanding += aging.openReceivable;
    if (aging.overdueAmount > 0 && aging.daysOverdue !== null) {
      overdueTotal += aging.overdueAmount;
      overdue.push({
        partyId: party.id,
        overdueAmount: aging.overdueAmount,
        daysOverdue: aging.daysOverdue,
        openReceivable: aging.openReceivable,
        net: partyNet(data, party.id),
      });
    }
  }
  overdue.sort((a, b) => {
    const la = a.overdueAmount * a.daysOverdue;
    const lb = b.overdueAmount * b.daysOverdue;
    if (lb !== la) return lb - la;
    return b.daysOverdue - a.daysOverdue;
  });
  return {
    outstanding: rupees(outstanding),
    overdueTotal: rupees(overdueTotal),
    overdueContactCount: overdue.length,
    highestPriority: overdue[0] ?? null,
  };
}

/** A contact owed money whose debt is open but NOT overdue (undated or not yet due). */
export interface OpenRow {
  partyId: string;
  openReceivable: number;
  /** Age (days) of the oldest open lot; negative if the due date is still in the future. */
  oldestOpenDays: number;
  net: number;
}

/** The two honest lists behind the Collect screen. */
export interface CollectLists {
  /** Overdue receivables (a real due date has passed), ranked overdueAmount × daysOverdue. */
  overdue: OverdueRow[];
  /** Open receivables that are NOT overdue — shown separately so nothing is mislabelled. */
  open: OpenRow[];
}

/**
 * The Collect ("who to chase today") lists — receivable-side only, in ONE aging
 * sweep. A contact with ANY overdue amount goes to `overdue`; a contact owed
 * money with nothing overdue goes to `open`. **Open is never called overdue**
 * (the honesty rule). Payable / settled contacts appear in neither list.
 */
export function collectList(data: VyoraData, today: string): CollectLists {
  const overdue: OverdueRow[] = [];
  const open: OpenRow[] = [];
  for (const party of data.parties) {
    const aging = agingForParty(data, party.id, today);
    if (aging.openReceivable <= 0) continue; // nothing owed → not chased
    if (aging.overdueAmount > 0 && aging.daysOverdue !== null) {
      overdue.push({
        partyId: party.id,
        overdueAmount: aging.overdueAmount,
        daysOverdue: aging.daysOverdue,
        openReceivable: aging.openReceivable,
        net: partyNet(data, party.id),
      });
    } else {
      open.push({
        partyId: party.id,
        openReceivable: aging.openReceivable,
        oldestOpenDays: aging.oldestOpenDays ?? 0,
        net: partyNet(data, party.id),
      });
    }
  }
  overdue.sort((a, b) => {
    const la = a.overdueAmount * a.daysOverdue;
    const lb = b.overdueAmount * b.daysOverdue;
    if (lb !== la) return lb - la;
    return b.daysOverdue - a.daysOverdue;
  });
  open.sort((a, b) => {
    if (b.oldestOpenDays !== a.oldestOpenDays) return b.oldestOpenDays - a.oldestOpenDays;
    return b.openReceivable - a.openReceivable;
  });
  return { overdue, open };
}

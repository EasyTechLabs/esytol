/**
 * Vyora — selector API over the Ledger Engine (ARCH-001).
 *
 * Every number the UI shows is still *derived* from the raw data — balances are
 * never stored, so they can never drift out of sync. What changed in v2 is
 * WHERE the derivation happens: once per data version, inside `ledger.ts`.
 *
 * This module is a thin, memoized read surface over that engine. It deliberately
 * contains NO calculation of its own — a second implementation of a balance is
 * exactly the "second source of truth" the engineering standards forbid. The
 * function signatures are unchanged so existing call sites and tests keep
 * working; only their cost changed (O(P×N) per call → O(1)/O(P) per call, with
 * one O(N) build amortised across every read of the same data version).
 */

import type { VyoraData, Party, PartyBalance, DashboardTotals, ActivityItem } from "./types";
import type { Ledger, StatementRow } from "./ledger";
import { time } from "./debug";
import {
  buildLedger,
  readDashboardTotals,
  readPartyNet,
  readParty,
  readPartyByName,
  readRecentActivity,
  readSearch,
  readStatement,
  todayISO,
} from "./ledger";

export { transactionEffect, paymentEffect, rupees, todayISO, normalizePartyName } from "./ledger";
export type { Ledger, StatementRow } from "./ledger";

/**
 * One built ledger per `VyoraData` version.
 *
 * The store replaces `data` wholesale on every mutation, so object identity is
 * a correct cache key: a given object can only ever describe one state of the
 * world. A WeakMap means superseded versions are collected with their indexes
 * and nothing has to be invalidated by hand.
 */
const ledgerCache = new WeakMap<VyoraData, Ledger>();

/** The memoized ledger for this data version — the entry point for every read. */
export function ledgerFor(data: VyoraData): Ledger {
  const cached = ledgerCache.get(data);
  if (cached) return cached;
  const ledger = time("selector", "buildLedger", () => buildLedger(data));
  ledgerCache.set(data, ledger);
  return ledger;
}

/**
 * Adopt an already-built ledger into the memo.
 *
 * The provider builds ledgers incrementally on the capture path; without this
 * the same data version would be derived a second time the moment any selector
 * touched it — two derivations of one truth, which is exactly what v2 removes.
 */
export function cacheLedger(ledger: Ledger): Ledger {
  ledgerCache.set(ledger.data, ledger);
  return ledger;
}

/** A party's net position. + = they owe the merchant; − = the merchant owes them. */
export function partyNet(data: VyoraData, partyId: string): number {
  return readPartyNet(ledgerFor(data), partyId);
}

/** Look up one party by id. */
export function findPartyById(data: VyoraData, partyId: string): Party | undefined {
  return readParty(ledgerFor(data), partyId);
}

/** All parties with their net, sorted by absolute exposure (biggest first). */
export function allBalances(data: VyoraData): readonly PartyBalance[] {
  return ledgerFor(data).balances.ranked;
}

/** The dashboard headline numbers. */
export function dashboardTotals(data: VyoraData, today: string = todayISO()): DashboardTotals {
  return readDashboardTotals(ledgerFor(data), today);
}

/** Every entry as a unified activity item, newest first. */
export function allActivity(data: VyoraData): readonly ActivityItem[] {
  return ledgerFor(data).timeline.newestFirst;
}

/** Recent activity for the dashboard. */
export function recentActivity(data: VyoraData, limit = 12): readonly ActivityItem[] {
  return readRecentActivity(ledgerFor(data), limit);
}

/** A single party's full statement, OLDEST first, with a running balance. */
export function partyStatement(data: VyoraData, partyId: string): readonly StatementRow[] {
  return readStatement(ledgerFor(data), partyId);
}

/** Instant search over name + phone. Empty query → all, biggest-exposure first. */
export function searchParties(data: VyoraData, query: string): readonly PartyBalance[] {
  return readSearch(ledgerFor(data), query);
}

/** Find a party by exact (case-insensitive, trimmed) name — for create-or-reuse. */
export function findPartyByName(data: VyoraData, name: string): Party | undefined {
  return readPartyByName(ledgerFor(data), name);
}

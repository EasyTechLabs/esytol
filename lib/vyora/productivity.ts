/**
 * Vyora — merchant productivity (V2-006).
 *
 * This milestone removes taps, not adds features. Everything here is pure
 * ordering and recall logic over data the Ledger Engine already holds, plus a
 * few device preferences — no new index, no new engine.
 *
 * The rule behind all of it: the customer a merchant wants next is almost
 * always one they touched recently, or one they pinned. Making those two groups
 * reachable without typing is worth more than any search improvement.
 */

import type { Party } from "./types";
import type { Ledger } from "./ledger";
import type { MerchantSettings } from "./settings";

/** How many recent customers are worth showing before it becomes a list to read. */
export const MAX_RECENT = 10;

/** The amounts a shopkeeper reaches for most. */
export const QUICK_AMOUNTS = [100, 500, 1000, 2000] as const;

// ─── Recency ─────────────────────────────────────────────────────────────────

/**
 * Push a contact to the front of the recent list.
 *
 * Most-recent-first, no duplicates, capped. Pure so the ordering rule is
 * testable without a browser.
 */
export function touchRecent(recent: readonly string[], contactId: string): string[] {
  return [contactId, ...recent.filter((id) => id !== contactId)].slice(0, MAX_RECENT);
}

/**
 * The recent customers, resolved against the ledger.
 *
 * Ids that no longer exist are dropped rather than rendered as blanks — a
 * deleted contact must not leave a ghost in the quick-pick row.
 */
export function recentCustomers(
  ledger: Ledger,
  settings: MerchantSettings,
  limit = MAX_RECENT
): readonly Party[] {
  const out: Party[] = [];
  for (const id of settings.recentContactIds) {
    const party = ledger.parties.byId.get(id);
    if (party) out.push(party);
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Favourites ──────────────────────────────────────────────────────────────

export function isFavorite(settings: MerchantSettings, contactId: string): boolean {
  return settings.favoriteContactIds.includes(contactId);
}

export function toggleFavorite(favorites: readonly string[], contactId: string): string[] {
  return favorites.includes(contactId)
    ? favorites.filter((id) => id !== contactId)
    : [...favorites, contactId];
}

/**
 * Pinned customers first, everything else in its existing order.
 *
 * Deliberately a **stable partition**, not a re-sort: within each group the
 * ledger's own exposure ordering survives, so pinning someone does not quietly
 * scramble the rest of the list.
 */
export function withFavoritesFirst<T>(
  items: readonly T[],
  settings: MerchantSettings,
  idOf: (item: T) => string
): readonly T[] {
  if (settings.favoriteContactIds.length === 0) return items;
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (isFavorite(settings, idOf(item))) pinned.push(item);
    else rest.push(item);
  }
  return pinned.length === 0 ? items : [...pinned, ...rest];
}

/**
 * The quick-pick row above search: pinned first, then recent, no repeats.
 */
export function quickPickCustomers(
  ledger: Ledger,
  settings: MerchantSettings,
  limit = MAX_RECENT
): readonly Party[] {
  const seen = new Set<string>();
  const out: Party[] = [];
  for (const id of settings.favoriteContactIds) {
    const party = ledger.parties.byId.get(id);
    if (party && !seen.has(id)) {
      seen.add(id);
      out.push(party);
    }
  }
  for (const party of recentCustomers(ledger, settings, MAX_RECENT)) {
    if (seen.has(party.id)) continue;
    seen.add(party.id);
    out.push(party);
  }
  return out.slice(0, limit);
}

// ─── Quick amounts ───────────────────────────────────────────────────────────

/**
 * The amount chips, with the merchant's last amount promoted.
 *
 * Their own last amount is the single most likely next amount — a shop selling
 * ₹250 items should not have to type 250 twice. Never duplicated, always four
 * or five chips so the row stays one line on a phone.
 */
export function quickAmounts(lastAmount: number): readonly number[] {
  const base = [...QUICK_AMOUNTS];
  if (lastAmount > 0 && !base.includes(lastAmount as (typeof QUICK_AMOUNTS)[number])) {
    return [lastAmount, ...base];
  }
  return base;
}

/**
 * Vyora — persistence of the event log (ARCH-002).
 *
 * What lives on the device is now the **log**, not the state. `VyoraData` is
 * derived by folding it (`events.reduceEvents`). Everything else about the
 * storage contract is unchanged: one versioned localStorage key, no login, no
 * cloud, no server — the merchant's credit data never leaves their phone.
 *
 * - SSR-safe: reads no-op to an empty log without `window`.
 * - Corruption-safe: bad/unknown payloads read as empty, never throw into a screen.
 * - Quota-safe: a failed write returns false; it never crashes a screen.
 * - Migration-safe: a v1 state blob is converted to an equivalent log on first
 *   read, and the v1 key is left untouched as a fallback.
 */

import type { VyoraData } from "./types";
import type { LedgerEvent } from "./events";
import { LOG_VERSION, newId, reduceEvents } from "./events";
import type { MerchantSettings } from "./settings";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
import type { PwaFlags } from "./pwa";
import { DEFAULT_PWA_FLAGS, PWA_STATE_KEY, normalizePwaFlags } from "./pwa";

/** ARCH-002 event log. */
const LOG_KEY = "vyora.events.v2";
/** Pre-ARCH-002 state blob. Read for migration; never written. */
const LEGACY_KEY = "vyora.alpha.v1";

export { LOG_VERSION, LOG_KEY, LEGACY_KEY };

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * Convert a v1 `{parties, transactions, payments}` blob into the log that folds
 * back to exactly that state.
 *
 * Array ORDER is preserved deliberately: the index engine merges the two entry
 * arrays in O(N) on the assumption that each is `createdAt`-ascending, and the
 * v1 store was append-only. Re-ordering here would quietly cost that.
 *
 * Each event carries the entity's own `createdAt` as its timestamp, so a
 * migrated log reads as the history it actually was rather than claiming every
 * entry happened at the moment of upgrade.
 */
export function migrateLegacyData(legacy: VyoraData): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  for (const party of legacy.parties ?? []) {
    events.push({ id: newId("evt"), at: party.createdAt, type: "ContactCreated", party });
  }
  for (const transaction of legacy.transactions ?? []) {
    events.push({
      id: newId("evt"),
      at: transaction.createdAt,
      type: "CreditRecorded",
      transaction,
    });
  }
  for (const payment of legacy.payments ?? []) {
    events.push({ id: newId("evt"), at: payment.createdAt, type: "PaymentRecorded", payment });
  }
  return events;
}

function readLegacyEvents(): LedgerEvent[] | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VyoraData;
    if (!parsed || !Array.isArray(parsed.parties)) return null;
    return migrateLegacyData(parsed);
  } catch {
    return null;
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function saveLog(events: readonly LedgerEvent[]): boolean {
  if (!hasWindow()) return false;
  try {
    const payload = JSON.stringify({ version: LOG_VERSION, events });
    window.localStorage.setItem(LOG_KEY, payload);
    return true;
  } catch {
    return false; // quota / private mode — never crash the UI
  }
}

/**
 * Read the log. On a device still holding v1 state, migrate it and persist the
 * result so the conversion happens exactly once. The v1 key is NOT removed —
 * if anything about v2 goes wrong, the original data is still sitting there.
 */
export function loadLog(): LedgerEvent[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { version?: number; events?: LedgerEvent[] };
      if (parsed && Array.isArray(parsed.events)) return parsed.events;
      return [];
    }
  } catch {
    return [];
  }

  const migrated = readLegacyEvents();
  if (!migrated) return [];
  saveLog(migrated);
  return migrated;
}

/**
 * Erase everything on this device.
 *
 * Both keys go. Migration is non-destructive, but an explicit "erase all my
 * data" is not a migration — leaving the v1 blob behind would both resurrect
 * the data on the next load and quietly ignore what the merchant asked for.
 */
export function clearLog(): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.removeItem(LOG_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merchant settings live under their OWN key, not in the event log.
 *
 * The log is the ledger's history; a shop's name is not a ledger fact. Keeping
 * them separate also means restoring someone's backup cannot overwrite the
 * merchant's own profile.
 */
const SETTINGS_KEY = "vyora.settings.v1";

export { SETTINGS_KEY };

export function loadSettings(): MerchantSettings {
  if (!hasWindow()) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: MerchantSettings): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/**
 * PWA flags get their own key, separate from both the ledger and the merchant's
 * settings.
 *
 * They are facts about this browser, not about the business — and they must
 * survive "clear all data": erasing the ledger should not make the first-run
 * tutorial reappear as though the merchant were new.
 */
const PWA_KEY = PWA_STATE_KEY;

export function loadPwaFlags(): PwaFlags {
  if (!hasWindow()) return DEFAULT_PWA_FLAGS;
  try {
    const raw = window.localStorage.getItem(PWA_KEY);
    return raw ? normalizePwaFlags(JSON.parse(raw)) : DEFAULT_PWA_FLAGS;
  } catch {
    return DEFAULT_PWA_FLAGS;
  }
}

export function savePwaFlags(flags: PwaFlags): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(PWA_KEY, JSON.stringify(flags));
    return true;
  } catch {
    return false; // private mode — the surfaces simply reappear next launch
  }
}

/**
 * The device clock's floor gets its own key, beside settings and PWA flags.
 *
 * It is not a ledger fact, so it does not belong in the log; and it must not be
 * carried by a backup, so it does not belong in the export either. It records
 * only how far this browser's clock has already counted, so a reload — or a
 * device clock moved backwards — cannot reissue an instant already spent. See
 * `clock.ts` for why that matters to a running balance.
 */
const CLOCK_KEY = "vyora.clock.v1";

export { CLOCK_KEY };

/** Highest instant this device has stamped on one of its own events. */
function highestEventAtMs(events: readonly LedgerEvent[]): number {
  let high = -1;
  for (const event of events) {
    const ms = Date.parse(event.at);
    if (Number.isFinite(ms) && ms > high) high = ms;
  }
  return high;
}

/**
 * Where this device's clock should resume, in milliseconds, or -1 for a device
 * with no history at all.
 *
 * The stored floor wins. A device that recorded entries before this key existed
 * has none, and the fallback is the highest `at` in its own log — **not** the
 * highest `createdAt` among its entries. Every event's `at` was stamped by this
 * browser, whereas an entry's `createdAt` can have come from somewhere else: an
 * imported backup carries the exporting device's instants, and seeding from a
 * device whose clock was a year fast would drag this one into that year and
 * keep it there.
 */
export function loadClockFloor(events: readonly LedgerEvent[] = []): number {
  if (!hasWindow()) return highestEventAtMs(events);
  try {
    const raw = window.localStorage.getItem(CLOCK_KEY);
    const stored = raw === null ? Number.NaN : Number(raw);
    if (Number.isFinite(stored)) return stored;
  } catch {
    // Fall through to the log.
  }
  return highestEventAtMs(events);
}

/** Record how far the clock has counted. Monotonic: it never moves backwards. */
export function saveClockFloor(ms: number): boolean {
  if (!hasWindow()) return false;
  if (!Number.isFinite(ms) || ms < 0) return false;
  try {
    const raw = window.localStorage.getItem(CLOCK_KEY);
    const stored = raw === null ? Number.NaN : Number(raw);
    if (Number.isFinite(stored) && stored >= ms) return true;
    window.localStorage.setItem(CLOCK_KEY, String(Math.trunc(ms)));
    return true;
  } catch {
    return false; // quota / private mode — never crash the UI
  }
}

/** The projection currently on this device. Convenience for non-React callers. */
export function loadData(): VyoraData {
  return reduceEvents(loadLog());
}

/**
 * Roughly how many bytes this device is holding for Vyora.
 *
 * Read straight off the stored string, so it reflects the real cost of the
 * append-only log rather than an estimate. Founder Mode surfaces it because
 * `localStorage` is a hard ~5 MB shared across the whole origin, and the log
 * only grows — see `VyoraEventLog.md` §5.
 */
export function storageSizeBytes(): number {
  if (!hasWindow()) return 0;
  try {
    const raw = window.localStorage.getItem(LOG_KEY) ?? "";
    const legacy = window.localStorage.getItem(LEGACY_KEY) ?? "";
    return raw.length + legacy.length;
  } catch {
    return 0;
  }
}

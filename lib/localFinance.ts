/**
 * Local finance store — PROJECT-003.
 *
 * The single implementation of browser-side persistence for the personal
 * dashboard. Everything lives in localStorage under one versioned key:
 * no login, no cloud, no cookies, no tracking — the data never leaves the
 * device, and "Clear my data" genuinely erases everything.
 *
 * Design rules:
 * - SSR-safe: every function no-ops (returns null/false) without `window`.
 * - Corruption-safe: unparsable or wrong-version payloads read as empty, never
 *   throw into the UI.
 * - Quota-safe: a failed write returns false; it never crashes a calculator.
 * - One writer per field: the Financial Roadmap owns the profile (it already
 *   collects the household's full position); tools own only their recency entry.
 */

import type { RoadmapInput } from "./financialRoadmap";

const STORAGE_KEY = "esytol.finance.v1";
const VERSION = 1;

/** How many recently-used tools we remember. */
export const RECENT_LIMIT = 8;
/** Days between financial reviews. */
export const REVIEW_INTERVAL_DAYS = 90;

export interface RecentTool {
  slug: string;
  name: string;
  /** ISO timestamp of last use. */
  at: string;
}

export interface CalculationFigure {
  label: string;
  value: string;
}

/** Headline figures of a tool's last stable calculation (PLATFORM-002). */
export interface CalculationRecord {
  slug: string;
  name: string;
  /** ISO timestamp of the calculation. */
  at: string;
  figures: CalculationFigure[];
}

export interface FinanceStore {
  version: number;
  /** The household's financial position — written by the Financial Roadmap. */
  profile: RoadmapInput | null;
  /** When the profile was last saved (ISO). */
  profileSavedAt: string | null;
  /** Most-recently-used tools, newest first, deduped by slug. */
  recentTools: RecentTool[];
  /** Last stable calculation per tool, newest first, deduped by slug. */
  lastCalculations: CalculationRecord[];
  /** When the user last completed a financial review (ISO). */
  lastReviewAt: string | null;
}

const EMPTY: FinanceStore = {
  version: VERSION,
  profile: null,
  profileSavedAt: null,
  recentTools: [],
  lastCalculations: [],
  lastReviewAt: null,
};

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readStore(): FinanceStore {
  if (!hasStorage()) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<FinanceStore>;
    if (parsed.version !== VERSION) return { ...EMPTY };
    return {
      version: VERSION,
      profile: parsed.profile ?? null,
      profileSavedAt: parsed.profileSavedAt ?? null,
      recentTools: Array.isArray(parsed.recentTools)
        ? parsed.recentTools.slice(0, RECENT_LIMIT)
        : [],
      lastCalculations: Array.isArray(parsed.lastCalculations)
        ? parsed.lastCalculations.slice(0, RECENT_LIMIT)
        : [],
      lastReviewAt: parsed.lastReviewAt ?? null,
    };
  } catch {
    return { ...EMPTY };
  }
}

function writeStore(store: FinanceStore): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    // Quota exceeded or storage disabled — persistence is a convenience,
    // never a requirement.
    return false;
  }
}

/** Save the household profile (called by the Financial Roadmap on valid input). */
export function saveProfile(profile: RoadmapInput, now: Date = new Date()): boolean {
  const store = readStore();
  return writeStore({ ...store, profile, profileSavedAt: now.toISOString() });
}

/** Record a tool visit — newest first, deduped, capped. */
export function recordToolUse(slug: string, name: string, now: Date = new Date()): boolean {
  const store = readStore();
  const rest = store.recentTools.filter((t) => t.slug !== slug);
  const recentTools = [{ slug, name, at: now.toISOString() }, ...rest].slice(0, RECENT_LIMIT);
  return writeStore({ ...store, recentTools });
}

/** Record a tool's last stable calculation — newest first, deduped, capped. */
export function recordCalculation(
  slug: string,
  name: string,
  figures: CalculationFigure[],
  now: Date = new Date()
): boolean {
  const store = readStore();
  const rest = store.lastCalculations.filter((c) => c.slug !== slug);
  const lastCalculations = [{ slug, name, at: now.toISOString(), figures }, ...rest].slice(
    0,
    RECENT_LIMIT
  );
  return writeStore({ ...store, lastCalculations });
}

/**
 * Merge specific fields into the saved profile (explicit user action from a
 * calculator's "Update my plan"). Requires an existing profile — a delta alone
 * cannot invent the other fields, so without a roadmap profile this is a no-op.
 */
export function applyProfileFields(fields: Partial<RoadmapInput>, now: Date = new Date()): boolean {
  const store = readStore();
  if (!store.profile) return false;
  return writeStore({
    ...store,
    profile: { ...store.profile, ...fields },
    profileSavedAt: now.toISOString(),
  });
}

/** Mark the 90-day financial review as done today. */
export function markReviewed(now: Date = new Date()): boolean {
  const store = readStore();
  return writeStore({ ...store, lastReviewAt: now.toISOString() });
}

/** Days until the next review; negative = overdue. Null when never reviewed. */
export function daysUntilReview(store: FinanceStore, now: Date = new Date()): number | null {
  if (!store.lastReviewAt) return null;
  const last = Date.parse(store.lastReviewAt);
  if (!Number.isFinite(last)) return null;
  const due = last + REVIEW_INTERVAL_DAYS * 86_400_000;
  return Math.ceil((due - now.getTime()) / 86_400_000);
}

/** True when the review banner should show: never reviewed (with a profile) or overdue. */
export function reviewDue(store: FinanceStore, now: Date = new Date()): boolean {
  if (!store.profile) return false;
  const days = daysUntilReview(store, now);
  return days === null || days <= 0;
}

/** Erase everything. The whole point of local-only data is that this works. */
export function clearStore(): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** The storage key, exported for cross-tab 'storage' event listeners. */
export const FINANCE_STORAGE_KEY = STORAGE_KEY;

/**
 * Vyora — merchant settings and backup health (V2-002).
 *
 * Two jobs, both pure:
 *  - the merchant's own profile and preferences,
 *  - the honest answer to **"is my data safe?"**, derived from the event log.
 *
 * Settings deliberately do NOT live in the event log. The log is the ledger's
 * history; a shop's name is not a ledger fact. Keeping them apart also means a
 * **restore cannot overwrite the merchant's own profile** with whoever's backup
 * they just imported — which is the behaviour anyone would expect and nobody
 * would think to ask for.
 *
 * Everything is local. No cloud, no login, no server, no sync.
 */

import type { LedgerEvent } from "./events";

export type BackupReminder = "daily" | "weekly" | "never";

export interface MerchantSettings {
  readonly businessName: string;
  readonly ownerName: string;
  readonly phone: string;
  readonly gst: string;
  readonly address: string;
  readonly currency: string;
  readonly language: string;
  readonly backupReminder: BackupReminder;
  /**
   * The credit period the merchant last chose, pre-selected next time.
   * A shop that always gives 30 days should never tap "30 days" twice.
   */
  readonly lastCreditDays: number;
  /**
   * Per-contact preferred credit period, by contact id.
   *
   * Kept in settings rather than on `Party` so the frozen Ledger Engine and
   * event schema stay untouched. The trade-off is that it is a device
   * preference: it does not travel inside an exported ledger.
   */
  readonly contactCreditDays: Readonly<Record<string, number>>;
  /**
   * Free-text notes per business date, written while closing the day.
   *
   * Drafts live here so a merchant can jot something at 4pm and still be
   * writing at 8pm; on "Finish today" the note is copied into the `DayClosed`
   * event, where it becomes part of the signed-off record. Local only.
   */
  readonly dayNotes: Readonly<Record<string, string>>;
  /** Contacts touched most recently, newest first. Powers the quick-pick row. */
  readonly recentContactIds: readonly string[];
  /** Pinned contacts — always shown before everyone else. */
  readonly favoriteContactIds: readonly string[];
  /** The last amount recorded, promoted to a chip. */
  readonly lastAmount: number;
}

export const DEFAULT_SETTINGS: MerchantSettings = {
  businessName: "",
  ownerName: "",
  phone: "",
  gst: "",
  address: "",
  currency: "INR",
  language: "en",
  backupReminder: "weekly",
  lastCreditDays: 30,
  contactCreditDays: {},
  dayNotes: {},
  recentContactIds: [],
  favoriteContactIds: [],
  lastAmount: 0,
};

/** Only non-empty strings survive, capped, de-duplicated. */
function sanitizeIds(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id === "string" && id && !seen.has(id)) seen.add(id);
    if (seen.size >= cap) break;
  }
  return [...seen];
}

function sanitizeDayNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [date, note] of Object.entries(value as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && typeof note === "string") out[date] = note;
  }
  return out;
}

/** Only whole, non-negative, believable credit periods survive a read. */
function sanitizeCreditDays(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 365
    ? value
    : fallback;
}

function sanitizeContactCreditDays(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, days] of Object.entries(value as Record<string, unknown>)) {
    const clean = sanitizeCreditDays(days, -1);
    if (clean >= 0) out[id] = clean;
  }
  return out;
}

/** Coerce anything read off the device into a usable settings object. */
export function normalizeSettings(raw: unknown): MerchantSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const value = raw as Partial<MerchantSettings>;
  const reminder = value.backupReminder;
  return {
    businessName: typeof value.businessName === "string" ? value.businessName : "",
    ownerName: typeof value.ownerName === "string" ? value.ownerName : "",
    phone: typeof value.phone === "string" ? value.phone : "",
    gst: typeof value.gst === "string" ? value.gst : "",
    address: typeof value.address === "string" ? value.address : "",
    currency: typeof value.currency === "string" && value.currency ? value.currency : "INR",
    language: typeof value.language === "string" && value.language ? value.language : "en",
    backupReminder:
      reminder === "daily" || reminder === "weekly" || reminder === "never" ? reminder : "weekly",
    lastCreditDays: sanitizeCreditDays(value.lastCreditDays, 30),
    contactCreditDays: sanitizeContactCreditDays(value.contactCreditDays),
    dayNotes: sanitizeDayNotes(value.dayNotes),
    recentContactIds: sanitizeIds(value.recentContactIds, 10),
    favoriteContactIds: sanitizeIds(value.favoriteContactIds, 50),
    lastAmount: sanitizeCreditDays(value.lastAmount, 0) >= 0 ? Number(value.lastAmount) || 0 : 0,
  };
}

/**
 * The credit period to pre-select: this contact's own preference if they have
 * one, otherwise whatever the merchant chose last time.
 */
export function creditDaysFor(settings: MerchantSettings, contactId?: string): number {
  if (contactId) {
    const preferred = settings.contactCreditDays[contactId];
    if (typeof preferred === "number") return preferred;
  }
  return settings.lastCreditDays;
}

// ─── Backup health ───────────────────────────────────────────────────────────

export type BackupHealth = "backed-up" | "recommended" | "never";

export interface BackupStatus {
  readonly health: BackupHealth;
  readonly lastBackupAt?: string;
  readonly ageDays?: number;
  /** Credits and payments recorded since the last backup — what would be lost. */
  readonly entriesSinceBackup: number;
  readonly headline: string;
  readonly detail: string;
}

const DAY_MS = 86_400_000;

/** How stale a backup may get before the merchant is nudged. */
export function staleAfterDays(reminder: BackupReminder): number {
  if (reminder === "daily") return 1;
  if (reminder === "weekly") return 7;
  return 30; // "never" still warns eventually — silence here would be a lie
}

function daysSince(iso: string, now: number): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / DAY_MS));
}

/**
 * The honest answer to "is my data safe?".
 *
 * Derived from `BackupCreated` events, so it can only ever say a backup
 * happened if one actually did. "Entries since backup" is the number that makes
 * the risk concrete — a merchant understands "31 entries would be lost" far
 * better than "last backup 9 days ago".
 */
export function backupStatus(
  events: readonly LedgerEvent[],
  settings: MerchantSettings,
  nowMs: number = Date.now()
): BackupStatus {
  let lastBackupAt: string | undefined;
  let entriesSinceBackup = 0;

  for (const event of events) {
    if (event.type === "BackupCreated") {
      lastBackupAt = event.at;
      entriesSinceBackup = 0;
      continue;
    }
    if (event.type === "CreditRecorded" || event.type === "PaymentRecorded") {
      entriesSinceBackup += 1;
    }
  }

  if (!lastBackupAt) {
    return {
      health: "never",
      entriesSinceBackup,
      headline: "Never backed up",
      detail:
        entriesSinceBackup > 0
          ? `All ${entriesSinceBackup} entries exist only on this device.`
          : "Export a copy as soon as you start recording.",
    };
  }

  const ageDays = daysSince(lastBackupAt, nowMs);
  const stale = ageDays >= staleAfterDays(settings.backupReminder);
  const entryWord = entriesSinceBackup === 1 ? "entry" : "entries";
  const dayWord = ageDays === 1 ? "day" : "days";

  if (stale || entriesSinceBackup > 0) {
    return {
      health: "recommended",
      lastBackupAt,
      ageDays,
      entriesSinceBackup,
      headline: "Backup recommended",
      detail:
        entriesSinceBackup > 0
          ? `${entriesSinceBackup} ${entryWord} recorded since your last backup.`
          : `Your last backup was ${ageDays} ${dayWord} ago.`,
    };
  }

  return {
    health: "backed-up",
    lastBackupAt,
    ageDays,
    entriesSinceBackup,
    headline: "Your data is backed up",
    detail:
      ageDays === 0
        ? "You backed up today. Nothing new since."
        : `Backed up ${ageDays} ${dayWord} ago, with nothing recorded since.`,
  };
}

/** Bytes → a size a person can read. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Build identity, shown in Settings and Founder Mode.
 *
 * RC1 is the first build put in front of real merchants. The `-rc1` suffix is
 * deliberate and must survive to the pilot: a merchant reporting a problem and
 * an operator reading Founder Mode need to agree on exactly which build they
 * are talking about.
 */
export const APP_VERSION = "1.0.0-rc1";
export const BUILD_DATE = "2026-08-01";

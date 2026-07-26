/**
 * Vyora Alpha — local store (persistence + pure mutations). v0.2.
 *
 * Everything lives in ONE versioned localStorage key on the device. No login,
 * no cloud, no server — the merchant's credit data never leaves their phone.
 *
 * - SSR-safe: reads no-op to empty without `window`.
 * - Corruption-safe: bad payloads read as empty, never throw into the UI.
 * - **Migration-safe (v0.2): an older version is UPGRADED, never wiped.**
 * - Quota-safe: a failed write returns false; it never crashes a screen.
 * - Mutations are PURE (data in → new data out); the provider owns React state.
 *
 * Identity is by immutable `id`. Names are editable and never used as a key,
 * so a slightly different spelling can never fragment a party's ledger.
 */

import type {
  VyoraData,
  Party,
  Transaction,
  Payment,
  EntryKind,
  PaymentKind,
  PaymentMode,
  Meta,
  PartyRef,
  ExportFile,
  TrashEntry,
  VyoraSettings,
} from "./types";
import { todayISO } from "./selectors";

const STORAGE_KEY = "vyora.alpha.v1"; // key name kept stable across schema versions
const BACKUP_KEY = "vyora.alpha.backup";
export const VERSION = 2;
export const APP_VERSION = "0.2.0";
/** Recently-deleted records are recoverable for this long, then pruned (P3-001). */
export const TRASH_RETENTION_DAYS = 30;

function emptyMeta(): Meta {
  return { lastBackupAt: null, exportCount: 0, importCount: 0, lastRestoreAt: null };
}

/** Default merchant settings (P3-002) — INR, Indian number format, no theme override. */
export function defaultSettings(): VyoraSettings {
  return {
    currency: "INR",
    language: "en",
    defaultCreditDays: null,
    defaultPaymentMode: "cash",
    dateFormat: "relative",
    numberFormat: "indian",
    theme: "system",
  };
}

export function emptyData(): VyoraData {
  return {
    version: VERSION,
    parties: [],
    transactions: [],
    payments: [],
    meta: emptyMeta(),
    trash: [],
    settings: defaultSettings(),
    events: [],
  };
}

/** Merge a settings patch onto the current settings (P3-002). Pure. */
export function updateSettings(data: VyoraData, patch: Partial<VyoraSettings>): VyoraData {
  return { ...data, settings: { ...defaultSettings(), ...(data.settings ?? {}), ...patch } };
}

/** Stable unique id. Uses crypto.randomUUID when available (secure contexts). */
export function newId(prefix = "id"): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.round(performance?.now?.() ?? 0).toString(36)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─── Migration (NEVER wipes valid data) ──────────────────────────────────────

/** Coerce any older/loose payload up to the current schema, preserving all entries. */
export function migrate(raw: unknown): VyoraData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<VyoraData>;
  if (!Array.isArray(r.parties) || !Array.isArray(r.transactions) || !Array.isArray(r.payments)) {
    return null; // not a Vyora dataset
  }
  return {
    version: VERSION,
    parties: r.parties as Party[],
    transactions: r.transactions as Transaction[],
    payments: r.payments as Payment[],
    // v1 had no meta — add defaults; this is the v1→v2 migration.
    meta: { ...emptyMeta(), ...(r.meta ?? {}) },
    // Recently-deleted (P3-001) — absent in older payloads; default to empty.
    trash: Array.isArray(r.trash) ? (r.trash as TrashEntry[]) : [],
    // Merchant settings (P3-002) — absent in older payloads; fill defaults.
    settings: { ...defaultSettings(), ...(r.settings ?? {}) },
    // Event log (ARCH-002) — absent in older payloads; the provider seeds a
    // checkpoint on first load so the log is self-sufficient.
    events: Array.isArray(r.events) ? r.events : [],
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function loadData(): VyoraData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const migrated = migrate(JSON.parse(raw));
    if (!migrated) return emptyData();
    // Drop recently-deleted records past their 30-day recovery window (P3-001).
    return pruneTrash(migrated, Date.now());
  } catch {
    return emptyData();
  }
}

export function saveData(data: VyoraData): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // quota / private mode — never crash the UI
  }
}

export function clearData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** How many days old a backup may be before it's considered stale (ENG-007). */
export const BACKUP_STALE_DAYS = 7;

export interface BackupStatus {
  /** Whole days since the last backup, or null if never backed up. */
  ageDays: number | null;
  stale: boolean;
  /** "today" / "3 days ago" / "" when never — the one relative label. */
  ago: string;
}

/**
 * THE single source of truth for backup freshness (ENG-007). Both the Settings
 * backup card and Daily Closing's backup reminder read this, so they can never
 * disagree on whether a backup is stale or how long ago it was.
 */
export function backupStatus(lastBackupAt: string | null, nowMs: number): BackupStatus {
  const t = lastBackupAt ? new Date(lastBackupAt).getTime() : Number.NaN;
  const ageDays = lastBackupAt && !Number.isNaN(t) ? Math.floor((nowMs - t) / 86_400_000) : null;
  const stale = ageDays === null || ageDays > BACKUP_STALE_DAYS;
  const ago =
    ageDays === null
      ? ""
      : ageDays === 0
        ? "today"
        : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`;
  return { ageDays, stale, ago };
}

/** Approximate on-device size of the saved dataset, in bytes (Founder Mode). */
export function storageSizeBytes(): number {
  if (typeof window === "undefined") return 0;
  try {
    return new Blob([window.localStorage.getItem(STORAGE_KEY) ?? ""]).size;
  } catch {
    return (window.localStorage.getItem(STORAGE_KEY) ?? "").length;
  }
}

// ─── Pure mutations ──────────────────────────────────────────────────────────

export function addParty(
  data: VyoraData,
  input: { name: string; phone?: string; note?: string }
): { data: VyoraData; party: Party } {
  const party: Party = {
    id: newId("pty"),
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: nowISO(),
  };
  return { data: { ...data, parties: [...data.parties, party] }, party };
}

/** Edit a party's name/phone/note. The immutable `id` is unchanged, so all history stays intact. */
export function editParty(
  data: VyoraData,
  id: string,
  patch: { name?: string; phone?: string; note?: string }
): VyoraData {
  return {
    ...data,
    parties: data.parties.map((p) =>
      p.id === id
        ? {
            ...p,
            name: patch.name?.trim() || p.name,
            phone: patch.phone !== undefined ? patch.phone.trim() || undefined : p.phone,
            note: patch.note !== undefined ? patch.note.trim() || undefined : p.note,
          }
        : p
    ),
  };
}

/** Resolve a PartyRef to a concrete partyId, creating a party only for an explicit "new". */
export function resolvePartyRef(
  data: VyoraData,
  ref: PartyRef
): { data: VyoraData; partyId: string } {
  if (ref.kind === "existing") return { data, partyId: ref.id };
  const { data: next, party } = addParty(data, { name: ref.name });
  return { data: next, partyId: party.id };
}

export function addTransaction(
  data: VyoraData,
  input: {
    partyId: string;
    amount: number;
    kind: EntryKind;
    description?: string;
    reference?: string;
    date?: string;
    dueDate?: string;
  }
): { data: VyoraData; transaction: Transaction } {
  const transaction: Transaction = {
    id: newId("txn"),
    partyId: input.partyId,
    amount: Math.abs(input.amount),
    kind: input.kind,
    description: input.description?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    date: input.date || todayISO(),
    dueDate: input.dueDate || undefined,
    createdAt: nowISO(),
  };
  return { data: { ...data, transactions: [...data.transactions, transaction] }, transaction };
}

export function addPayment(
  data: VyoraData,
  input: {
    partyId: string;
    amount: number;
    kind: PaymentKind;
    mode?: PaymentMode;
    reference?: string;
    note?: string;
    date?: string;
  }
): { data: VyoraData; payment: Payment } {
  const payment: Payment = {
    id: newId("pay"),
    partyId: input.partyId,
    amount: Math.abs(input.amount),
    kind: input.kind,
    mode: input.mode,
    reference: input.reference?.trim() || undefined,
    note: input.note?.trim() || undefined,
    date: input.date || todayISO(),
    createdAt: nowISO(),
  };
  return { data: { ...data, payments: [...data.payments, payment] }, payment };
}

/** Delete one entry (transaction or payment) by id. */
/**
 * Soft-delete a single credit/payment entry (P3-001): move it to the trash rather
 * than erasing it, so it can be restored (10-second Undo, or Settings → Recently
 * Deleted for 30 days). A no-op if the id isn't found.
 */
export function deleteEntry(data: VyoraData, id: string, deletedAt = nowISO()): VyoraData {
  const txn = data.transactions.find((t) => t.id === id);
  const pay = data.payments.find((p) => p.id === id);
  if (!txn && !pay) return data;
  const entry: TrashEntry = {
    id: newId("trash"),
    deletedAt,
    kind: "entry",
    parties: [],
    transactions: txn ? [txn] : [],
    payments: pay ? [pay] : [],
  };
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== id),
    payments: data.payments.filter((p) => p.id !== id),
    trash: [entry, ...(data.trash ?? [])],
  };
}

/**
 * Soft-delete a contact and its ENTIRE history together (P3-001). The party, its
 * credits and its payments all move into one trash entry so Restore brings the
 * whole ledger back intact. A no-op if the contact isn't found.
 */
export function deleteContact(data: VyoraData, partyId: string, deletedAt = nowISO()): VyoraData {
  const party = data.parties.find((p) => p.id === partyId);
  if (!party) return data;
  const entry: TrashEntry = {
    id: newId("trash"),
    deletedAt,
    kind: "contact",
    parties: [party],
    transactions: data.transactions.filter((t) => t.partyId === partyId),
    payments: data.payments.filter((p) => p.partyId === partyId),
  };
  return {
    ...data,
    parties: data.parties.filter((p) => p.id !== partyId),
    transactions: data.transactions.filter((t) => t.partyId !== partyId),
    payments: data.payments.filter((p) => p.partyId !== partyId),
    trash: [entry, ...(data.trash ?? [])],
  };
}

/**
 * Restore a trash entry back into the active ledger (P3-001). Records already
 * present (by id) are skipped, so a double-restore can never duplicate a ledger.
 * A no-op if the trash id isn't found.
 */
export function restoreFromTrash(data: VyoraData, trashId: string): VyoraData {
  const trash = data.trash ?? [];
  const entry = trash.find((t) => t.id === trashId);
  if (!entry) return data;
  const partyIds = new Set(data.parties.map((p) => p.id));
  const txnIds = new Set(data.transactions.map((t) => t.id));
  const payIds = new Set(data.payments.map((p) => p.id));
  return {
    ...data,
    parties: [...data.parties, ...entry.parties.filter((p) => !partyIds.has(p.id))],
    transactions: [...data.transactions, ...entry.transactions.filter((t) => !txnIds.has(t.id))],
    payments: [...data.payments, ...entry.payments.filter((p) => !payIds.has(p.id))],
    trash: trash.filter((t) => t.id !== trashId),
  };
}

// ─── Demo data (Demo Mode, V1-004) ───────────────────────────────────────────

/** All demo records carry this id prefix, so Reset Demo can remove exactly them. */
export const DEMO_PREFIX = "demo_";

/** How big a demo shop "Load Demo Shop" generates. */
export const DEMO_CUSTOMERS = 120;
export const DEMO_TRANSACTIONS = 2200;
const DEMO_SUPPLIERS = 18; // of the 120 contacts, these are suppliers (I owe them)

/** Deterministic PRNG (mulberry32) — the demo shop is realistic AND reproducible. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Rajesh",
  "Suresh",
  "Amit",
  "Priya",
  "Geeta",
  "Anil",
  "Sunita",
  "Vijay",
  "Meena",
  "Ravi",
  "Kavita",
  "Manoj",
  "Deepak",
  "Pooja",
  "Rahul",
  "Neha",
  "Sanjay",
  "Anita",
  "Arun",
  "Rekha",
  "Sachin",
  "Divya",
  "Kiran",
  "Lata",
];
const LAST = [
  "Kumar",
  "Sharma",
  "Verma",
  "Gupta",
  "Singh",
  "Patel",
  "Yadav",
  "Reddy",
  "Nair",
  "Das",
  "Shah",
  "Mehta",
  "Joshi",
  "Rao",
  "Pillai",
  "Iyer",
];
const SHOP_NAME = [
  "Krishna",
  "Balaji",
  "Sri Sai",
  "New India",
  "Ganesh",
  "Laxmi",
  "Bombay",
  "National",
  "Sunrise",
  "Royal",
  "Metro",
  "Anand",
];
const SHOP_KIND = ["Traders", "Store", "Enterprises", "Suppliers", "Agencies", "Distributors"];
const GOODS = [
  "rice 25kg",
  "cement 3 bags",
  "cooking oil 15L",
  "sugar 10kg",
  "wheat flour",
  "tea packets",
  "biscuit carton",
  "soap case",
  "detergent 5kg",
  "spices box",
  "dal 20kg",
  "milk powder",
  "cold drinks crate",
  "wheat 50kg",
  "ghee tin",
  "salt bag",
];
const MODES: PaymentMode[] = ["cash", "upi", "bank", "cheque"];

/**
 * Load a realistic demo shop (V1-004): ~120 contacts (customers + suppliers) and
 * ~2,200 credit transactions with mixed statuses (overdue / due-soon / settled /
 * good / payable), plus payments and supplier cash flow spread across ~a year.
 * Deterministic (fixed seed) and idempotent (fixed demo_ ids, merges — never
 * touches real data). Dates are relative to `today`.
 */
export function seedDemoData(data: VyoraData, today: string): VyoraData {
  const rng = mulberry32(0x5679_0726);
  const rand = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const shift = (n: number): string => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
  };
  const at = (n: number) => `${shift(n)}T00:00:00.000Z`;

  const parties: Party[] = [];
  const isSupplier = new Set<string>();
  for (let i = 0; i < DEMO_CUSTOMERS; i++) {
    const id = `demo_p${i}`;
    const supplier = i >= DEMO_CUSTOMERS - DEMO_SUPPLIERS;
    if (supplier) isSupplier.add(id);
    const name = supplier
      ? `${pick(SHOP_NAME)} ${pick(SHOP_KIND)}`
      : `${pick(FIRST)} ${pick(LAST)}`;
    const phone = rng() < 0.75 ? `9${rand(100000000, 899999999)}` : undefined;
    parties.push({ id, name, phone, createdAt: at(-rand(30, 400)) });
  }

  // Credit transactions — distributed across contacts, spread across the year.
  const transactions: Transaction[] = [];
  const creditsByParty = new Map<string, Transaction[]>();
  const earliestOffset = new Map<string, number>();
  for (let i = 0; i < DEMO_TRANSACTIONS; i++) {
    const party = parties[rand(0, DEMO_CUSTOMERS - 1)]!;
    const supplier = isSupplier.has(party.id);
    const offset = -rand(1, 360);
    const amount = supplier ? round10(rand(1000, 40000)) : round10(rand(100, 8000));
    const dueOffset = offset + rand(7, 45);
    const txn: Transaction = {
      id: `demo_t${i}`,
      partyId: party.id,
      amount,
      kind: supplier ? "taken" : "given",
      date: shift(offset),
      dueDate: shift(dueOffset),
      description: pick(GOODS),
      reference: rng() < 0.4 ? `B${rand(1000, 9999)}` : undefined,
      createdAt: at(offset),
    };
    transactions.push(txn);
    const list = creditsByParty.get(party.id);
    if (list) list.push(txn);
    else creditsByParty.set(party.id, [txn]);
    const prev = earliestOffset.get(party.id);
    if (prev === undefined || offset < prev) earliestOffset.set(party.id, offset);
  }

  // Payments — each contact repays a realistic fraction (some 0 → overdue, some full → settled).
  const payments: Payment[] = [];
  let rc = 0;
  for (const party of parties) {
    const credits = creditsByParty.get(party.id) ?? [];
    if (credits.length === 0) continue;
    const total = credits.reduce((s, t) => s + t.amount, 0);
    const roll = rng();
    const fraction = roll < 0.18 ? 0 : roll < 0.55 ? 0.3 + rng() * 0.5 : roll < 0.9 ? 1 : 1.05;
    const target = total * fraction;
    if (target < 50) continue;
    const supplier = isSupplier.has(party.id);
    const startOffset = earliestOffset.get(party.id) ?? -30;
    const n = rand(1, 3);
    let paid = 0;
    for (let k = 0; k < n && paid < target; k++) {
      const chunk = k === n - 1 ? target - paid : round10((target / n) * (0.7 + rng() * 0.6));
      const amt = Math.min(target - paid, chunk);
      if (amt < 10) break;
      paid += amt;
      const off = Math.min(0, startOffset + rand(2, 50));
      payments.push({
        id: `demo_r${rc++}`,
        partyId: party.id,
        amount: round10(amt),
        kind: supplier ? "paid" : "received",
        mode: pick(MODES),
        date: shift(off),
        createdAt: at(off),
      });
    }
  }

  const pIds = new Set(data.parties.map((p) => p.id));
  const tIds = new Set(data.transactions.map((t) => t.id));
  const yIds = new Set(data.payments.map((p) => p.id));
  return {
    ...data,
    parties: [...data.parties, ...parties.filter((p) => !pIds.has(p.id))],
    transactions: [...data.transactions, ...transactions.filter((t) => !tIds.has(t.id))],
    payments: [...data.payments, ...payments.filter((p) => !yIds.has(p.id))],
  };
}

/** Remove every demo record (and any demo trash), leaving real data untouched. */
export function clearDemoData(data: VyoraData): VyoraData {
  const real = (id: string) => !id.startsWith(DEMO_PREFIX);
  return {
    ...data,
    parties: data.parties.filter((p) => real(p.id)),
    transactions: data.transactions.filter((t) => real(t.partyId) && real(t.id)),
    payments: data.payments.filter((p) => real(p.partyId) && real(p.id)),
    trash: (data.trash ?? []).filter((e) => real(e.id)),
  };
}

/** Drop trash entries older than the 30-day recovery window (P3-001). */
export function pruneTrash(data: VyoraData, nowMs: number): VyoraData {
  const trash = data.trash ?? [];
  if (trash.length === 0) return data;
  const cutoff = nowMs - TRASH_RETENTION_DAYS * 86_400_000;
  const kept = trash.filter((t) => {
    const ts = new Date(t.deletedAt).getTime();
    return Number.isNaN(ts) || ts >= cutoff; // keep if unparseable — never lose data silently
  });
  return kept.length === trash.length ? data : { ...data, trash: kept };
}

// ─── Export / Import (the merchant owns their data) ──────────────────────────

/** Serialise to a human-readable, versioned, timestamped file. Bumps the export counter. */
export function exportToFile(data: VyoraData): { data: VyoraData; text: string; filename: string } {
  const withCount: VyoraData = {
    ...data,
    meta: { ...data.meta, exportCount: data.meta.exportCount + 1 },
  };
  const file: ExportFile = {
    app: "vyora",
    schemaVersion: VERSION,
    exportedAt: nowISO(),
    data: withCount,
  };
  const stamp = todayISO().replace(/-/g, "");
  return {
    data: withCount,
    text: JSON.stringify(file, null, 2),
    filename: `vyora-backup-${stamp}.json`,
  };
}

export type ImportResult =
  | {
      ok: true;
      data: VyoraData;
      summary: { parties: number; transactions: number; payments: number };
    }
  | { ok: false; error: string };

/** Validate + parse an import file. Never throws; returns a typed result. */
export function parseImportFile(text: string, current: VyoraData): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "This is not a valid Vyora file (could not read it)." };
  }
  const f = parsed as Partial<ExportFile>;
  if (!f || typeof f !== "object" || f.app !== "vyora" || !f.data) {
    return { ok: false, error: "This file was not exported from Vyora." };
  }
  if (typeof f.schemaVersion === "number" && f.schemaVersion > VERSION) {
    return {
      ok: false,
      error: "This file is from a newer version of Vyora. Please update the app first.",
    };
  }
  const migrated = migrate(f.data);
  if (!migrated) {
    return { ok: false, error: "The file is corrupt or incomplete — nothing was changed." };
  }
  // Preserve device-local counters; a fresh import should be backed up again.
  migrated.meta = {
    lastBackupAt: null,
    exportCount: current.meta.exportCount,
    importCount: current.meta.importCount + 1,
  };
  return {
    ok: true,
    data: migrated,
    summary: {
      parties: migrated.parties.length,
      transactions: migrated.transactions.length,
      payments: migrated.payments.length,
    },
  };
}

// ─── Backup / Restore (in-app snapshot, guards against accidental loss) ──────

/** Save a local snapshot + stamp lastBackupAt. Protects against an accidental clear/bad import. */
export function backupNow(data: VyoraData): VyoraData {
  const stamped: VyoraData = { ...data, meta: { ...data.meta, lastBackupAt: nowISO() } };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(BACKUP_KEY, JSON.stringify(stamped));
    } catch {
      /* quota — best effort */
    }
  }
  return stamped;
}

export function hasBackup(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(BACKUP_KEY));
}

/** Restore the last local snapshot, or null if none/corrupt. */
export function restoreBackup(): VyoraData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

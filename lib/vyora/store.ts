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
} from "./types";
import { todayISO } from "./selectors";

const STORAGE_KEY = "vyora.alpha.v1"; // key name kept stable across schema versions
const BACKUP_KEY = "vyora.alpha.backup";
export const VERSION = 2;
export const APP_VERSION = "0.2.0";

function emptyMeta(): Meta {
  return { lastBackupAt: null, exportCount: 0, importCount: 0 };
}

export function emptyData(): VyoraData {
  return { version: VERSION, parties: [], transactions: [], payments: [], meta: emptyMeta() };
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
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function loadData(): VyoraData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const migrated = migrate(JSON.parse(raw));
    return migrated ?? emptyData();
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
export function deleteEntry(data: VyoraData, id: string): VyoraData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== id),
    payments: data.payments.filter((p) => p.id !== id),
  };
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

/**
 * Vyora Alpha — local store (persistence + pure mutations).
 *
 * Mirrors the esytol local-finance store pattern: everything lives in ONE
 * versioned localStorage key on the device. No login, no cloud, no server —
 * the merchant's credit data never leaves their phone. (This is the simplest
 * possible thing to build AND it answers the trust/tax objection from the
 * validation sprint: nobody else can see it.)
 *
 * - SSR-safe: reads no-op to empty without `window`.
 * - Corruption-safe: bad/old payloads read as empty, never throw into the UI.
 * - Quota-safe: a failed write returns false; it never crashes a screen.
 * - Mutations are PURE (data in → new data out); the provider owns React state.
 */

import type { VyoraData, Party, Transaction, Payment, EntryKind, PaymentKind } from "./types";
import { todayISO } from "./selectors";

const STORAGE_KEY = "vyora.alpha.v1";
export const VERSION = 1;

export function emptyData(): VyoraData {
  return { version: VERSION, parties: [], transactions: [], payments: [] };
}

/** Stable unique id. Uses crypto.randomUUID when available. */
export function newId(prefix = "id"): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID()}`;
  // Deterministic-enough fallback (never used on modern browsers / Node ≥ 19).
  return `${prefix}_${Date.now().toString(36)}${Math.round(performance?.now?.() ?? 0).toString(36)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─── Persistence ───────────────────────────────────────────────────────────

export function loadData(): VyoraData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as VyoraData;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.parties)) return emptyData();
    return {
      version: VERSION,
      parties: parsed.parties ?? [],
      transactions: parsed.transactions ?? [],
      payments: parsed.payments ?? [],
    };
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

// ─── Pure mutations (return NEW data; caller persists + sets state) ──────────

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

export function addTransaction(
  data: VyoraData,
  input: {
    partyId: string;
    amount: number;
    kind: EntryKind;
    description?: string;
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
    date: input.date || todayISO(),
    dueDate: input.dueDate || undefined,
    createdAt: nowISO(),
  };
  return { data: { ...data, transactions: [...data.transactions, transaction] }, transaction };
}

export function addPayment(
  data: VyoraData,
  input: { partyId: string; amount: number; kind: PaymentKind; note?: string; date?: string }
): { data: VyoraData; payment: Payment } {
  const payment: Payment = {
    id: newId("pay"),
    partyId: input.partyId,
    amount: Math.abs(input.amount),
    kind: input.kind,
    note: input.note?.trim() || undefined,
    date: input.date || todayISO(),
    createdAt: nowISO(),
  };
  return { data: { ...data, payments: [...data.payments, payment] }, payment };
}

/** Delete one entry (transaction or payment) by id — the minimal "fix a mistake" for Alpha (delete + re-add = edit). */
export function deleteEntry(data: VyoraData, id: string): VyoraData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== id),
    payments: data.payments.filter((p) => p.id !== id),
  };
}

/** Reuse an existing party by name (case-insensitive) or create one — the key to fast entry. */
export function getOrCreateParty(data: VyoraData, name: string): { data: VyoraData; party: Party } {
  const n = name.trim().toLowerCase();
  const existing = data.parties.find((p) => p.name.trim().toLowerCase() === n);
  if (existing) return { data, party: existing };
  return addParty(data, { name });
}

/**
 * Vyora — Import Wizard core (P3-005). Move a merchant in from another ledger in
 * minutes: parse a CSV or JSON export, map its columns to Vyora's fields, validate
 * every row, skip duplicates, and MERGE into the existing ledger (never replace —
 * that's what the backup restore does). Pure and local: no cloud, no network.
 *
 * Only Name and Amount are required. Type is interpreted heuristically (the summary
 * lets the merchant sanity-check the split); Date defaults to today when blank or
 * unreadable so a row is never lost to a formatting quirk.
 */

import type { VyoraData } from "./types";
import { addParty, addTransaction, addPayment } from "./store";

export type VyoraField = "name" | "phone" | "amount" | "date" | "type" | "notes";
export type EntryKindAll = "given" | "taken" | "received" | "paid";
export type DefaultType = EntryKindAll;

export interface ColumnMapping {
  name: string | null;
  phone: string | null;
  amount: string | null;
  date: string | null;
  type: string | null;
  notes: string | null;
}

export interface ParsedSource {
  columns: string[];
  rows: Record<string, string>[];
  format: "csv" | "json";
}

export interface PlannedRow {
  index: number; // original row number (for highlighting)
  raw: Record<string, string>;
  status: "ok" | "invalid" | "duplicate";
  reason?: string;
  name?: string;
  phone?: string;
  amount?: number;
  date?: string;
  kind?: EntryKindAll;
  notes?: string;
}

export interface ImportSummary {
  total: number;
  importable: number;
  invalid: number;
  duplicates: number;
  newContacts: number;
  matchedContacts: number;
}

export interface ImportPlan {
  rows: PlannedRow[];
  summary: ImportSummary;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** A small RFC4180-ish CSV parser: quoted fields, "" escapes, embedded commas/newlines. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    rows.push(record);
    record = [];
  };
  while (i < s.length) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      endField();
      i += 1;
    } else if (ch === "\n") {
      endRecord();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field.length > 0 || record.length > 0) endRecord();
  // Drop fully-blank lines.
  return rows.filter((r) => !(r.length === 1 && r[0]!.trim() === ""));
}

/** Detect CSV vs JSON and normalise to columns + string-valued row objects. */
export function parseImportSource(
  text: string,
  filename: string
): ParsedSource | { error: string } {
  const trimmed = text.trim();
  const looksJson = /\.json$/i.test(filename) || trimmed.startsWith("[") || trimmed.startsWith("{");
  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: "That JSON file could not be read." };
    }
    const container = parsed as Record<string, unknown>;
    const arr: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(container?.rows)
        ? (container.rows as unknown[])
        : Array.isArray(container?.data)
          ? (container.data as unknown[])
          : Array.isArray(container?.entries)
            ? (container.entries as unknown[])
            : [];
    const objs = arr.filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)
    );
    if (objs.length === 0) return { error: "No rows found in the JSON file." };
    const columns = Array.from(new Set(objs.flatMap((o) => Object.keys(o))));
    const rows = objs.map((o) =>
      Object.fromEntries(columns.map((c) => [c, o[c] == null ? "" : String(o[c])]))
    );
    return { columns, rows, format: "json" };
  }

  const table = parseCsv(text);
  if (table.length < 2) {
    return { error: "The CSV needs a header row and at least one data row." };
  }
  const headers = table[0]!.map((h) => h.trim());
  const rows = table.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { columns: headers, rows, format: "csv" };
}

// ─── Mapping & field parsing ─────────────────────────────────────────────────

const FIELD_HINTS: Record<VyoraField, RegExp> = {
  name: /name|customer|party|contact|client|shop/i,
  phone: /phone|mobile|whats\s?app|number|contact\s?no/i,
  amount: /amount|amt|\brs\b|rupee|value|total/i,
  date: /date|day/i,
  type: /type|kind|direction|dr.?\/?cr|nature/i,
  notes: /note|remark|desc|detail|comment|reference|particular|memo/i,
};

/** Best-guess column → field mapping from header names. */
export function guessMapping(columns: string[]): ColumnMapping {
  const pick = (re: RegExp) => columns.find((c) => re.test(c)) ?? null;
  return {
    name: pick(FIELD_HINTS.name),
    phone: pick(FIELD_HINTS.phone),
    amount: pick(FIELD_HINTS.amount),
    date: pick(FIELD_HINTS.date),
    type: pick(FIELD_HINTS.type),
    notes: pick(FIELD_HINTS.notes),
  };
}

/** Parse a money-ish string to a positive number, or null if unusable. */
export function parseAmount(raw: string): number | null {
  const cleaned = String(raw ?? "").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse a date to YYYY-MM-DD. Blank or unreadable → `today` (date never blocks a row). */
export function parseDateISO(raw: string, today: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return today;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/); // day-first (common in India)
  if (m) {
    const dd = m[1]!.padStart(2, "0");
    const mm = m[2]!.padStart(2, "0");
    const yr = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    if (+dd >= 1 && +dd <= 31 && +mm >= 1 && +mm <= 12) return `${yr}-${mm}-${dd}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const p = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return today;
}

/** Interpret a free-text "type" value into a Vyora entry kind, else the fallback. */
export function interpretKind(typeRaw: string | undefined, fallback: DefaultType): EntryKindAll {
  const s = (typeRaw ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (/(receiv|jama|paid in|deposit|settle|repaid|payment in|\bcr\b)/.test(s)) return "received";
  if (/(paid out|i paid|payment out|paid them)/.test(s)) return "paid";
  if (/(taken|i owe|payable|purchase)/.test(s)) return "taken";
  if (/(given|udhaar|udhar|credit|sale|due|receivable|debit|bill|\bdr\b)/.test(s)) return "given";
  return fallback;
}

// ─── Planning ────────────────────────────────────────────────────────────────

/**
 * Validate + dedupe rows against the current ledger, producing a plan the merchant
 * confirms before applying. A row is `invalid` (missing name / bad amount) or a
 * `duplicate` (same contact + kind + amount + date already present, in the ledger
 * or earlier in this file) or `ok`.
 */
export function buildImportPlan(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  defaultType: DefaultType,
  data: VyoraData,
  today: string
): ImportPlan {
  const cell = (row: Record<string, string>, col: string | null) =>
    col ? (row[col] ?? "").trim() : "";

  const existingByName = new Map<string, string>();
  for (const p of data.parties) existingByName.set(p.name.trim().toLowerCase(), p.id);

  const partyNameById = new Map<string, string>();
  for (const p of data.parties) partyNameById.set(p.id, p.name.trim().toLowerCase());
  const seenSig = new Set<string>();
  const sigOf = (norm: string, kind: string, amount: number, date: string) =>
    `${norm}|${kind}|${amount}|${date}`;
  for (const t of data.transactions) {
    const nm = partyNameById.get(t.partyId);
    if (nm) seenSig.add(sigOf(nm, t.kind, t.amount, t.date));
  }
  for (const p of data.payments) {
    const nm = partyNameById.get(p.partyId);
    if (nm) seenSig.add(sigOf(nm, p.kind, p.amount, p.date));
  }

  const importNames = new Set<string>();
  const matchedNames = new Set<string>();
  const planned: PlannedRow[] = rows.map((raw, index) => {
    const name = cell(raw, mapping.name);
    if (!name) return { index, raw, status: "invalid", reason: "Missing name" };
    const amount = parseAmount(cell(raw, mapping.amount));
    if (amount === null || amount <= 0)
      return { index, raw, status: "invalid", reason: "Invalid amount", name };
    const date = parseDateISO(cell(raw, mapping.date), today);
    const kind = interpretKind(cell(raw, mapping.type) || undefined, defaultType);
    const phone = cell(raw, mapping.phone);
    const notes = cell(raw, mapping.notes);
    const norm = name.toLowerCase();
    const sig = sigOf(norm, kind, amount, date);
    if (seenSig.has(sig))
      return {
        index,
        raw,
        status: "duplicate",
        reason: "Already in your ledger",
        name,
        phone: phone || undefined,
        amount,
        date,
        kind,
        notes: notes || undefined,
      };
    seenSig.add(sig);
    if (existingByName.has(norm)) matchedNames.add(norm);
    else if (!importNames.has(norm)) importNames.add(norm);
    return {
      index,
      raw,
      status: "ok",
      name,
      phone: phone || undefined,
      amount,
      date,
      kind,
      notes: notes || undefined,
    };
  });

  return {
    rows: planned,
    summary: {
      total: rows.length,
      importable: planned.filter((p) => p.status === "ok").length,
      invalid: planned.filter((p) => p.status === "invalid").length,
      duplicates: planned.filter((p) => p.status === "duplicate").length,
      newContacts: importNames.size,
      matchedContacts: matchedNames.size,
    },
  };
}

/** Merge the plan's OK rows into the ledger — reusing existing contacts by name. */
export function applyImportPlan(
  input: VyoraData,
  plan: ImportPlan
): { data: VyoraData; contacts: number; entries: number } {
  let data = input;
  const byName = new Map<string, string>();
  for (const p of data.parties) byName.set(p.name.trim().toLowerCase(), p.id);
  let contacts = 0;
  let entries = 0;
  for (const row of plan.rows) {
    if (row.status !== "ok" || !row.name || row.amount == null || !row.kind || !row.date) continue;
    const norm = row.name.toLowerCase();
    let pid = byName.get(norm);
    if (!pid) {
      const r = addParty(data, { name: row.name, phone: row.phone });
      data = r.data;
      pid = r.party.id;
      byName.set(norm, pid);
      contacts += 1;
    }
    if (row.kind === "given" || row.kind === "taken") {
      data = addTransaction(data, {
        partyId: pid,
        amount: row.amount,
        kind: row.kind,
        description: row.notes,
        date: row.date,
      }).data;
    } else {
      data = addPayment(data, {
        partyId: pid,
        amount: row.amount,
        kind: row.kind,
        note: row.notes,
        date: row.date,
      }).data;
    }
    entries += 1;
  }
  return { data, contacts, entries };
}

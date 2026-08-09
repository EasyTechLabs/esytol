/**
 * Reads and writes against the device ledger.
 *
 * The fold here is the same fold the server does — same sign convention, same
 * order, same tiebreak. That is deliberate to the point of being copied
 * line-for-line in spirit: if the phone and the server computed a balance two
 * different ways, they would disagree the moment a rounding or ordering detail
 * differed, and the merchant would have no way to know which screen was lying.
 *
 * Nothing here stores a total. `runningNet` is computed per read.
 */

import type { SqlDatabase } from "./driver";
import { isoNow } from "./migrate";

export type EntryDirection = "given" | "taken" | "received" | "paid";
export type EntryType = "credit" | "payment";

export interface Party {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface Entry {
  id: string;
  partyId: string;
  entryType: EntryType;
  direction: EntryDirection;
  amount: number;
  note: string | null;
  date: string;
  dueDate: string | null;
  createdAt: string;
  synced: boolean;
}

export interface StatementRow extends Entry {
  signedAmount: number;
  runningNet: number;
  label: string;
}

export interface LedgerSummary {
  net: number;
  entryCount: number;
  totals: {
    creditGiven: number;
    creditTaken: number;
    paymentReceived: number;
    paymentPaid: number;
  };
  counts: { credits: number; payments: number };
  pending: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
}

export interface PartyListItem extends Party {
  net: number;
  entryCount: number;
  pending: number;
}

/**
 * Signed effect on "they owe me". The single place the sign convention lives on
 * this device, mirroring `vyora-api/src/modules/ledger/repository.ts`.
 */
export function signedAmount(direction: EntryDirection, amount: number): number {
  switch (direction) {
    case "given":
    case "paid":
      return amount;
    case "taken":
    case "received":
      return -amount;
  }
}

const LABELS: Record<EntryDirection, string> = {
  given: "Credit given",
  taken: "Credit taken",
  received: "Payment received",
  paid: "Payment made",
};

interface PartyRow {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  synced: number;
}

interface EntryRow {
  id: string;
  party_id: string;
  entry_type: EntryType;
  direction: EntryDirection;
  amount: number;
  note: string | null;
  business_date: string;
  due_date: string | null;
  created_at: string;
  synced: number;
}

const toParty = (row: PartyRow): Party => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  note: row.note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  synced: row.synced === 1,
});

const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  partyId: row.party_id,
  entryType: row.entry_type,
  direction: row.direction,
  amount: row.amount,
  note: row.note,
  date: row.business_date,
  dueDate: row.due_date,
  createdAt: row.created_at,
  synced: row.synced === 1,
});

// ── Parties ────────────────────────────────────────────────────────────────

export async function insertParty(
  db: SqlDatabase,
  party: { id: string; name: string; phone?: string | null; note?: string | null },
  now: () => string = isoNow
): Promise<void> {
  const at = now();
  await db.runAsync(
    `INSERT INTO parties (id, name, phone, note, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [party.id, party.name.trim(), party.phone ?? null, party.note ?? null, at, at]
  );
}

export async function findParty(db: SqlDatabase, id: string): Promise<Party | null> {
  const row = await db.getFirstAsync<PartyRow>(`SELECT * FROM parties WHERE id = ?`, [id]);
  return row ? toParty(row) : null;
}

/**
 * The party list, with each party's net.
 *
 * One query, folded in memory, rather than a per-party round trip. A merchant
 * with 400 contacts on a slow phone should not pay 400 SQLite calls to open the
 * first screen of the app.
 */
export async function listParties(db: SqlDatabase): Promise<PartyListItem[]> {
  const parties = await db.getAllAsync<PartyRow>(`SELECT * FROM parties ORDER BY name COLLATE NOCASE`);
  const entries = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries ORDER BY created_at ASC, id ASC`
  );

  const nets = new Map<string, { net: number; entryCount: number; pending: number }>();
  for (const row of entries) {
    const acc = nets.get(row.party_id) ?? { net: 0, entryCount: 0, pending: 0 };
    acc.net += signedAmount(row.direction, row.amount);
    acc.entryCount += 1;
    if (row.synced === 0) acc.pending += 1;
    nets.set(row.party_id, acc);
  }

  return parties.map((row) => {
    const acc = nets.get(row.id) ?? { net: 0, entryCount: 0, pending: 0 };
    return { ...toParty(row), ...acc };
  });
}

// ── Entries ────────────────────────────────────────────────────────────────

export interface NewEntry {
  id: string;
  partyId: string;
  entryType: EntryType;
  direction: EntryDirection;
  amount: number;
  note?: string | null;
  date: string;
  dueDate?: string | null;
}

export async function insertEntry(
  db: SqlDatabase,
  entry: NewEntry,
  now: () => string = isoNow
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries
       (id, party_id, entry_type, direction, amount, note, business_date, due_date, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      entry.id,
      entry.partyId,
      entry.entryType,
      entry.direction,
      entry.amount,
      entry.note ?? null,
      entry.date,
      entry.dueDate ?? null,
      now(),
    ]
  );
}

/** Mark an entry acknowledged by the server. Never changes what it says. */
export async function markEntrySynced(db: SqlDatabase, id: string): Promise<void> {
  await db.runAsync(`UPDATE entries SET synced = 1 WHERE id = ?`, [id]);
}

export async function markPartySynced(db: SqlDatabase, id: string): Promise<void> {
  await db.runAsync(`UPDATE parties SET synced = 1 WHERE id = ?`, [id]);
}

/**
 * A party's statement, oldest first, with the running balance folded.
 *
 * Ordered `(created_at, id)` — the same tiebreak as the server, so the two
 * cannot produce different running totals for the same entries.
 */
export async function readStatement(db: SqlDatabase, partyId: string): Promise<StatementRow[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE party_id = ? ORDER BY created_at ASC, id ASC`,
    [partyId]
  );

  let running = 0;
  return rows.map((row) => {
    const entry = toEntry(row);
    const signed = signedAmount(entry.direction, entry.amount);
    running += signed;
    return { ...entry, signedAmount: signed, runningNet: running, label: LABELS[entry.direction] };
  });
}

/** Totals without the rows. Same fold, so it cannot disagree with the statement. */
export async function readSummary(db: SqlDatabase, partyId: string): Promise<LedgerSummary> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE party_id = ? ORDER BY created_at ASC, id ASC`,
    [partyId]
  );

  const totals = { creditGiven: 0, creditTaken: 0, paymentReceived: 0, paymentPaid: 0 };
  const counts = { credits: 0, payments: 0 };
  let net = 0;
  let pending = 0;

  for (const row of rows) {
    net += signedAmount(row.direction, row.amount);
    if (row.entry_type === "credit") counts.credits += 1;
    else counts.payments += 1;
    if (row.synced === 0) pending += 1;

    switch (row.direction) {
      case "given":
        totals.creditGiven += row.amount;
        break;
      case "taken":
        totals.creditTaken += row.amount;
        break;
      case "received":
        totals.paymentReceived += row.amount;
        break;
      case "paid":
        totals.paymentPaid += row.amount;
        break;
    }
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    net,
    entryCount: rows.length,
    totals,
    counts,
    pending,
    firstActivityAt: first ? first.created_at : null,
    lastActivityAt: last ? last.created_at : null,
  };
}

export async function countUnsyncedEntries(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM entries WHERE synced = 0`
  );
  return row?.n ?? 0;
}

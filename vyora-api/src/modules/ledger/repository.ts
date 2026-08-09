/**
 * Statement reads.
 *
 * Everything here is derived. There is no stored total and no stored running
 * balance — the fold happens per read, exactly as the client's ledger engine
 * does it, so the two cannot drift.
 *
 * Every query is scoped by `merchantId` from the token; there is no overload
 * that omits it.
 */

import type { Pool, PoolClient } from "../../db/pool.js";

export type EntryDirection = "given" | "taken" | "received" | "paid";

export interface LedgerEntry {
  id: string;
  partyId: string;
  entryType: "credit" | "payment";
  direction: EntryDirection;
  amount: number;
  description: string | null;
  date: string;
  dueDate: string | null;
  createdAt: string;
  eventId: string;
}

export interface StatementRow extends LedgerEntry {
  signedAmount: number;
  runningNet: number;
  label: string;
}

/**
 * Signed effect on "they owe me", from the merchant's point of view.
 *
 * `given` — goods handed over, so they owe more. `taken` — received on credit,
 * so the merchant owes more. Payments move the same axis in reverse. This is
 * the one place the sign convention lives.
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

interface Row {
  entry_id: string;
  party_id: string;
  entry_type: "credit" | "payment";
  direction: EntryDirection;
  amount: number;
  description: string | null;
  business_date: string;
  due_date: string | null;
  created_at: Date;
  event_id: string | null;
}

function toEntry(row: Row): LedgerEntry {
  return {
    id: row.entry_id,
    partyId: row.party_id,
    entryType: row.entry_type,
    direction: row.direction,
    amount: row.amount,
    description: row.description,
    date: typeof row.business_date === "string" ? row.business_date : String(row.business_date),
    dueDate: row.due_date === null ? null : String(row.due_date),
    createdAt: row.created_at.toISOString(),
    eventId: row.event_id ?? "",
  };
}

/**
 * Fetch one party's entries, oldest first, and fold the running balance.
 *
 * Ordered by `created_at` then `entry_id` so the running total is stable — two
 * entries recorded in the same millisecond must not reorder between reads, or
 * the statement would appear to change on refresh.
 */
export async function readStatement(
  db: Pool | PoolClient,
  merchantId: string,
  partyId: string,
  limit: number
): Promise<{
  rows: StatementRow[];
  net: number;
  entryCount: number;
  lastActivityAt: string | null;
}> {
  const { rows } = await db.query<Row>(
    `SELECT e.entry_id, e.party_id, e.entry_type, e.direction, e.amount, e.description,
            e.business_date, e.due_date, e.created_at, e.event_id
       FROM entry_projection e
      WHERE e.merchant_id = $1 AND e.party_id = $2 AND e.deleted = false
      ORDER BY e.created_at ASC, e.entry_id ASC
      LIMIT $3`,
    [merchantId, partyId, limit]
  );

  let running = 0;
  const statement: StatementRow[] = rows.map((row) => {
    const entry = toEntry(row);
    const signed = signedAmount(entry.direction, entry.amount);
    running += signed;
    return { ...entry, signedAmount: signed, runningNet: running, label: LABELS[entry.direction] };
  });

  const last = statement[statement.length - 1];
  return {
    rows: statement,
    net: running,
    entryCount: statement.length,
    lastActivityAt: last ? last.createdAt : null,
  };
}

/** Whether an entry id already exists in this workspace, and its content. */
export async function findEntry(
  db: Pool | PoolClient,
  merchantId: string,
  entryId: string
): Promise<LedgerEntry | null> {
  const { rows } = await db.query<Row>(
    `SELECT entry_id, party_id, entry_type, direction, amount, description,
            business_date, due_date, created_at, event_id
       FROM entry_projection
      WHERE merchant_id = $1 AND entry_id = $2`,
    [merchantId, entryId]
  );
  const row = rows[0];
  return row ? toEntry(row) : null;
}

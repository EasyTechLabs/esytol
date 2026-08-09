/**
 * The durable outbox.
 *
 * Every remote write this app makes is queued here first, in the same
 * transaction as the ledger row it delivers. That single fact is what makes the
 * app safe to use with no connection: the merchant's entry is committed to the
 * device before anything is attempted over the network, and the queue is what
 * remembers to try later.
 *
 * Three rules the rest of the app depends on:
 *
 * **The idempotency key is minted once, with the row, and reused for every
 * attempt.** A fresh key per retry turns one action into two entries on the
 * server. This is the single most dangerous mistake available in this file, so
 * the key is written at enqueue time and there is no code path that rewrites it.
 *
 * **A failed attempt is not a lost entry.** Failures increment `attempts`,
 * record the reason and schedule a retry. The ledger row is untouched — it was
 * already true before the network was involved.
 *
 * **`blocked` is not `failed`.** A rejection the server will never accept
 * (malformed body, unknown party, a conflicting entry id) is parked rather than
 * retried forever, because retrying a permanent refusal just burns battery and
 * hides the real problem behind a number that keeps climbing.
 */

import type { SqlDatabase } from "../database/driver";
import { isoNow } from "../database/migrate";

export type OutboxKind = "party" | "credit" | "payment";
export type OutboxStatus = "pending" | "sent" | "blocked";

export interface OutboxRow {
  id: number;
  kind: OutboxKind;
  subjectId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: number;
  kind: OutboxKind;
  subject_id: string;
  idempotency_key: string;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

function toRow(raw: RawRow): OutboxRow {
  return {
    id: raw.id,
    kind: raw.kind,
    subjectId: raw.subject_id,
    idempotencyKey: raw.idempotency_key,
    payload: JSON.parse(raw.payload) as Record<string, unknown>,
    status: raw.status,
    attempts: raw.attempts,
    lastError: raw.last_error,
    nextAttemptAt: raw.next_attempt_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Retry backoff, in milliseconds, indexed by attempts already made.
 *
 * Short at first — most failures are a shop's connection dropping for a few
 * seconds — then widening, and capped. The cap matters: an unbounded backoff
 * eventually schedules a retry so far out that the entry is effectively
 * abandoned without anything ever saying so.
 */
export const BACKOFF_MS = [0, 5_000, 15_000, 60_000, 300_000, 900_000] as const;
export const MAX_BACKOFF_MS = BACKOFF_MS[BACKOFF_MS.length - 1];

export function backoffFor(attempts: number): number {
  if (attempts <= 0) return 0;
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? MAX_BACKOFF_MS;
}

export interface EnqueueInput {
  kind: OutboxKind;
  subjectId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

/**
 * Queue one delivery.
 *
 * Call this **inside** the transaction that writes the ledger row. Outside it,
 * a crash between the two leaves either an entry the server never hears about
 * or a delivery for an entry that does not exist.
 */
export async function enqueue(
  db: SqlDatabase,
  input: EnqueueInput,
  now: () => string = isoNow
): Promise<void> {
  const at = now();
  await db.runAsync(
    `INSERT INTO outbox
       (kind, subject_id, idempotency_key, payload, status, attempts, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    [input.kind, input.subjectId, input.idempotencyKey, JSON.stringify(input.payload), at, at, at]
  );
}

/**
 * The next deliveries, in insertion order, **including ones not yet due**.
 *
 * Ordering is a correctness requirement, not an optimisation: a party must
 * reach the server before the entries that reference it, or those entries come
 * back `404` — a permanent refusal that gets them parked as "needs attention"
 * when in truth nothing is wrong.
 *
 * That is why this deliberately does *not* filter out rows sitting on a
 * backoff. Filtering them would let a later entry jump ahead of the very row it
 * depends on, which is exactly the bug the live end-to-end run exposed: one
 * dropped connection deferred a party, the next drain skipped it, and the
 * credit behind it was refused and blocked. The caller stops at the first row
 * that is not yet due; see `drain`.
 */
export async function pending(db: SqlDatabase, limit = 20): Promise<OutboxRow[]> {
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ?`,
    [limit]
  );
  return rows.map(toRow);
}

/** Whether a row may be attempted now. */
export function isDue(row: OutboxRow, now: () => string = isoNow): boolean {
  return row.nextAttemptAt === null || row.nextAttemptAt <= now();
}

export async function markSent(db: SqlDatabase, id: number, now: () => string = isoNow) {
  await db.runAsync(
    `UPDATE outbox SET status = 'sent', last_error = NULL, next_attempt_at = NULL, updated_at = ?
      WHERE id = ?`,
    [now(), id]
  );
}

/** A failure worth trying again — no connection, a 5xx, a timeout. */
export async function markRetryable(
  db: SqlDatabase,
  id: number,
  error: string,
  clock: () => number = Date.now,
  now: () => string = isoNow
): Promise<void> {
  const row = await db.getFirstAsync<{ attempts: number }>(
    `SELECT attempts FROM outbox WHERE id = ?`,
    [id]
  );
  const attempts = (row?.attempts ?? 0) + 1;
  const nextAt = new Date(clock() + backoffFor(attempts)).toISOString();

  await db.runAsync(
    `UPDATE outbox SET attempts = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
      WHERE id = ?`,
    [attempts, error, nextAt, now(), id]
  );
}

/**
 * A refusal the server will never change its mind about.
 *
 * Parked, not deleted. The merchant's entry stays on the device and stays
 * visible; what stops is the pointless retrying. Something has to surface these
 * — see the sync status screen.
 */
export async function markBlocked(
  db: SqlDatabase,
  id: number,
  error: string,
  now: () => string = isoNow
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox SET status = 'blocked', last_error = ?, next_attempt_at = NULL, updated_at = ?
      WHERE id = ?`,
    [error, now(), id]
  );
}

export interface OutboxCounts {
  pending: number;
  sent: number;
  blocked: number;
}

export async function counts(db: SqlDatabase): Promise<OutboxCounts> {
  const rows = await db.getAllAsync<{ status: OutboxStatus; n: number }>(
    `SELECT status, count(*) AS n FROM outbox GROUP BY status`
  );
  const out: OutboxCounts = { pending: 0, sent: 0, blocked: 0 };
  for (const row of rows) out[row.status] = row.n;
  return out;
}

export async function blocked(db: SqlDatabase): Promise<OutboxRow[]> {
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM outbox WHERE status = 'blocked' ORDER BY id ASC`
  );
  return rows.map(toRow);
}

/**
 * Put a blocked delivery back in the queue.
 *
 * Attempts reset, key unchanged. Reusing the key is what makes this safe: if
 * the original attempt did in fact reach the server before whatever went wrong,
 * the retry replays it rather than duplicating it.
 */
export async function retryBlocked(
  db: SqlDatabase,
  id: number,
  now: () => string = isoNow
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox SET status = 'pending', attempts = 0, next_attempt_at = NULL, updated_at = ?
      WHERE id = ? AND status = 'blocked'`,
    [now(), id]
  );
}

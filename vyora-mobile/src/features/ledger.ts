/**
 * What a merchant's action actually does.
 *
 * Each function here writes the ledger row and queues its delivery **in one
 * transaction**. That pairing is the whole offline-first design, and it is
 * worth being precise about why it is not the "dual write" the web app forbids.
 *
 * On the web, a remote write goes to the API *instead of* local storage; the
 * two stores have no reconciliation between them, so writing both would leave
 * two records of one action with no way to tell which is real.
 *
 * Here there is exactly one record: the SQLite row. The outbox does not hold a
 * second copy of the truth — it holds a *delivery instruction* referencing that
 * row. Dropping the entire outbox would lose no merchant data; it would only
 * mean the server never hears about it. That is why the same action can safely
 * do both, and why nothing in this file writes an entry twice.
 *
 * Ids are minted on the device. An entry exists, with an identity, from the
 * moment the merchant records it — before any network is involved and whether
 * or not one ever appears.
 */

import type { SqlDatabase } from "../database/driver";
import {
  insertEntry,
  insertParty,
  type EntryDirection,
  type NewEntry,
} from "../database/repository";
import { enqueue } from "../sync/outbox";
import { isoNow } from "../database/migrate";

/** UUID v4 from the platform's crypto, with a documented fallback. */
export function newUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Hermes exposes crypto.getRandomValues but not always randomUUID. This is
  // still a v4 layout, sourced from Math.random only as a last resort — good
  // enough for a development build, and never reached on a real device.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const todayLocalISO = (now: Date = new Date()): string => {
  // The merchant's calendar day, not UTC's. A sale at 9pm on the 4th belongs to
  // the 4th's book; `toISOString()` would file it under the 5th in India.
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export interface RecordedEntry {
  readonly entryId: string;
  readonly idempotencyKey: string;
}

export interface CreatePartyInput {
  name: string;
  phone?: string | null;
  note?: string | null;
}

export async function createParty(
  db: SqlDatabase,
  input: CreatePartyInput,
  now: () => string = isoNow
): Promise<string> {
  const id = `pty_${newUuid()}`;
  const createdAt = now();

  await db.withTransactionAsync(async () => {
    await insertParty(db, { id, name: input.name, phone: input.phone, note: input.note }, () => createdAt);
    await enqueue(
      db,
      {
        kind: "party",
        subjectId: id,
        idempotencyKey: newUuid(),
        payload: {
          id,
          name: input.name.trim(),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.note ? { note: input.note } : {}),
          createdAt,
        },
      },
      () => createdAt
    );
  });

  return id;
}

export interface RecordCreditInput {
  partyId: string;
  amount: number;
  kind: Extract<EntryDirection, "given" | "taken">;
  description?: string | null;
  date?: string;
  dueDate?: string | null;
}

export async function recordCredit(
  db: SqlDatabase,
  input: RecordCreditInput,
  now: () => string = isoNow
): Promise<RecordedEntry> {
  const entryId = `txn_${newUuid()}`;
  const idempotencyKey = newUuid();
  const createdAt = now();
  const date = input.date ?? todayLocalISO();

  const entry: NewEntry = {
    id: entryId,
    partyId: input.partyId,
    entryType: "credit",
    direction: input.kind,
    amount: input.amount,
    note: input.description ?? null,
    date,
    dueDate: input.dueDate ?? null,
  };

  await db.withTransactionAsync(async () => {
    await insertEntry(db, entry, () => createdAt);
    await enqueue(
      db,
      {
        kind: "credit",
        subjectId: entryId,
        idempotencyKey,
        payload: {
          partyId: input.partyId,
          id: entryId,
          amount: input.amount,
          kind: input.kind,
          ...(input.description ? { description: input.description } : {}),
          date,
          ...(input.dueDate ? { dueDate: input.dueDate } : {}),
          createdAt,
        },
      },
      () => createdAt
    );
  });

  return { entryId, idempotencyKey };
}

export interface RecordPaymentInput {
  partyId: string;
  amount: number;
  kind: Extract<EntryDirection, "received" | "paid">;
  note?: string | null;
  date?: string;
}

export async function recordPayment(
  db: SqlDatabase,
  input: RecordPaymentInput,
  now: () => string = isoNow
): Promise<RecordedEntry> {
  const entryId = `pay_${newUuid()}`;
  const idempotencyKey = newUuid();
  const createdAt = now();
  const date = input.date ?? todayLocalISO();

  const entry: NewEntry = {
    id: entryId,
    partyId: input.partyId,
    entryType: "payment",
    direction: input.kind,
    amount: input.amount,
    note: input.note ?? null,
    date,
    dueDate: null,
  };

  await db.withTransactionAsync(async () => {
    await insertEntry(db, entry, () => createdAt);
    await enqueue(
      db,
      {
        kind: "payment",
        subjectId: entryId,
        idempotencyKey,
        payload: {
          partyId: input.partyId,
          id: entryId,
          amount: input.amount,
          kind: input.kind,
          ...(input.note ? { note: input.note } : {}),
          date,
          createdAt,
        },
      },
      () => createdAt
    );
  });

  return { entryId, idempotencyKey };
}

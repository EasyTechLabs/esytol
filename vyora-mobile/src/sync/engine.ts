/**
 * Draining the outbox.
 *
 * This is the only place in the app that talks to the network on the merchant's
 * behalf, and it is deliberately dull: take the due deliveries in order, send
 * each one, record what the server said. It creates nothing, decides nothing
 * about the ledger, and cannot modify an entry — an entry was already true
 * before this ran.
 *
 * **Delivery stops at the first retryable failure.** Once the connection is
 * gone, the next twenty attempts will fail identically; continuing would just
 * inflate every row's `attempts` count and push them all onto long backoffs for
 * one outage. Permanent refusals do not stop the drain, because those are about
 * one specific row and the rest of the queue is unaffected.
 *
 * This is **not sync.** Sync reconciles two devices' logs in both directions and
 * remains inert. This pushes writes the merchant already made, one at a time.
 */

import type { SqlDatabase } from "../database/driver";
import { markEntrySynced, markPartySynced } from "../database/repository";
import type { ApiClient } from "../api/client";
import * as outbox from "./outbox";
import type { OutboxRow } from "./outbox";

export interface DrainResult {
  readonly attempted: number;
  readonly sent: number;
  readonly blocked: number;
  readonly deferred: number;
  /** Set when the drain stopped early because the network is unavailable. */
  readonly stoppedBecause: string | null;
}

export interface DrainOptions {
  readonly limit?: number;
  readonly clock?: () => number;
  readonly now?: () => string;
}

/**
 * Send one delivery.
 *
 * The idempotency key comes from the row and is passed through untouched. It is
 * never regenerated here — that is what makes a retry after an unknown outcome
 * safe rather than duplicating a merchant's entry.
 */
async function deliver(api: ApiClient, row: OutboxRow) {
  const options = { idempotencyKey: row.idempotencyKey };
  switch (row.kind) {
    case "party":
      return api.createParty(row.payload, options);
    case "credit":
      return api.recordCredit(String(row.payload.partyId), bodyOf(row), options);
    case "payment":
      return api.recordPayment(String(row.payload.partyId), bodyOf(row), options);
  }
}

/**
 * The wire body.
 *
 * `partyId` is stripped: it is in the path, and the contract's request schemas
 * are `additionalProperties: false`, so sending it would be rejected as a
 * validation failure — a permanent one, on every entry.
 */
function bodyOf(row: OutboxRow): Record<string, unknown> {
  const { partyId: _partyId, ...body } = row.payload;
  return body;
}

export async function drain(
  db: SqlDatabase,
  api: ApiClient,
  options: DrainOptions = {}
): Promise<DrainResult> {
  const rows = await outbox.due(db, options.limit ?? 20, options.now);

  let attempted = 0;
  let sent = 0;
  let blockedCount = 0;
  let deferred = 0;
  let stoppedBecause: string | null = null;

  for (const row of rows) {
    attempted += 1;
    const outcome = await deliver(api, row);

    if (outcome.kind === "ok") {
      // Mark both in one transaction. A crash between them would leave an entry
      // that stays "pending" forever with nothing left in the queue to clear it.
      await db.withTransactionAsync(async () => {
        await outbox.markSent(db, row.id, options.now);
        if (row.kind === "party") await markPartySynced(db, row.subjectId);
        else await markEntrySynced(db, row.subjectId);
      });
      sent += 1;
      continue;
    }

    if (outcome.kind === "permanent") {
      await outbox.markBlocked(db, row.id, `${outcome.code}: ${outcome.message}`, options.now);
      blockedCount += 1;
      continue;
    }

    // Retryable. Back off this row and stop — the rest would fail the same way.
    await outbox.markRetryable(db, row.id, outcome.message, options.clock, options.now);
    deferred += 1;
    stoppedBecause = outcome.message;
    break;
  }

  return { attempted, sent, blocked: blockedCount, deferred, stoppedBecause };
}

export interface SyncStatus {
  readonly pending: number;
  readonly blocked: number;
  readonly sent: number;
  readonly lastResult: DrainResult | null;
  readonly lastRunAt: string | null;
}

export async function readStatus(
  db: SqlDatabase,
  lastResult: DrainResult | null = null,
  lastRunAt: string | null = null
): Promise<SyncStatus> {
  const c = await outbox.counts(db);
  return { pending: c.pending, blocked: c.blocked, sent: c.sent, lastResult, lastRunAt };
}

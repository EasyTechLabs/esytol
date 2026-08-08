/**
 * The single server-side event-application path.
 *
 * Everything that changes a projection goes through `appendAndApply`, and
 * nothing else writes to a projection table. `POST /parties`, `PATCH /parties`
 * and `POST /sync/push` all mint an event and hand it here.
 *
 * That is the whole design. A REST write that updated a row *and* wrote an
 * event would give two implementations of what a change means, and they would
 * diverge — silently, because each is individually self-consistent. One path
 * makes that impossible rather than merely discouraged.
 */

import type { PoolClient } from "../db/pool.js";

export const EVENT_TYPES = [
  "ContactCreated",
  "ContactUpdated",
  "ContactDeleted",
  "CreditRecorded",
  "PaymentRecorded",
  "DueDateChanged",
  "EntryDeleted",
  "ContactReminded",
  "DayClosed",
  "BackupCreated",
  "RestoreCompleted",
  "ImportCompleted",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** Carry a full projection snapshot. Never accepted by sync in v1. */
export const SNAPSHOT_EVENT_TYPES: readonly EventType[] = ["RestoreCompleted", "ImportCompleted"];

/** Record what the merchant did without moving a balance. */
const AUDIT_ONLY: readonly EventType[] = ["ContactReminded", "DayClosed", "BackupCreated"];

export function isSnapshotEvent(type: string): boolean {
  return (SNAPSHOT_EVENT_TYPES as readonly string[]).includes(type);
}

export function isKnownEventType(type: string): type is EventType {
  return (EVENT_TYPES as readonly string[]).includes(type);
}

/** Anything a validated event payload field can hold. */
type PayloadValue = string | number | boolean | null | undefined | Record<string, unknown>;

/** Read a nested record from a payload — e.g. the `party` of a ContactCreated. */
function record(value: PayloadValue): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

export interface IncomingEvent {
  readonly eventId: string;
  readonly type: string;
  readonly aggregateId?: string | null;
  readonly payload: Record<string, unknown>;
  readonly payloadVersion: number;
  readonly occurredAt: string;
  readonly causationId?: string | null;
}

export interface StoredEvent extends IncomingEvent {
  readonly deviceId: string;
  readonly schemaVersion: number;
  readonly recordedAt: string;
}

export type AppendOutcome =
  | { readonly status: "accepted"; readonly recordedAt: string }
  | { readonly status: "duplicate"; readonly recordedAt: string }
  | { readonly status: "conflict"; readonly recordedAt: string };

/**
 * Append one event and fold it into the projections.
 *
 * Idempotent on `(merchantId, eventId)`. A re-pushed event returns `duplicate`
 * with its **original** `recordedAt`, so an event's place in history never
 * moves — which is what makes retrying free rather than merely tolerable.
 *
 * The same id with a *different* payload is a `conflict`, never an overwrite:
 * guessing which version is real could destroy a correct entry.
 */
export async function appendAndApply(
  client: PoolClient,
  merchantId: string,
  deviceId: string,
  schemaVersion: number,
  event: IncomingEvent
): Promise<AppendOutcome> {
  const payloadJson = JSON.stringify(event.payload);

  const inserted = await client.query<{ recorded_at: Date }>(
    `INSERT INTO events
       (merchant_id, event_id, device_id, type, aggregate_id, payload,
        payload_version, schema_version, occurred_at, causation_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
     ON CONFLICT (merchant_id, event_id) DO NOTHING
     RETURNING recorded_at`,
    [
      merchantId,
      event.eventId,
      deviceId,
      event.type,
      event.aggregateId ?? null,
      payloadJson,
      event.payloadVersion,
      schemaVersion,
      event.occurredAt,
      event.causationId ?? null,
    ]
  );

  if (inserted.rowCount === 0) {
    // Already held. Same payload → duplicate (a success). Different payload →
    // conflict, surfaced rather than silently resolved.
    //
    // The comparison runs in SQL as `jsonb = jsonb`. Comparing serialised
    // strings would be wrong: jsonb does not preserve key order, so a genuine
    // duplicate round-trips with its keys rearranged and would be misread as a
    // conflict — the client would then quarantine a perfectly good event and
    // its outbox would never drain.
    const existing = await client.query<{ recorded_at: Date; same: boolean }>(
      `SELECT recorded_at, (type = $3 AND payload = $4::jsonb) AS same
         FROM events
        WHERE merchant_id = $1 AND event_id = $2`,
      [merchantId, event.eventId, event.type, payloadJson]
    );
    const row = existing.rows[0];
    if (!row) throw new Error(`event ${event.eventId} vanished between insert and read`);
    return {
      status: row.same ? "duplicate" : "conflict",
      recordedAt: row.recorded_at.toISOString(),
    };
  }

  const recordedAt = inserted.rows[0]!.recorded_at.toISOString();
  await applyToProjection(client, merchantId, event);
  return { status: "accepted", recordedAt };
}

/**
 * Fold one event into the projections.
 *
 * Total: every known type has a case and an unknown one is a no-op rather than
 * a throw. Unknown types never reach here — sync rejects them at the boundary —
 * but a projection rebuild over historical data must not be able to crash.
 */
async function applyToProjection(
  client: PoolClient,
  merchantId: string,
  event: IncomingEvent
): Promise<void> {
  if ((AUDIT_ONLY as readonly string[]).includes(event.type)) return;

  // The payload's shape is decided by `event.type`, which the switch below
  // narrows. It has already been validated against the contract schema for that
  // type by the time it reaches here.
  const p = event.payload as Record<string, PayloadValue>;

  switch (event.type) {
    case "ContactCreated": {
      const party = record(p.party);
      await client.query(
        `INSERT INTO party_projection
           (merchant_id, party_id, name, phone, note, created_at, updated_at, version, deleted)
         VALUES ($1, $2, $3, $4, $5, $6, $6, 1, false)
         ON CONFLICT (merchant_id, party_id) DO NOTHING`,
        [merchantId, party.id, party.name, party.phone ?? null, party.note ?? null, party.createdAt]
      );
      return;
    }

    case "ContactUpdated": {
      const changes = record(p.changes);
      // COALESCE on an absent key leaves the column alone; an explicit null
      // clears it. That is JSON Merge Patch semantics, kept in one place.
      await client.query(
        `UPDATE party_projection
            SET name    = COALESCE($3, name),
                phone   = CASE WHEN $4::boolean THEN $5 ELSE phone END,
                note    = CASE WHEN $6::boolean THEN $7 ELSE note END,
                updated_at = $8,
                version = version + 1
          WHERE merchant_id = $1 AND party_id = $2`,
        [
          merchantId,
          p.partyId,
          changes.name ?? null,
          Object.hasOwn(changes, "phone"),
          changes.phone ?? null,
          Object.hasOwn(changes, "note"),
          changes.note ?? null,
          event.occurredAt,
        ]
      );
      return;
    }

    case "ContactDeleted": {
      // A tombstone. The party leaves the projection; its events stay in the
      // log, which is what keeps replay deterministic.
      await client.query(
        `UPDATE party_projection SET deleted = true, version = version + 1, updated_at = $3
          WHERE merchant_id = $1 AND party_id = $2`,
        [merchantId, p.partyId, event.occurredAt]
      );
      await client.query(
        `UPDATE entry_projection SET deleted = true
          WHERE merchant_id = $1 AND party_id = $2`,
        [merchantId, p.partyId]
      );
      return;
    }

    case "CreditRecorded": {
      const t = record(p.transaction);
      await client.query(
        `INSERT INTO entry_projection
           (merchant_id, entry_id, party_id, entry_type, direction, amount,
            business_date, due_date, created_at, deleted)
         VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7, $8, false)
         ON CONFLICT (merchant_id, entry_id) DO NOTHING`,
        [merchantId, t.id, t.partyId, t.kind, t.amount, t.date, t.dueDate ?? null, t.createdAt]
      );
      return;
    }

    case "PaymentRecorded": {
      const pay = record(p.payment);
      await client.query(
        `INSERT INTO entry_projection
           (merchant_id, entry_id, party_id, entry_type, direction, amount,
            business_date, due_date, created_at, deleted)
         VALUES ($1, $2, $3, 'payment', $4, $5, $6, NULL, $7, false)
         ON CONFLICT (merchant_id, entry_id) DO NOTHING`,
        [merchantId, pay.id, pay.partyId, pay.kind, pay.amount, pay.date, pay.createdAt]
      );
      return;
    }

    case "DueDateChanged":
      await client.query(
        `UPDATE entry_projection SET due_date = $3
          WHERE merchant_id = $1 AND entry_id = $2`,
        [merchantId, p.transactionId, p.dueDate ?? null]
      );
      return;

    case "EntryDeleted":
      await client.query(
        `UPDATE entry_projection SET deleted = true
          WHERE merchant_id = $1 AND entry_id = $2`,
        [merchantId, p.entryId]
      );
      return;

    // Snapshot events are rejected before they reach the log in sync v1, and
    // the REST surface never mints one. Reaching here would mean a historical
    // event from a future version of the protocol; leaving the projection
    // untouched is the safe reading.
    case "RestoreCompleted":
    case "ImportCompleted":
    default:
      return;
  }
}

/**
 * Vyora — the wire shape of an event (WEB-SYNC-002).
 *
 * The web event log and the API's log v2 are the same model. That is not luck:
 * the contract's own `VyoraId` says so, in the schema, about the ids this file
 * sends —
 *
 * > This format already exists on merchants' devices
 *
 * — and every payload in the contract is the body of the corresponding
 * `LedgerEvent`: `ContactCreatedPayload` is `{party}`, `CreditRecordedPayload`
 * is `{transaction}`, `PaymentRecordedPayload` is `{payment}`. The API was
 * shaped around this engine.
 *
 * So this module is a translation of the *envelope* and nothing else:
 *
 *     web    { id, at, type, ...body }
 *     wire   { eventId, occurredAt, type, payloadVersion, aggregateId, payload: body }
 *
 * It does not transform, normalise, round, or reinterpret a single value. If it
 * ever needs to, that is a signal the two models have diverged and the answer
 * is a contract change — not a fix-up here that makes one of them silently lie
 * about the other.
 *
 * ## Snapshots do not travel
 *
 * `RestoreCompleted` and `ImportCompleted` carry a whole projection, and sync
 * refuses them at the server boundary: one arriving out of order would discard
 * newer events from another client, which is the precise data loss that
 * event-based sync exists to prevent. They are filtered here too, so a browser
 * that has restored a backup pushes the events either side of it and never
 * spends a round trip being told no.
 */

import type { LedgerEvent } from "../events";

/** Envelope version of every event this client speaks. */
export const PAYLOAD_VERSION = 1;
/** Envelope `schemaVersion` for the batch. */
export const SCHEMA_VERSION = 1;

export interface ClientEvent {
  readonly eventId: string;
  readonly type: string;
  readonly aggregateId: string | null;
  readonly payloadVersion: number;
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
}

export interface RemoteEvent {
  readonly eventId: string;
  readonly type: string;
  readonly aggregateId: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

/** Events sync will never carry, in either direction. */
export function isSnapshot(type: string): boolean {
  return type === "RestoreCompleted" || type === "ImportCompleted";
}

/**
 * What this event is *about*.
 *
 * Diagnostic rather than load-bearing — the server stores it and nothing in
 * either projection reads it — but a log where every row can be traced to a
 * party or an entry is worth the six lines it costs.
 */
function aggregateOf(event: LedgerEvent): string | null {
  switch (event.type) {
    case "ContactCreated":
      return event.party.id;
    case "ContactUpdated":
    case "ContactDeleted":
    case "ContactReminded":
      return event.partyId;
    case "CreditRecorded":
      return event.transaction.id;
    case "PaymentRecorded":
      return event.payment.id;
    case "DueDateChanged":
      return event.transactionId;
    case "EntryDeleted":
      return event.entryId;
    default:
      return null;
  }
}

/**
 * The payload: the event minus its envelope.
 *
 * Built by removing `id`, `at` and `type` rather than by listing the fields of
 * each of the twelve types. Every payload schema in the contract is
 * `additionalProperties: false`, so a hand-written mapping that forgot a field
 * would be a per-event `422` on the one event type nobody tested — and one that
 * invented a field would be the same. Subtraction cannot drift; enumeration
 * can.
 */
const ENVELOPE_FIELDS = ["id", "at", "type"] as const;

function payloadOf(event: LedgerEvent): Record<string, unknown> {
  const body: Record<string, unknown> = { ...(event as unknown as Record<string, unknown>) };
  for (const field of ENVELOPE_FIELDS) delete body[field];
  return body;
}

export function toClientEvent(event: LedgerEvent): ClientEvent {
  return {
    eventId: event.id,
    type: event.type,
    aggregateId: aggregateOf(event),
    payloadVersion: PAYLOAD_VERSION,
    // The merchant's clock, when they did it — never the moment it was sent.
    // A week-old entry pushed today belongs to the day it happened.
    occurredAt: event.at,
    payload: payloadOf(event),
  };
}

/**
 * Rebuild a local event from one the server returned.
 *
 * The reverse of `toClientEvent` and deliberately as dull. `recordedAt` — the
 * server's clock — is **not** folded into the event: it is the log's ordering,
 * kept beside the record in the store, and putting it inside would make two
 * clients' copies of the same event differ.
 */
export function fromRemoteEvent(remote: RemoteEvent): LedgerEvent | null {
  if (isSnapshot(remote.type)) return null;
  return {
    id: remote.eventId,
    at: remote.occurredAt,
    type: remote.type,
    ...remote.payload,
  } as LedgerEvent;
}

/** A batch, oldest first. Snapshots are dropped rather than offered. */
export function toBatch(events: readonly LedgerEvent[]): ClientEvent[] {
  return events.filter((event) => !isSnapshot(event.type)).map(toClientEvent);
}

/**
 * Sync endpoints.
 *
 * Push appends; it never replaces server state. There is no code path here that
 * writes a projection from a submitted document — every change goes through
 * `appendAndApply`, one event at a time.
 */

import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../server.js";
import { withTransaction } from "../../db/pool.js";
import { appendAndApply, isKnownEventType, isSnapshotEvent } from "../../events/apply.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import {
  badRequest,
  payloadTooLarge,
  schemaVersionUnsupported,
  validationFailed,
  type FieldError,
} from "../../errors.js";

type RejectionReason =
  | "SNAPSHOT_EVENT_UNSUPPORTED"
  | "UNKNOWN_EVENT_TYPE"
  | "PAYLOAD_VERSION_UNSUPPORTED"
  | "PAYLOAD_INVALID"
  | "EVENT_ID_CONFLICT"
  | "EVENT_ID_MALFORMED"
  | "OCCURRED_AT_OUT_OF_RANGE"
  | "AGGREGATE_MISMATCH";

interface Rejected {
  eventId: string;
  reason: RejectionReason;
  message: string;
  details?: FieldError[];
}

const EVENT_ID_RE = /^evt_[A-Za-z0-9-]{8,64}$/;

/** Contract schema name for a given event type, e.g. ContactCreated → ContactCreatedEvent. */
const eventSchemaName = (type: string): string => `${type}Event`;

export function registerSyncRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ── POST /api/v1/sync/push ────────────────────────────────────────────────
  app.post("/api/v1/sync/push", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const body = request.body as {
      deviceId?: string;
      schemaVersion?: number;
      events?: unknown[];
    };

    if (typeof body?.deviceId !== "string" || !Array.isArray(body.events)) {
      throw badRequest("deviceId and events are required.");
    }
    if (body.events.length === 0) throw badRequest("events must contain at least one event.");
    if (body.events.length > ctx.config.maxBatchEvents) {
      throw payloadTooLarge(
        `Batch of ${body.events.length} exceeds the limit of ${ctx.config.maxBatchEvents}. Split and retry.`
      );
    }

    // Batch-level: refuse the whole request and consume nothing, so the
    // client's outbox survives being out of date.
    const schemaVersion = body.schemaVersion ?? 0;
    if (schemaVersion < ctx.config.minSchemaVersion) {
      throw schemaVersionUnsupported(
        `Envelope schemaVersion ${schemaVersion} is below the minimum supported ` +
          `${ctx.config.minSchemaVersion}. Upgrade the client; nothing was consumed.`
      );
    }

    const accepted: Array<{ eventId: string; recordedAt: string }> = [];
    const duplicate: Array<{ eventId: string; recordedAt: string }> = [];
    const rejected: Rejected[] = [];

    // One transaction for the batch: an infrastructure failure rolls the whole
    // thing back rather than leaving a half-applied projection. Per-event
    // *judgement* is still independent — a rejection is a decision, not a fault.
    await withTransaction(ctx.pool, async (client) => {
      for (const raw of body.events as unknown[]) {
        // Untrusted until it clears the contract schema below, so every field
        // is read defensively rather than assumed.
        const event = (raw ?? {}) as Record<string, unknown>;
        const eventId = typeof event?.eventId === "string" ? event.eventId : "<missing>";

        if (!EVENT_ID_RE.test(eventId)) {
          rejected.push({
            eventId,
            reason: "EVENT_ID_MALFORMED",
            message: "eventId must match ^evt_[A-Za-z0-9-]{8,64}$.",
          });
          continue;
        }

        const type = event.type;
        if (typeof type !== "string" || !isKnownEventType(type)) {
          // Rejected at the boundary rather than stored-and-ignored: an event
          // this server cannot interpret would be handed to every other device
          // on pull, where it is equally uninterpretable.
          rejected.push({
            eventId,
            reason: "UNKNOWN_EVENT_TYPE",
            message: `Event type ${String(type)} is not in the log v2 vocabulary.`,
          });
          continue;
        }

        if (isSnapshotEvent(type)) {
          // Recognised, and refused for the right reason. A snapshot replaces a
          // whole projection, so one arriving out of order would silently
          // discard newer events from another device.
          rejected.push({
            eventId,
            reason: "SNAPSHOT_EVENT_UNSUPPORTED",
            message: `${type} carries a full snapshot and is not supported by sync v1.`,
          });
          continue;
        }

        const problems = ctx.contract.validate(eventSchemaName(type), event);
        if (problems) {
          rejected.push({
            eventId,
            reason: "PAYLOAD_INVALID",
            message: `Event failed contract validation for ${type}.`,
            details: problems,
          });
          continue;
        }

        if (event.payloadVersion !== 1) {
          rejected.push({
            eventId,
            reason: "PAYLOAD_VERSION_UNSUPPORTED",
            message: `payloadVersion ${String(event.payloadVersion)} is not supported for ${type}.`,
          });
          continue;
        }

        const outcome = await appendAndApply(
          client,
          tenant.merchantId,
          body.deviceId!,
          schemaVersion,
          {
            eventId,
            type,
            aggregateId: (event.aggregateId as string | null) ?? null,
            payload: event.payload as Record<string, unknown>,
            payloadVersion: event.payloadVersion as number,
            occurredAt: event.occurredAt as string,
            causationId: (event.causationId as string | null) ?? null,
          }
        );

        if (outcome.status === "accepted") {
          accepted.push({ eventId, recordedAt: outcome.recordedAt });
        } else if (outcome.status === "duplicate") {
          // A success. The client drops it from the outbox exactly as it does
          // an accepted one; treating it as an error is what makes an outbox
          // never drain.
          duplicate.push({ eventId, recordedAt: outcome.recordedAt });
        } else {
          rejected.push({
            eventId,
            reason: "EVENT_ID_CONFLICT",
            message:
              "An event with this eventId already exists with different content. " +
              "It was not overwritten.",
          });
        }
      }
    });

    const last = accepted[accepted.length - 1] ?? duplicate[duplicate.length - 1];
    const cursor = last
      ? encodeCursor(
          { recordedAt: last.recordedAt, eventId: last.eventId },
          ctx.config.cursorSecret
        )
      : encodeCursor(
          { recordedAt: new Date(0).toISOString(), eventId: "" },
          ctx.config.cursorSecret
        );

    return reply.send({
      accepted,
      duplicate,
      rejected,
      cursor,
      serverTime: new Date().toISOString(),
    });
  });

  // ── GET /api/v1/sync/pull ─────────────────────────────────────────────────
  app.get("/api/v1/sync/pull", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const query = request.query as Record<string, string | undefined>;

    if (typeof query.deviceId !== "string" || query.deviceId.length === 0) {
      throw badRequest("deviceId is required.");
    }
    const limit = query.limit === undefined ? 50 : Number.parseInt(query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw badRequest("limit must be an integer between 1 and 200.");
    }
    const includeOwn = query.includeOwnDevice === "true";

    const params: unknown[] = [tenant.merchantId];
    const where: string[] = ["merchant_id = $1"];

    if (query.cursor) {
      // Throws SYNC_CURSOR_INVALID or SYNC_CURSOR_EXPIRED.
      const position = decodeCursor(
        query.cursor,
        ctx.config.cursorSecret,
        ctx.config.retentionDays
      );
      params.push(position.recordedAt, position.eventId);
      where.push(
        `(recorded_at, event_id) > ($${params.length - 1}::timestamptz, $${params.length})`
      );
    }

    if (!includeOwn) {
      params.push(query.deviceId);
      where.push(`device_id <> $${params.length}`);
    }

    params.push(limit + 1);
    const { rows } = await ctx.pool.query<{
      event_id: string;
      device_id: string;
      type: string;
      aggregate_id: string | null;
      payload: unknown;
      payload_version: number;
      schema_version: number;
      occurred_at: Date;
      recorded_at: Date;
      causation_id: string | null;
    }>(
      `SELECT event_id, device_id, type, aggregate_id, payload, payload_version,
              schema_version, occurred_at, recorded_at, causation_id
         FROM events
        WHERE ${where.join(" AND ")}
        ORDER BY recorded_at ASC, event_id ASC
        LIMIT $${params.length}`,
      params
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const events = page.map((r) => ({
      eventId: r.event_id,
      type: r.type,
      aggregateId: r.aggregate_id,
      payload: r.payload,
      payloadVersion: r.payload_version,
      schemaVersion: r.schema_version,
      occurredAt: r.occurred_at.toISOString(),
      recordedAt: r.recorded_at.toISOString(),
      deviceId: r.device_id,
      causationId: r.causation_id,
    }));

    const last = page[page.length - 1];
    const nextCursor = last
      ? encodeCursor(
          { recordedAt: last.recorded_at.toISOString(), eventId: last.event_id },
          ctx.config.cursorSecret
        )
      : (query.cursor ?? null);

    return reply.send({
      events,
      nextCursor: hasMore || last ? nextCursor : null,
      hasMore,
      serverTime: new Date().toISOString(),
    });
  });
}

/** Re-exported so tests can assert the contract's validation surface directly. */
export type { Rejected as SyncRejection };
export { validationFailed };

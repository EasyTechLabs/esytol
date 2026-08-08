/**
 * Party endpoints.
 *
 * Writes never touch a projection directly. They mint a domain event and hand
 * it to `appendAndApply` — the same path sync push uses — so a party created
 * over REST and one created on a device are indistinguishable in the log.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../server.js";
import { withTransaction } from "../../db/pool.js";
import { appendAndApply } from "../../events/apply.js";
import {
  etagFor,
  findParty,
  findPartyVersion,
  listParties,
  type PartyPosition,
} from "./repository.js";
import {
  badRequest,
  notFound,
  preconditionRequired,
  resourceAlreadyExists,
  validationFailed,
  versionConflict,
} from "../../errors.js";
import { readIdempotency, recordIdempotency } from "../../idempotency.js";

const POSITIONS: readonly PartyPosition[] = [
  "owes_merchant",
  "merchant_owes",
  "settled",
  "no_entries",
];

export function registerPartyRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ── GET /api/v1/parties ───────────────────────────────────────────────────
  app.get("/api/v1/parties", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const query = request.query as Record<string, string | undefined>;

    const limit = query.limit === undefined ? 50 : Number.parseInt(query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw badRequest("limit must be an integer between 1 and 200.");
    }
    if (query.position !== undefined && !POSITIONS.includes(query.position as PartyPosition)) {
      throw badRequest(`position must be one of: ${POSITIONS.join(", ")}.`);
    }
    if (query.updatedSince !== undefined && Number.isNaN(Date.parse(query.updatedSince))) {
      throw badRequest("updatedSince must be an ISO-8601 instant.");
    }

    const result = await listParties(ctx.pool, tenant.merchantId, {
      q: query.q,
      position: query.position as PartyPosition | undefined,
      updatedSince: query.updatedSince,
      cursor: query.cursor,
      limit,
    });

    return reply.send({
      items: result.items,
      page: { nextCursor: result.nextCursor, hasMore: result.hasMore },
    });
  });

  // ── POST /api/v1/parties ──────────────────────────────────────────────────
  app.post("/api/v1/parties", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const key = requireIdempotencyKey(request.headers["idempotency-key"]);
    const body = request.body as Record<string, unknown>;

    const problems = ctx.contract.validate("CreatePartyRequest", body);
    if (problems) throw validationFailed("Request body failed contract validation.", problems);

    // A replay with an identical body returns the original result, so retrying
    // a create that timed out is safe. A different body is a conflict.
    const replay = await readIdempotency(ctx.pool, tenant.merchantId, key, body);
    if (replay) {
      reply.header("etag", etagFor((replay.body as { version: number }).version));
      return reply.status(replay.status).send(replay.body);
    }

    const partyId = body.id as string;
    const createdAt = (body.createdAt as string | undefined) ?? new Date().toISOString();

    const party = await withTransaction(ctx.pool, async (client) => {
      const existing = await findPartyVersion(client, tenant.merchantId, partyId);
      if (existing) throw resourceAlreadyExists(`Party ${partyId} already exists.`);

      await appendAndApply(client, tenant.merchantId, tenant.deviceId, ctx.config.schemaVersion, {
        eventId: `evt_${randomUUID()}`,
        type: "ContactCreated",
        aggregateId: partyId,
        payloadVersion: 1,
        occurredAt: createdAt,
        payload: {
          party: {
            id: partyId,
            name: body.name,
            phone: body.phone ?? null,
            note: body.note ?? null,
            createdAt,
          },
        },
      });

      const created = await findParty(client, tenant.merchantId, partyId);
      if (!created) throw new Error("party projection missing immediately after creation");
      await recordIdempotency(client, tenant.merchantId, key, body, 201, created);
      return created;
    });

    reply.header("etag", etagFor(party.version));
    reply.header("location", `/api/v1/parties/${party.id}`);
    return reply.status(201).send(party);
  });

  // ── GET /api/v1/parties/{partyId} ─────────────────────────────────────────
  app.get("/api/v1/parties/:partyId", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const { partyId } = request.params as { partyId: string };

    const party = await findParty(ctx.pool, tenant.merchantId, partyId);
    // Absent and belonging-to-another-workspace are deliberately
    // indistinguishable. A 403 would confirm the resource exists.
    if (!party) throw notFound(`No party ${partyId} in this workspace.`);

    reply.header("etag", etagFor(party.version));
    return reply.send(party);
  });

  // ── PATCH /api/v1/parties/{partyId} ───────────────────────────────────────
  app.patch("/api/v1/parties/:partyId", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const { partyId } = request.params as { partyId: string };
    const key = requireIdempotencyKey(request.headers["idempotency-key"]);
    const body = request.body as Record<string, unknown>;

    const ifMatch = request.headers["if-match"];
    if (typeof ifMatch !== "string" || ifMatch.length === 0) {
      // Required, not optional. An optional precondition is one a client
      // forgets, and the failure mode is a silently overwritten edit from
      // another device.
      throw preconditionRequired("If-Match is required. Read the party first, then retry.");
    }

    const problems = ctx.contract.validate("UpdatePartyRequest", body);
    if (problems) throw validationFailed("Request body failed contract validation.", problems);

    const replay = await readIdempotency(ctx.pool, tenant.merchantId, key, { partyId, body });
    if (replay) {
      reply.header("etag", etagFor((replay.body as { version: number }).version));
      return reply.status(replay.status).send(replay.body);
    }

    const party = await withTransaction(ctx.pool, async (client) => {
      const current = await findPartyVersion(client, tenant.merchantId, partyId);
      if (!current || current.deleted) throw notFound(`No party ${partyId} in this workspace.`);

      if (ifMatch !== "*" && ifMatch !== etagFor(current.version)) {
        throw versionConflict(
          `If-Match ${ifMatch} is stale; the party is at ${etagFor(current.version)}.`
        );
      }

      const changes: Record<string, unknown> = {};
      for (const field of ["name", "phone", "note"] as const) {
        if (Object.hasOwn(body, field)) changes[field] = body[field];
      }

      await appendAndApply(client, tenant.merchantId, tenant.deviceId, ctx.config.schemaVersion, {
        eventId: `evt_${randomUUID()}`,
        type: "ContactUpdated",
        aggregateId: partyId,
        payloadVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: { partyId, changes },
      });

      const updated = await findParty(client, tenant.merchantId, partyId);
      if (!updated) throw new Error("party projection missing immediately after update");
      await recordIdempotency(client, tenant.merchantId, key, { partyId, body }, 200, updated);
      return updated;
    });

    reply.header("etag", etagFor(party.version));
    return reply.send(party);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireIdempotencyKey(header: unknown): string {
  if (typeof header !== "string" || !UUID_RE.test(header)) {
    throw badRequest("Idempotency-Key header is required and must be a UUID.");
  }
  return header;
}

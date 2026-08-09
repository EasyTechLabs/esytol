/**
 * Ledger endpoints: record a credit, read a statement.
 *
 * Recording a credit mints a `CreditRecorded` event — the same type and payload
 * already on merchants' devices in log format v2 — and hands it to
 * `appendAndApply`, the one server-side event-application path. Nothing here
 * writes a projection directly, and nothing here accepts submitted state.
 *
 * This is not sync. Sync reconciles two devices' logs; this appends one event
 * and reads the projection back.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../server.js";
import { withTransaction } from "../../db/pool.js";
import { appendAndApply } from "../../events/apply.js";
import { findParty } from "../parties/repository.js";
import { findEntry, readStatement, signedAmount } from "./repository.js";
import { badRequest, notFound, resourceAlreadyExists, validationFailed } from "../../errors.js";
import { readIdempotency, recordIdempotency } from "../../idempotency.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireIdempotencyKey(header: unknown): string {
  if (typeof header !== "string" || !UUID_RE.test(header)) {
    throw badRequest("Idempotency-Key header is required and must be a UUID.");
  }
  return header;
}

export function registerLedgerRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ── POST /api/v1/parties/{partyId}/credits ────────────────────────────────
  app.post("/api/v1/parties/:partyId/credits", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const { partyId } = request.params as { partyId: string };
    const key = requireIdempotencyKey(request.headers["idempotency-key"]);
    const body = request.body as Record<string, unknown>;

    const problems = ctx.contract.validate("RecordCreditRequest", body);
    if (problems) throw validationFailed("Request body failed contract validation.", problems);

    const replay = await readIdempotency(ctx.pool, tenant.merchantId, key, { partyId, body });
    if (replay) return reply.status(replay.status).send(replay.body);

    const entryId = body.id as string;
    const createdAt = (body.createdAt as string | undefined) ?? new Date().toISOString();

    const entry = await withTransaction(ctx.pool, async (client) => {
      // The party must exist in *this* workspace. A missing one and another
      // merchant's one are the same 404, so this cannot be used to probe.
      const party = await findParty(client, tenant.merchantId, partyId);
      if (!party) throw notFound(`No party ${partyId} in this workspace.`);

      const existing = await findEntry(client, tenant.merchantId, entryId);
      if (existing) {
        // Same id, same content is a success; same id, different content is a
        // conflict and never an overwrite.
        const same =
          existing.partyId === partyId &&
          existing.amount === body.amount &&
          existing.direction === body.kind;
        if (!same)
          throw resourceAlreadyExists(`Entry ${entryId} already exists with different content.`);
        return existing;
      }

      await appendAndApply(client, tenant.merchantId, tenant.deviceId, ctx.config.schemaVersion, {
        eventId: `evt_${randomUUID()}`,
        type: "CreditRecorded",
        aggregateId: partyId,
        payloadVersion: 1,
        occurredAt: createdAt,
        payload: {
          transaction: {
            id: entryId,
            partyId,
            amount: body.amount,
            kind: body.kind,
            description: body.description ?? null,
            date: body.date,
            dueDate: body.dueDate ?? null,
            createdAt,
          },
        },
      });

      const created = await findEntry(client, tenant.merchantId, entryId);
      if (!created) throw new Error("entry projection missing immediately after append");
      await recordIdempotency(client, tenant.merchantId, key, { partyId, body }, 201, created);
      return created;
    });

    return reply.status(201).send(entry);
  });

  // ── GET /api/v1/parties/{partyId}/statement ───────────────────────────────
  app.get("/api/v1/parties/:partyId/statement", async (request, reply) => {
    const tenant = await request.resolveTenant();
    const { partyId } = request.params as { partyId: string };
    const query = request.query as Record<string, string | undefined>;

    const limit = query.limit === undefined ? 50 : Number.parseInt(query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw badRequest("limit must be an integer between 1 and 200.");
    }

    const party = await findParty(ctx.pool, tenant.merchantId, partyId);
    if (!party) throw notFound(`No party ${partyId} in this workspace.`);

    const statement = await readStatement(ctx.pool, tenant.merchantId, partyId, limit);

    return reply.send({
      partyId,
      rows: statement.rows,
      balance: {
        net: statement.net,
        position: position(statement.net, statement.entryCount),
        entryCount: statement.entryCount,
        lastActivityAt: statement.lastActivityAt,
      },
    });
  });
}

/** Derived, never stored — identical rule to the party read model. */
function position(net: number, entryCount: number): string {
  if (entryCount === 0) return "no_entries";
  if (net > 0) return "owes_merchant";
  if (net < 0) return "merchant_owes";
  return "settled";
}

export { signedAmount };

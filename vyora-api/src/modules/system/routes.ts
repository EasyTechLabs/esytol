/**
 * Health and caller identity.
 *
 * `/health` is the only unauthenticated path in the API. It reports no merchant
 * data, which is what makes that safe.
 */

import type { FastifyInstance } from "fastify";
import type { AppContext } from "../../server.js";
import { notFound } from "../../errors.js";

export const API_VERSION = "0.1.0-local";

export function registerSystemRoutes(app: FastifyInstance, ctx: AppContext): void {
  // ── GET /api/v1/health ────────────────────────────────────────────────────
  app.get("/api/v1/health", async (_request, reply) => {
    let database: "ok" | "down" = "ok";
    try {
      await ctx.pool.query("SELECT 1");
    } catch {
      database = "down";
    }

    // `degraded` rather than a hard failure: the service answers, but writes
    // are refused while a dependency is impaired rather than partially applied.
    const status = database === "ok" ? "ok" : "degraded";
    return reply.status(status === "ok" ? 200 : 503).send({
      status,
      version: API_VERSION,
      checkedAt: new Date().toISOString(),
      dependencies: [{ name: "postgres", status: database }],
    });
  });

  // ── GET /api/v1/me ────────────────────────────────────────────────────────
  app.get("/api/v1/me", async (request, reply) => {
    const tenant = await request.resolveTenant();

    const { rows } = await ctx.pool.query<{
      display_name: string;
      created_at: Date;
      user_display_name: string | null;
      role: string;
      device_label: string | null;
      registered_at: Date;
    }>(
      `SELECT m.display_name,
              m.created_at,
              u.display_name AS user_display_name,
              u.role,
              d.label        AS device_label,
              d.registered_at
         FROM merchants m
         JOIN users   u ON u.user_id   = $2 AND u.merchant_id   = m.merchant_id
         JOIN devices d ON d.device_id = $3 AND d.merchant_id = m.merchant_id
        WHERE m.merchant_id = $1`,
      [tenant.merchantId, tenant.userId, tenant.deviceId]
    );

    const row = rows[0];
    if (!row) throw notFound("Caller context could not be resolved.");

    // The only place merchantId appears in a response, and it appears in no
    // request at all — a client discovers its workspace, never asserts one.
    return reply.send({
      merchant: {
        merchantId: tenant.merchantId,
        displayName: row.display_name,
        createdAt: row.created_at.toISOString(),
      },
      user: {
        userId: tenant.userId,
        displayName: row.user_display_name,
        role: row.role,
      },
      device: {
        deviceId: tenant.deviceId,
        label: row.device_label,
        registeredAt: row.registered_at.toISOString(),
      },
      sync: {
        schemaVersion: ctx.config.schemaVersion,
        minSupportedSchemaVersion: ctx.config.minSchemaVersion,
        maxBatchEvents: ctx.config.maxBatchEvents,
      },
      // Surfaced so a client can refuse to render fixture data as if it were
      // the merchant's own book.
      authMode: tenant.authMode,
    });
  });
}

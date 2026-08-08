/**
 * Server assembly.
 *
 * A modular monolith: one deployable, internally partitioned into system,
 * parties and sync. Modules talk by function call, not HTTP.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { Config } from "./config.js";
import { loadContract, type Contract } from "./contract.js";
import { createPool, type Pool } from "./db/pool.js";
import { resolveTenant, type TenantContext } from "./auth/index.js";
import { sendError, ApiError } from "./errors.js";
import { registerSystemRoutes } from "./modules/system/routes.js";
import { registerPartyRoutes } from "./modules/parties/routes.js";
import { registerSyncRoutes } from "./modules/sync/routes.js";

export interface AppContext {
  readonly config: Config;
  readonly pool: Pool;
  readonly contract: Contract;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Resolve tenant scope from credentials. The only way to reach a workspace. */
    resolveTenant(): Promise<TenantContext>;
    requestId: string;
  }
}

export interface BuiltApp {
  readonly app: FastifyInstance;
  readonly ctx: AppContext;
  /** Every registered route as `METHOD /path`, for contract-parity checks. */
  readonly routes: readonly string[];
}

export function buildServer(config: Config, pool: Pool = createPool(config.databaseUrl)): BuiltApp {
  const ctx: AppContext = { config, pool, contract: loadContract() };

  const app = Fastify({
    logger: false,
    // Fastify's default 400 for malformed JSON would bypass the error envelope.
    genReqId: () => randomUUID(),
  });

  // Collected from Fastify itself rather than parsed out of printRoutes text,
  // so the parity test compares what is actually registered.
  const routes: string[] = [];
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === "HEAD" || method === "OPTIONS") continue;
      routes.push(`${method} ${route.url.replace(/:(\w+)/g, "{$1}")}`);
    }
  });

  // Correlation id on EVERY response, success or failure. Set in one hook so no
  // route can forget it.
  app.addHook("onRequest", async (request, reply) => {
    request.requestId = request.id as string;
    reply.header("x-request-id", request.requestId);
    request.resolveTenant = () => resolveTenant(request, pool, config);
  });

  registerSystemRoutes(app, ctx);
  registerPartyRoutes(app, ctx);
  registerSyncRoutes(app, ctx);

  app.setNotFoundHandler((request, reply) =>
    sendError(reply, request.requestId, new ApiError(404, "NOT_FOUND", "No such endpoint."))
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) return sendError(reply, request.requestId, error);

    // Malformed JSON and other framework-level faults still leave through the
    // contract envelope rather than Fastify's default shape.
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status === 400) {
      return sendError(
        reply,
        request.requestId,
        new ApiError(400, "BAD_REQUEST", "Request body could not be parsed.")
      );
    }
    if (status === 413) {
      return sendError(
        reply,
        request.requestId,
        new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.")
      );
    }

    // An INTERNAL_ERROR the server never logged is an incident nobody can
    // diagnose — the caller gets an opaque code and the cause is gone. The
    // requestId ties this line to the response the client saw.
    console.error(`[${request.requestId}] ${request.method} ${request.url} —`, error);
    return sendError(reply, request.requestId, error);
  });

  return { app, ctx, routes };
}

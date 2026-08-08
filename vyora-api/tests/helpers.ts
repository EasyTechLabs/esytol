/**
 * Shared test harness.
 *
 * Every test runs against a real PostgreSQL database — migrated from empty and
 * re-seeded per file. An in-memory fake would not exercise the constraints,
 * the transaction boundaries, or the cursor comparison, which is where the
 * interesting failures live.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { loadConfig, type Config } from "../src/config.js";
import { createPool, type Pool } from "../src/db/pool.js";
import { migrateUp, resetDatabase } from "../src/db/migrate.js";
import { buildServer } from "../src/server.js";
import { seed, workspaces, type SeedResult } from "../src/seed/seed.js";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55432/vyora_test";

export interface Harness {
  readonly app: FastifyInstance;
  readonly pool: Pool;
  readonly config: Config;
  readonly seeded: SeedResult;
  readonly routes: readonly string[];
  close(): Promise<void>;
}

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    VYORA_DEV_AUTH: "true",
    SYNC_CURSOR_SECRET: "test-cursor-secret",
    SYNC_RETENTION_DAYS: "90",
    SYNC_SCHEMA_VERSION: "1",
    SYNC_MIN_SCHEMA_VERSION: "1",
    SYNC_MAX_BATCH_EVENTS: "500",
    ...overrides,
  } as NodeJS.ProcessEnv);
}

/** Migrate from empty, seed two workspaces, and build the server. */
export async function startHarness(overrides: Record<string, string> = {}): Promise<Harness> {
  const config = testConfig(overrides);
  const pool = createPool(config.databaseUrl);
  await resetDatabase(pool);
  const seeded = await seed(pool, config.schemaVersion);
  const { app, routes } = buildServer(config, pool);
  await app.ready();

  return {
    app,
    pool,
    config,
    seeded,
    routes,
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

export { migrateUp, resetDatabase, workspaces };

export const uuid = (): string => randomUUID();

export interface Res {
  status: number;
  headers: Record<string, unknown>;
  /** Parsed JSON. Tests assert on contract fields, so this stays loose on purpose. */
  body: JsonValue;
  requestId: string | undefined;
}

/** Anything JSON.parse can return, indexable without a cast in assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonValue = any;

interface CallOptions {
  token?: string;
  devIdentity?: string;
  headers?: Record<string, string>;
  payload?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

/** One call helper so every test exercises the same header plumbing. */
export async function call(
  app: FastifyInstance,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: CallOptions = {}
): Promise<Res> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.devIdentity) headers["x-vyora-dev-identity"] = options.devIdentity;
  if (options.payload !== undefined && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const query = Object.fromEntries(
    Object.entries(options.query ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );

  const response = await app.inject({
    method,
    url: path,
    headers,
    query,
    ...(options.payload !== undefined ? { payload: options.payload as object } : {}),
  });

  let body: unknown;
  try {
    body = response.body ? JSON.parse(response.body) : undefined;
  } catch {
    body = response.body;
  }

  return {
    status: response.statusCode,
    headers: response.headers as Record<string, unknown>,
    body,
    requestId: response.headers["x-request-id"] as string | undefined,
  };
}

/** A minimal valid ContactCreated event on the wire. */
export function contactCreatedEvent(partyId: string, name: string, occurredAt: string) {
  return {
    eventId: `evt_${randomUUID()}`,
    type: "ContactCreated",
    aggregateId: partyId,
    payloadVersion: 1,
    occurredAt,
    payload: {
      party: { id: partyId, name, phone: null, note: null, createdAt: occurredAt },
    },
  };
}

export function snapshotEvent(type: "ImportCompleted" | "RestoreCompleted", occurredAt: string) {
  return {
    eventId: `evt_${randomUUID()}`,
    type,
    aggregateId: null,
    payloadVersion: 1,
    occurredAt,
    payload: { snapshot: { version: 2, parties: [], transactions: [], payments: [] } },
  };
}

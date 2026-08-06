/**
 * Idempotency-Key replay.
 *
 * Same key + identical body → the original response, verbatim.
 * Same key + different body → 409, never a silent overwrite.
 *
 * Scoped per merchant. A global unique index on the key looks correct until two
 * workspaces generate the same UUID — rare, but a cross-tenant information leak
 * when it happens (`auth-and-tenant-model.md` §6, rule 5).
 */

import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "./db/pool.js";
import { idempotencyKeyReused } from "./errors.js";

/** Stable across key order, so `{a,b}` and `{b,a}` are the same request. */
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

export interface Replay {
  readonly status: number;
  readonly body: unknown;
}

/** Returns the stored response when this key was already used with this body. */
export async function readIdempotency(
  db: Pool | PoolClient,
  merchantId: string,
  key: string,
  request: unknown
): Promise<Replay | null> {
  const { rows } = await db.query<{
    fingerprint: string;
    response_status: number;
    response_body: unknown;
  }>(
    `SELECT fingerprint, response_status, response_body
       FROM idempotency_keys WHERE merchant_id = $1 AND key = $2`,
    [merchantId, key]
  );

  const row = rows[0];
  if (!row) return null;

  if (row.fingerprint !== fingerprint(request)) {
    throw idempotencyKeyReused(
      "This Idempotency-Key was already used with a different request body. Use a new key."
    );
  }
  return { status: row.response_status, body: row.response_body };
}

export async function recordIdempotency(
  db: Pool | PoolClient,
  merchantId: string,
  key: string,
  request: unknown,
  status: number,
  body: unknown
): Promise<void> {
  await db.query(
    `INSERT INTO idempotency_keys (merchant_id, key, fingerprint, response_status, response_body)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (merchant_id, key) DO NOTHING`,
    [merchantId, key, fingerprint(request), status, JSON.stringify(body)]
  );
}

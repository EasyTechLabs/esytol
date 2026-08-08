/**
 * Tenant resolution.
 *
 * `auth-and-tenant-model.md` §2: merchant scope is resolved from the access
 * token and never read from the request. Nothing downstream of this module can
 * name a workspace — the resolved `TenantContext` is the only way to reach one,
 * and it comes from a credential, never from a path, query or body.
 */

import type { FastifyRequest } from "fastify";
import type { Pool } from "../db/pool.js";
import type { Config } from "../config.js";
import { tokenExpired, unauthenticated } from "../errors.js";

export interface TenantContext {
  readonly merchantId: string;
  readonly userId: string;
  readonly deviceId: string;
  readonly authMode: "bearer" | "development";
}

const DEV_HEADER = "x-vyora-dev-identity";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

/** Development identity is refused off-loopback even when the flag is on. */
export function isLoopback(ip: string | undefined): boolean {
  return ip !== undefined && LOOPBACK.has(ip);
}

export async function resolveTenant(
  request: FastifyRequest,
  pool: Pool,
  config: Config
): Promise<TenantContext> {
  const bearer = readBearer(request.headers.authorization);
  if (bearer) return resolveBearer(bearer, pool);

  const devIdentity = request.headers[DEV_HEADER];
  if (typeof devIdentity === "string" && devIdentity.length > 0) {
    return resolveDevIdentity(devIdentity, request, pool, config);
  }

  throw unauthenticated("No credentials. Send an Authorization: Bearer token.");
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

async function resolveBearer(token: string, pool: Pool): Promise<TenantContext> {
  const { rows } = await pool.query<{
    merchant_id: string;
    user_id: string;
    device_id: string;
    expires_at: Date | null;
  }>(`SELECT merchant_id, user_id, device_id, expires_at FROM access_tokens WHERE token = $1`, [
    token,
  ]);

  const row = rows[0];
  if (!row) throw unauthenticated("Token not recognised.");
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
    throw tokenExpired("Token has expired. Refresh and retry.");
  }

  return {
    merchantId: row.merchant_id,
    userId: row.user_id,
    deviceId: row.device_id,
    authMode: "bearer",
  };
}

/**
 * The development scheme. Reachable only when all three hold:
 *   1. `VYORA_DEV_AUTH=true` — and that flag makes the process refuse to boot
 *      under `NODE_ENV=production` (see `config.ts` gate 1),
 *   2. the request came from loopback,
 *   3. the value names a row in `dev_identities`, which only ever points at a
 *      seeded fixture workspace.
 *
 * Condition 3 is the one that matters most: there is no path from this header
 * to a real merchant record, so even if 1 and 2 were subverted it could not
 * reach real data.
 */
async function resolveDevIdentity(
  name: string,
  request: FastifyRequest,
  pool: Pool,
  config: Config
): Promise<TenantContext> {
  if (!config.devAuthEnabled) {
    throw unauthenticated("Development identity is not enabled on this server.");
  }
  if (!isLoopback(request.ip)) {
    throw unauthenticated("Development identity is accepted only from localhost.");
  }

  const { rows } = await pool.query<{
    merchant_id: string;
    user_id: string;
    device_id: string;
  }>(`SELECT merchant_id, user_id, device_id FROM dev_identities WHERE name = $1`, [name]);

  const row = rows[0];
  if (!row) throw unauthenticated(`Unknown development identity "${name}".`);

  return {
    merchantId: row.merchant_id,
    userId: row.user_id,
    deviceId: row.device_id,
    authMode: "development",
  };
}

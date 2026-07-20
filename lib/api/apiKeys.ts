/**
 * Direct API keys — Growth Sprint 002.
 *
 * The off-marketplace key path: for enterprise / direct customers who are billed
 * outside RapidAPI. Keys are provisioned via the `ESYTOL_API_KEYS` env var and
 * are **stored only as SHA-256 hashes** — the raw key never lives in memory after
 * load and never appears in logs, responses, or errors.
 *
 * Marketplace customers do NOT use this path — RapidAPI issues and meters their
 * keys; see lib/api/identity.ts for the RapidAPI seam. The public/free endpoint
 * requires NO key, so existing anonymous users are never affected.
 *
 * `ESYTOL_API_KEYS` format (JSON): [{ "key": "sk_live_…", "plan": "pro", "principal": "acme" }]
 */

import { createHash } from "node:crypto";
import { getPlan, type Plan } from "./plans";

export interface KeyRecord {
  /** Opaque, non-PII identifier for the customer (used in metering/billing/logs). */
  principal: string;
  plan: Plan;
}

/** Resolution of an inbound X-API-Key header. */
export type KeyResolution =
  | { state: "absent" } // no key header — fall through to anonymous/free
  | { state: "invalid" } // a key was sent but does not match — 401
  | { state: "valid"; record: KeyRecord };

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** hash → KeyRecord, built once from env. */
let store: Map<string, KeyRecord> | null = null;

function loadStore(): Map<string, KeyRecord> {
  const map = new Map<string, KeyRecord>();
  const raw = process.env.ESYTOL_API_KEYS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Array<{ key: string; plan: string; principal: string }>;
      for (const e of parsed) {
        if (e?.key && e?.principal) {
          map.set(sha256(e.key), { principal: e.principal, plan: getPlan(e.plan) });
        }
      }
    } catch {
      // Malformed config must not crash the API — it simply yields no direct keys.
      console.log(
        JSON.stringify({
          level: "warn",
          service: "income-tax-api",
          msg: "ESYTOL_API_KEYS is not valid JSON; direct keys disabled",
        })
      );
    }
  }
  return map;
}

/** Reset the cached store — for tests (re-reads env on next resolve). */
export function resetKeyStore(): void {
  store = null;
}

/** Resolve the X-API-Key header (case-insensitive) into a key resolution. Never throws, never logs the key. */
export function resolveApiKey(req: Request): KeyResolution {
  const key = req.headers.get("x-api-key");
  if (!key) return { state: "absent" };
  if (!store) store = loadStore();
  const record = store.get(sha256(key));
  return record ? { state: "valid", record } : { state: "invalid" };
}

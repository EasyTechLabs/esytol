/**
 * Caller identity + plan resolution — Growth Sprint 002.
 *
 * Resolves every request to a { principal, plan, source } WITHOUT ever breaking
 * the public path. Precedence:
 *   1. RapidAPI  — only when the proxy secret is configured AND matches. The plan
 *      comes from RapidAPI's X-RapidAPI-Subscription header (it meters + bills).
 *      A configured secret that does NOT match → 403 (block gateway spoofing).
 *   2. Direct X-API-Key — off-marketplace/enterprise keys. Present-but-invalid → 401.
 *   3. Anonymous — the Free tier. No key required, so existing users keep working.
 *
 * This is the plan-aware successor to lib/api/auth.ts's public authenticator; the
 * old `authenticate()` seam stays for backward compatibility.
 */

import { createHash } from "node:crypto";
import { getPlan, FREE_PLAN, type Plan, type PlanId } from "./plans";
import { resolveApiKey } from "./apiKeys";
import { clientKey } from "./rateLimit";
import type { ApiErrorItem } from "./http";

export type IdentitySource = "rapidapi" | "apiKey" | "anonymous";

export interface Identity {
  /** Opaque, non-PII principal used for metering/billing/logs. */
  principal: string;
  plan: Plan;
  source: IdentitySource;
}

export type IdentityResult =
  { ok: true; identity: Identity } | { ok: false; status: number; error: ApiErrorItem };

/** RapidAPI passes the subscribed plan NAME; map the listing's names to our plan ids. */
const RAPIDAPI_SUB_TO_PLAN: Record<string, PlanId> = {
  BASIC: "free",
  PRO: "pro",
  ULTRA: "ultra",
  MEGA: "mega",
  CUSTOM: "enterprise",
};

function anonPrincipal(req: Request): string {
  return `anon:${createHash("sha256").update(clientKey(req)).digest("hex").slice(0, 10)}`;
}

export function resolveIdentity(req: Request): IdentityResult {
  // 1. RapidAPI gateway — trusted only when the proxy secret is configured and matches.
  const proxySecret = process.env.RAPIDAPI_PROXY_SECRET;
  const sentProxySecret = req.headers.get("x-rapidapi-proxy-secret");
  if (proxySecret && sentProxySecret) {
    if (sentProxySecret !== proxySecret) {
      return {
        ok: false,
        status: 403,
        error: { code: "forbidden", message: "Invalid RapidAPI proxy secret." },
      };
    }
    const sub = (req.headers.get("x-rapidapi-subscription") ?? "").toUpperCase();
    const user = req.headers.get("x-rapidapi-user") ?? "unknown";
    const planId = RAPIDAPI_SUB_TO_PLAN[sub] ?? "free";
    return {
      ok: true,
      identity: { principal: `rapidapi:${user}`, plan: getPlan(planId), source: "rapidapi" },
    };
  }

  // 2. Direct API key (off-marketplace / enterprise).
  const key = resolveApiKey(req);
  if (key.state === "invalid") {
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "The provided X-API-Key is not valid." },
    };
  }
  if (key.state === "valid") {
    return {
      ok: true,
      identity: {
        principal: `key:${key.record.principal}`,
        plan: key.record.plan,
        source: "apiKey",
      },
    };
  }

  // 3. Anonymous — the public Free tier. Never rejected (keeps existing users working).
  return {
    ok: true,
    identity: { principal: anonPrincipal(req), plan: FREE_PLAN, source: "anonymous" },
  };
}

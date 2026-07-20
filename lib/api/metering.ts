/**
 * Usage metering — Growth Sprint 002.
 *
 * Counts REAL requests per principal per calendar month and reports quota state.
 * It never invents a number: a count is only ever an actual recorded request.
 *
 * Honest limitation (same as the rate limiter): this in-memory counter is
 * per-serverless-instance, so it is best-effort local telemetry, not the
 * system-of-record. The authoritative meters are RapidAPI (marketplace usage +
 * billing) and the structured billing/usage logs. A durable store (KV/Redis)
 * is the swap-in when direct (off-marketplace) billing needs exact global counts.
 */

import { emitBilling, type BillingEvent } from "./billing";
import type { Plan } from "./plans";

export interface UsageSnapshot {
  principal: string;
  plan: Plan["id"];
  month: string;
  used: number;
  included: number | null;
  remaining: number | null; // null when unmetered/negotiated
  overage: number; // requests beyond included (0 when within quota or unmetered)
}

// `${principal}:${month}` → count
const counters = new Map<string, number>();

/** ISO month bucket for a moment. `now` injectable for deterministic tests. */
export function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function snapshotFrom(principal: string, plan: Plan, month: string, used: number): UsageSnapshot {
  const included = plan.includedRequestsPerMonth;
  const remaining = included === null ? null : Math.max(0, included - used);
  const overage = included === null ? 0 : Math.max(0, used - included);
  return { principal, plan: plan.id, month, used, included, remaining, overage };
}

/**
 * Record one request and return the resulting usage snapshot. Emits billing
 * events (usage recorded; quota warning at ≥80%; quota exceeded past included).
 */
export function recordUsage(
  principal: string,
  plan: Plan,
  endpoint: string,
  source: BillingEvent["source"],
  now: Date = new Date()
): UsageSnapshot {
  const month = monthKey(now);
  const cacheKey = `${principal}:${month}`;
  const used = (counters.get(cacheKey) ?? 0) + 1;
  counters.set(cacheKey, used);

  const snap = snapshotFrom(principal, plan, month, used);
  const base: Omit<BillingEvent, "type"> = {
    principal,
    plan: plan.id,
    source,
    endpoint,
    monthlyUsed: used,
    monthlyIncluded: plan.includedRequestsPerMonth,
    month,
  };
  emitBilling({ ...base, type: "usage_recorded" });
  const included = plan.includedRequestsPerMonth;
  if (included !== null) {
    if (used > included) emitBilling({ ...base, type: "quota_exceeded" });
    else if (used === Math.ceil(included * 0.8)) emitBilling({ ...base, type: "quota_warning" });
  }
  return snap;
}

/** Read-only usage snapshot for a principal (no increment). Real counts only. */
export function getUsage(principal: string, plan: Plan, now: Date = new Date()): UsageSnapshot {
  const month = monthKey(now);
  const used = counters.get(`${principal}:${month}`) ?? 0;
  return snapshotFrom(principal, plan, month, used);
}

/** Standard usage response headers, alongside the X-RateLimit-* set. */
export function usageHeaders(s: UsageSnapshot): Record<string, string> {
  const h: Record<string, string> = {
    "X-Usage-Plan": s.plan,
    "X-Usage-Used": String(s.used),
    "X-Usage-Month": s.month,
  };
  if (s.included !== null) {
    h["X-Usage-Limit"] = String(s.included);
    h["X-Usage-Remaining"] = String(s.remaining ?? 0);
  }
  return h;
}

/** Clear all counters — for tests. */
export function resetUsage(): void {
  counters.clear();
}

/**
 * Billing hooks — Growth Sprint 002.
 *
 * ⚠️ This is NOT a payment processor. RapidAPI is the billing rail for the
 * marketplace (it charges cards, meters plans, and pays out). This module is the
 * *seam*: it emits structured billing events (usage recorded, quota warning,
 * quota exceeded, subscription change) at the exact points a real biller would
 * consume — so a Stripe adapter or an enterprise-invoicing job can be added later
 * WITHOUT touching any route. The default sink only logs (privacy-safe, no PII,
 * no income). Swap `billingConfig.hook` to wire a real consumer.
 */

import type { PlanId } from "./plans";

export type BillingEventType =
  | "usage_recorded"
  | "quota_warning" // crossed a soft threshold (e.g. 80% of included)
  | "quota_exceeded" // over the included monthly quota (overage or hard stop)
  | "subscription_seen"; // first sight of a subscriber this process

export interface BillingEvent {
  type: BillingEventType;
  /** Opaque, non-PII principal (e.g. "rapidapi:<user>", "key:abc123…", "anon:<ipHashPrefix>"). */
  principal: string;
  plan: PlanId;
  /** How the caller was identified. */
  source: "rapidapi" | "apiKey" | "anonymous";
  endpoint: string;
  /** Requests used this month for this principal (real count, never invented). */
  monthlyUsed: number;
  /** Included quota for the plan, or null when negotiated/unmetered. */
  monthlyIncluded: number | null;
  /** ISO month bucket, e.g. "2026-07". */
  month: string;
}

export interface BillingHook {
  emit(event: BillingEvent): void;
}

/** Default: privacy-safe structured log (captured by Vercel). No income, no PII, no key values. */
export const loggingBillingHook: BillingHook = {
  emit(event) {
    console.log(
      JSON.stringify({ level: "info", service: "income-tax-api", kind: "billing", ...event })
    );
  },
};

/** The active hook. Swap to wire Stripe/enterprise invoicing/analytics without route changes. */
export const billingConfig: { hook: BillingHook } = { hook: loggingBillingHook };

export function emitBilling(event: BillingEvent): void {
  billingConfig.hook.emit(event);
}

/**
 * API pricing plans — Growth Sprint 002 (GROWTH-002-Revenue).
 *
 * The single source of truth for the Income Tax API's tiers. It powers the
 * pricing page, the plan-aware rate limiter, the usage/quota metering, and the
 * RapidAPI listing — so a price or limit changes in exactly one place.
 *
 * ⚠️ Prices are a HYPOTHESIS (see docs/IncomeTaxApiPricing.md), not validated
 * revenue data — labelled, to be corrected by real RapidAPI conversion data.
 * RapidAPI remains the billing rail; nothing here charges a card. These plans
 * describe entitlements; `lib/api/billing.ts` emits the hooks a real biller
 * (RapidAPI today, Stripe/enterprise invoicing later) consumes.
 */

import type { RateLimitConfig } from "./rateLimit";

export type PlanId = "free" | "pro" | "ultra" | "mega" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD (RapidAPI bills in USD). `null` = custom / contact sales. */
  priceUsd: number | null;
  /** Requests included per calendar month. `null` = negotiated / unmetered. */
  includedRequestsPerMonth: number | null;
  /** Overage price per request in USD once the monthly quota is exceeded. `null` = hard stop / negotiated. */
  overageUsdPerRequest: number | null;
  /** Plan-aware rate limit applied by lib/api/rateLimit.ts. */
  rateLimit: RateLimitConfig;
  /** Human features for the pricing page. */
  features: readonly string[];
  /** Who the tier is for. */
  forWho: string;
  /** Enterprise tiers route to Contact Sales instead of self-serve. */
  contactSales: boolean;
}

const MINUTE = 60_000;

/**
 * The tiers. Shapes/limits mirror docs/IncomeTaxApiPricing.md and the deployed
 * limiter default (free = 60/min). Higher-tier limits are config, not new code.
 */
export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Basic (Free)",
    priceUsd: 0,
    includedRequestsPerMonth: 500,
    overageUsdPerRequest: null, // hard stop (429) at the marketplace; public path stays rate-limited only
    rateLimit: { limit: 60, windowMs: MINUTE },
    features: [
      "Old vs New regime, multi-year (AY 2024-25 → 2026-27)",
      "§-level computation trace",
      "OpenAPI 3.1 spec + live playground",
      "No signup required for the public endpoint",
    ],
    forWho: "Trial, hobby, evaluation",
    contactSales: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 10,
    includedRequestsPerMonth: 10_000,
    overageUsdPerRequest: 0.002,
    rateLimit: { limit: 60, windowMs: MINUTE },
    features: [
      "Everything in Basic",
      "10,000 requests / month",
      "Overage billing",
      "Email support",
    ],
    forWho: "A live small app or early payroll tool",
    contactSales: false,
  },
  {
    id: "ultra",
    name: "Ultra",
    priceUsd: 29,
    includedRequestsPerMonth: 100_000,
    overageUsdPerRequest: 0.0008,
    rateLimit: { limit: 120, windowMs: MINUTE },
    features: ["Everything in Pro", "100,000 requests / month", "120 req/min", "Priority support"],
    forWho: "A growing product with real volume",
    contactSales: false,
  },
  {
    id: "mega",
    name: "Mega",
    priceUsd: 99,
    includedRequestsPerMonth: 1_000_000,
    overageUsdPerRequest: 0.0004,
    rateLimit: { limit: 300, windowMs: MINUTE },
    features: [
      "Everything in Ultra",
      "1,000,000 requests / month",
      "300 req/min",
      "Best per-call price",
    ],
    forWho: "High-volume or white-label",
    contactSales: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: null,
    includedRequestsPerMonth: null,
    overageUsdPerRequest: null,
    rateLimit: { limit: 600, windowMs: MINUTE },
    features: [
      "Negotiated volume + SLA",
      "Direct API keys (off-marketplace)",
      "Dedicated support + custom regimes",
      "Self-host / on-prem option",
      "Invoicing (not card)",
    ],
    forWho: "Payroll platforms, fintechs, enterprises",
    contactSales: true,
  },
] as const;

export const FREE_PLAN: Plan = PLANS[0];

const BY_ID = new Map<PlanId, Plan>(PLANS.map((p) => [p.id, p]));

/** Look up a plan by id; unknown ids fall back to Free (never throws, never breaks a caller). */
export function getPlan(id: string | null | undefined): Plan {
  return (id && BY_ID.get(id as PlanId)) || FREE_PLAN;
}

/** Self-serve tiers shown on the pricing page in order. */
export function selfServePlans(): Plan[] {
  return PLANS.filter((p) => !p.contactSales);
}

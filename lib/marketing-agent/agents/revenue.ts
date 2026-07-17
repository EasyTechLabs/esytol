/**
 * Revenue Agent — ARCHITECTURE ONLY for revenue *analysis*.
 *
 * No revenue source is wired yet, so there is no revenue data to analyse. What the
 * agent can state truthfully today is a **configuration fact**: nothing is
 * monetised. Per ESYTOL-STRATEGY-001 that is the single largest gap in the
 * business, so the agent surfaces exactly one recommendation derived from the
 * absence of configuration — not from invented data.
 *
 * When a source is connected, `fetchRevenueSignals()` returns real numbers and the
 * agent flips to `active` analysis (RPM, revenue-by-cluster, conversion) without
 * any change to the engine, scoring or reports.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import { buildRecommendation } from "../scoring";

export type RevenueSourceKey = "adsense" | "affiliate" | "marketplace" | "subscriptions";

export interface RevenueSource {
  key: RevenueSourceKey;
  label: string;
  envVars: string[];
  configured: boolean;
  /** Strategic sequencing from ESYTOL-STRATEGY-001. */
  priority: 1 | 2 | 3 | 4;
  note: string;
}

/** Revenue sources and whether they are connected. Env-gated, like every provider. */
export function revenueSources(): RevenueSource[] {
  return [
    {
      key: "affiliate",
      label: "Affiliate / lead-gen",
      envVars: ["AFFILIATE_API_KEY"],
      configured: Boolean(process.env.AFFILIATE_API_KEY),
      priority: 1,
      note: "₹300–5,000 per qualified conversion — the core engine",
    },
    {
      key: "adsense",
      label: "Google AdSense",
      envVars: ["ADSENSE_ACCESS_TOKEN"],
      configured: Boolean(process.env.ADSENSE_ACCESS_TOKEN),
      priority: 2,
      note: "Bridge cash only — cannot reach the revenue target alone",
    },
    {
      key: "subscriptions",
      label: "Subscriptions / freemium",
      envVars: ["BILLING_API_KEY"],
      configured: Boolean(process.env.BILLING_API_KEY),
      priority: 3,
      note: "Utility workshop freemium",
    },
    {
      key: "marketplace",
      label: "Marketplace",
      envVars: ["MARKETPLACE_API_KEY"],
      configured: Boolean(process.env.MARKETPLACE_API_KEY),
      priority: 4,
      note: "Late-stage — needs distribution first",
    },
  ];
}

export interface RevenueSignals {
  revenue: number;
  rpm: number;
  byCluster: { cluster: string; revenue: number }[];
}

/** Future implementation point. `null` until a revenue source is connected. */
export function fetchRevenueSignals(): RevenueSignals | null {
  return null;
}

export const revenueAgent: Agent = {
  key: "revenue",
  label: "Revenue Agent",
  status: "planned",
  watches:
    "AdSense · Affiliate · Marketplace · Subscriptions (architecture only — no source wired)",
  run(ctx: AgentContext): Recommendation[] {
    const out: Recommendation[] = [...comparisonFunnel(ctx)];

    const signals = fetchRevenueSignals();
    if (signals) return out; // future: real revenue analysis lands here

    const sources = revenueSources();
    if (sources.some((s) => s.configured)) return out;

    // Configuration fact, not invented data: nothing is monetised.
    const users = ctx.growth.analytics.data.totals.users;
    out.push(
      buildRecommendation({
        id: "revenue-not-configured",
        agent: "revenue",
        title: "No monetisation is connected — affiliate is the #1 unlock",
        reason: `${fmt(users)} users/month are being served with zero revenue sources configured. Ads alone cannot reach the target at Indian RPMs; affiliate monetises the decision the calculators already sit in front of.`,
        expectedImpact:
          "Turns existing high-intent finance traffic into the primary revenue engine (₹300–5,000 per qualified conversion).",
        effort: "L",
        confidence: 0.9,
        owner: "Founder",
        evidence: [
          { label: "Users/month", value: fmt(users) },
          { label: "Revenue sources configured", value: "0 of 4" },
          { label: "Highest-priority source", value: "Affiliate / lead-gen" },
        ],
        trafficPotential: 0.9,
        businessValue: 1,
        deadlineDays: 30,
        now: ctx.now,
      })
    );
    return out;
  },
};

/** Minimum views before the funnel ratio means anything. */
const FUNNEL_MIN_VIEWS = 50;
/** Below this view→click rate, the comparisons are being read but not acted on. */
const FUNNEL_LOW_RATE = 0.02;

/**
 * Comparison funnel (GROWTH-002) — HARD-GATED on live analytics.
 *
 * Reads the GA4 event counts instrumented in REVENUE-001. If analytics is not
 * live, or the events have not accumulated, this produces NOTHING — waiting for
 * provider access is a state, never a guess.
 */
function comparisonFunnel(ctx: AgentContext): Recommendation[] {
  const analytics = ctx.growth.analytics;
  if (analytics.status !== "live") return [];

  const count = (name: string) => analytics.data.events.find((e) => e.label === name)?.value ?? 0;
  const views = count("comparison_view");
  const clicks = count("comparison_cta_click");
  if (views < FUNNEL_MIN_VIEWS) return [];

  const rate = views ? clicks / views : 0;
  if (rate >= FUNNEL_LOW_RATE) return [];

  return [
    buildRecommendation({
      id: "revenue-comparison-funnel",
      agent: "revenue",
      title: "Comparisons are read but not acted on — review the commercial pages",
      reason: `${fmt(views)} comparison views produced ${fmt(clicks)} option clicks (${(rate * 100).toFixed(1)}%) in 28 days. Readers engage with the decision frameworks but stop at the options.`,
      expectedImpact:
        "Clearer next-step CTAs (or the first real, disclosed partner link) converts existing decision-stage attention — the cheapest revenue improvement available.",
      effort: "M",
      confidence: 0.7,
      owner: "Founder",
      evidence: [
        { label: "comparison_view (28d)", value: fmt(views) },
        { label: "comparison_cta_click (28d)", value: fmt(clicks) },
        { label: "View→click rate", value: `${(rate * 100).toFixed(1)}%` },
      ],
      trafficPotential: 0.5,
      businessValue: 1,
      deadlineDays: 21,
      now: ctx.now,
    }),
  ];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

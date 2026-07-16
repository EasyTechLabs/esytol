/**
 * Competitor Agent — ARCHITECTURE ONLY. No scraping, no live signals.
 *
 * Wired into the agent registry with `status: "planned"` so the dashboard, the
 * scoring engine and the reports already account for it. When a signal source is
 * added later (SERP API, manual tracking sheet, or a licensed data provider) only
 * `fetchCompetitorSignals()` and `run()` change — nothing else in the system moves.
 *
 * Deliberately NOT implemented: scraping competitors is a legal/ToS question and a
 * data-quality question, not a coding one. It needs a decision before an engine.
 */

import type { Agent, AgentContext, Recommendation } from "../types";

/** A competitor we intend to track. */
export interface CompetitorProfile {
  key: string;
  name: string;
  domain: string;
  /** The clusters where they compete with us. */
  clusters: string[];
  /** Why they win today — the gap we differentiate against. */
  strength: string;
}

/** The tracking list. Data-only until a signal source is chosen. */
export const COMPETITORS: CompetitorProfile[] = [
  {
    key: "calculator-net",
    name: "Calculator.net",
    domain: "calculator.net",
    clusters: ["everyday", "finance", "math"],
    strength: "Massive authority + tool breadth",
  },
  {
    key: "groww",
    name: "Groww",
    domain: "groww.in",
    clusters: ["finance", "investing"],
    strength: "Brand + brokerage transaction",
  },
  {
    key: "cleartax",
    name: "ClearTax",
    domain: "cleartax.in",
    clusters: ["tax", "finance"],
    strength: "ITR filing transaction + trust",
  },
  {
    key: "bankbazaar",
    name: "BankBazaar",
    domain: "bankbazaar.com",
    clusters: ["loans", "cards", "finance"],
    strength: "Affiliate/lead-gen machine",
  },
  {
    key: "etmoney",
    name: "ET Money",
    domain: "etmoney.com",
    clusters: ["investing", "retirement"],
    strength: "App + brand + content",
  },
  {
    key: "omni",
    name: "Omni Calculator",
    domain: "omnicalculator.com",
    clusters: ["everyday", "math", "science"],
    strength: "Enormous long-tail coverage",
  },
  {
    key: "nerdwallet",
    name: "NerdWallet",
    domain: "nerdwallet.com",
    clusters: ["finance", "cards"],
    strength: "Trust content + affiliate (US)",
  },
];

/** Shape a future signal source must return. */
export interface CompetitorSignal {
  competitor: string;
  query: string;
  /** Their position vs ours for the same query. */
  theirPosition: number;
  ourPosition: number | null;
  /** Rich-result formats they hold and we don't. */
  featureGaps: string[];
}

/**
 * Future implementation point. Returns `null` until a signal source is wired.
 * Kept as an explicit seam so the agent contract never changes.
 */
export function fetchCompetitorSignals(): CompetitorSignal[] | null {
  return null;
}

export const competitorAgent: Agent = {
  key: "competitor",
  label: "Competitor Agent",
  status: "planned",
  watches: `SERP share vs ${COMPETITORS.length} tracked competitors (architecture only — no signal source wired)`,
  run(_ctx: AgentContext): Recommendation[] {
    void _ctx;
    const signals = fetchCompetitorSignals();
    if (!signals) return []; // planned: no data source, so no recommendations
    return [];
  },
};

/**
 * Marketing Agent — shared scoring.
 *
 * Opportunity Score = Traffic Potential × Business Value × Ease of Fix × Confidence
 *
 * Each factor is 0..1, so the product is 0..1 and is rendered as 0..100. Because
 * it is a product (not a sum), a zero on any factor zeroes the score — a huge
 * traffic opportunity that we can't act on, or don't believe, correctly ranks last.
 *
 * Business Value encodes strategy, not vanity: finance pages outrank everyday
 * pages because finance traffic is transaction-adjacent (affiliate/B2B), per the
 * ESYTOL-STRATEGY-001 revenue analysis. This is the single lever that keeps the
 * agent pointed at money rather than at pageviews.
 *
 * Pure + deterministic: no clock, no randomness.
 */

import type { Effort, Priority, ScoreInput, Recommendation } from "./types";
import type { Tool } from "@/types/tool";

/** Effort → ease-of-fix factor. */
const EASE: Record<Effort, number> = { S: 1, M: 0.6, L: 0.3 };

export function easeOfFix(effort: Effort): number {
  return EASE[effort];
}

/** Clamp helper — every factor must stay inside 0..1. */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * The opportunity score, 0..100.
 * Product of the four factors, each clamped to 0..1.
 */
export function opportunityScore(input: ScoreInput): number {
  const tp = clamp01(input.trafficPotential);
  const bv = clamp01(input.businessValue);
  const ef = clamp01(input.easeOfFix);
  const cf = clamp01(input.confidence);
  return Math.round(tp * bv * ef * cf * 100);
}

/** Score → priority band. Tuned so "critical" stays rare and meaningful. */
export function priorityFromScore(score: number): Priority {
  if (score >= 45) return "critical";
  if (score >= 25) return "high";
  if (score >= 10) return "medium";
  return "low";
}

// ── Traffic potential ─────────────────────────────────────────────────────────

/**
 * Normalise a monthly click/impression upside into 0..1.
 * Log-scaled: the difference between 10 and 100 clicks matters more than
 * between 10,000 and 10,100.
 */
export function trafficPotentialFromClicks(clicks: number): number {
  if (clicks <= 0) return 0;
  // ~1.0 at 1,000+ monthly clicks of upside.
  return clamp01(Math.log10(clicks + 1) / 3);
}

// ── Business value ────────────────────────────────────────────────────────────

/**
 * How valuable is traffic to this page?
 *
 * Finance tools are transaction-adjacent (affiliate/B2B) and carry the highest
 * value; everyday tools monetise via ads only; articles feed tools; hubs route.
 * Tags/category are read defensively so this keeps working after the planned
 * taxonomy migration (calculator → finance/everyday domains).
 */
export function businessValueForPage(page: string, tools: Tool[]): number {
  if (!page.startsWith("/")) return 0.3;

  if (page.startsWith("/tools/")) {
    const slug = page.replace(/^\/tools\//, "").replace(/\/$/, "");
    const tool = tools.find((t) => t.slug === slug);
    if (!tool) return 0.6;
    return isFinanceTool(tool) ? 1 : 0.6;
  }
  if (page.startsWith("/learn/")) return 0.5;
  if (page === "/" || page === "/tools" || page === "/learn") return 0.7;
  return 0.3;
}

/** A tool is "finance" by domain category (future) or by tags (today). */
export function isFinanceTool(tool: Tool): boolean {
  const tags = tool.tags.map((t) => t.toLowerCase());
  // Post-migration: an explicit finance domain wins.
  if ((tool.category as string) === "finance") return true;
  if (tags.includes("everyday") || tags.includes("utility")) return false;
  return (
    tags.includes("finance") ||
    tags.includes("tax") ||
    tags.includes("investment") ||
    tags.includes("retirement") ||
    tags.includes("loan") ||
    (tool.category as string) === "calculator"
  );
}

// ── Expected CTR curve ────────────────────────────────────────────────────────

/**
 * Expected organic CTR by average position — the baseline a page "should" earn.
 * Deliberately conservative (AI Overviews are compressing click-through), so the
 * agent doesn't over-promise. Used to quantify CTR upside in clicks/month.
 */
const CTR_CURVE: { maxPosition: number; ctr: number }[] = [
  { maxPosition: 1.5, ctr: 0.26 },
  { maxPosition: 2.5, ctr: 0.15 },
  { maxPosition: 3.5, ctr: 0.1 },
  { maxPosition: 4.5, ctr: 0.07 },
  { maxPosition: 5.5, ctr: 0.05 },
  { maxPosition: 7, ctr: 0.035 },
  { maxPosition: 10, ctr: 0.022 },
  { maxPosition: 15, ctr: 0.012 },
  { maxPosition: 20, ctr: 0.007 },
  { maxPosition: Infinity, ctr: 0.004 },
];

export function expectedCtr(position: number): number {
  for (const band of CTR_CURVE) {
    if (position <= band.maxPosition) return band.ctr;
  }
  return 0.004;
}

/** Monthly click upside if a page reached its position's expected CTR. */
export function ctrUpsideClicks(impressions: number, ctr: number, position: number): number {
  const gap = expectedCtr(position) - ctr;
  if (gap <= 0) return 0;
  return Math.round(impressions * gap);
}

// ── Ranking ───────────────────────────────────────────────────────────────────

/**
 * Rank recommendations: score desc, then priority, then quantified impact.
 * Deterministic tie-break on id so ordering is stable across runs.
 */
const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function rankRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    const ai = a.impactClicks ?? 0;
    const bi = b.impactClicks ?? 0;
    if (bi !== ai) return bi - ai;
    return a.id.localeCompare(b.id);
  });
}

/**
 * The founder's "do these today" list.
 *
 * Pure score-ranking is correct for the full backlog but wrong for a briefing:
 * one agent can produce five near-identical high scores (e.g. the same dead-click
 * fix on five pages) and crowd out the only revenue or engineering item. This caps
 * each agent's share so the top list spans the business, then back-fills by score
 * if slots remain. Input must already be score-ranked; output stays score-ordered.
 */
export function pickTopPriorities(
  ranked: Recommendation[],
  limit = 10,
  maxPerAgent = 2
): Recommendation[] {
  const perAgent = new Map<string, number>();
  const picked: Recommendation[] = [];

  for (const rec of ranked) {
    if (picked.length >= limit) break;
    const used = perAgent.get(rec.agent) ?? 0;
    if (used >= maxPerAgent) continue;
    perAgent.set(rec.agent, used + 1);
    picked.push(rec);
  }

  // Back-fill with the best of the rest if the cap left us short.
  if (picked.length < limit) {
    const taken = new Set(picked.map((r) => r.id));
    for (const rec of ranked) {
      if (picked.length >= limit) break;
      if (!taken.has(rec.id)) picked.push(rec);
    }
  }

  return rankRecommendations(picked);
}

// ── Recommendation builder ────────────────────────────────────────────────────

export interface BuildRecInput {
  id: string;
  agent: Recommendation["agent"];
  title: string;
  reason: string;
  expectedImpact: string;
  impactClicks?: number;
  effort: Effort;
  confidence: number;
  owner: Recommendation["owner"];
  evidence: Recommendation["evidence"];
  trafficPotential: number;
  businessValue: number;
  page?: string;
  query?: string;
  /** Days from `now` for the suggested deadline. */
  deadlineDays: number;
  now: Date;
}

/**
 * Single construction point for recommendations — guarantees every one is scored,
 * prioritised and dated the same way, whichever agent produced it.
 */
export function buildRecommendation(input: BuildRecInput): Recommendation {
  const score = opportunityScore({
    trafficPotential: input.trafficPotential,
    businessValue: input.businessValue,
    easeOfFix: easeOfFix(input.effort),
    confidence: input.confidence,
  });
  return {
    id: input.id,
    agent: input.agent,
    category: input.agent,
    priority: priorityFromScore(score),
    title: input.title,
    reason: input.reason,
    expectedImpact: input.expectedImpact,
    impactClicks: input.impactClicks,
    effort: input.effort,
    confidence: clamp01(input.confidence),
    owner: input.owner,
    deadline: addDays(input.now, input.deadlineDays),
    score,
    evidence: input.evidence,
    page: input.page,
    query: input.query,
  };
}

export function addDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

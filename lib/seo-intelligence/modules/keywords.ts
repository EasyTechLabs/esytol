/**
 * 1 — Keyword Opportunity Engine.
 *
 * Owns the **ranking lever**: opportunities where the fix is *position*, not the
 * snippet. The CTR lever lives in `ctr.ts`. This split mirrors the doctrine that a
 * page must never be given contradictory advice:
 *
 *   position ≤ 10   → CTR lever      (ctr.ts)
 *   position 11–20  → ranking lever  (here — striking distance)
 *   position > 20   → content depth  (contentGap.ts / serp.ts)
 *
 * Also owns query-level movement (gaining / losing), because a keyword that moved is
 * a ranking event.
 *
 * Recommendation ids are preserved from the original Marketing Agent SEO agent
 * (`seo-striking-*`, `seo-losing-*`, `seo-gaining-*`) — this module is now their
 * single implementation.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import {
  buildRecommendation,
  businessValueForPage,
  expectedCtr,
  opportunityScore,
  easeOfFix,
  trafficPotentialFromClicks,
} from "@/lib/marketing-agent/scoring";
import type { KeywordOpportunity, SeoContext, SeoModule } from "../types";

const MIN_IMPRESSIONS_STRIKING = 400;
const RANK_MOVE = 1.5;
const PER_RULE_LIMIT = 5;

/** Target position we assume a striking-distance page can reach. */
const STRIKING_TARGET_POSITION = 8;

// ── Data output: the keyword opportunity table ────────────────────────────────

/**
 * Every tracked query, scored and given the one action its rank implies.
 * This is the engine's keyword view — consumed by reports and the roadmap.
 */
export function keywordOpportunities(ctx: SeoContext): KeywordOpportunity[] {
  const rows = ctx.growth.searchConsole.data.topQueries.map((q): KeywordOpportunity => {
    const { lever, action, gain } = leverFor(q.position, q.ctr, q.impressions, q.positionDelta);
    return {
      query: q.query,
      position: q.position,
      ctr: q.ctr,
      impressions: q.impressions,
      clicks: q.clicks,
      potentialClickGain: gain,
      opportunityScore: opportunityScore({
        trafficPotential: trafficPotentialFromClicks(gain),
        // Keywords aren't page-bound; use a finance-leaning default weight.
        businessValue: 0.8,
        easeOfFix: easeOfFix(lever === "ctr" ? "S" : lever === "content" ? "L" : "M"),
        confidence: lever === "ctr" ? 0.8 : lever === "ranking" ? 0.65 : 0.5,
      }),
      suggestedAction: action,
      lever,
    };
  });
  return rows.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function leverFor(
  position: number,
  ctr: number,
  impressions: number,
  delta: number
): { lever: KeywordOpportunity["lever"]; action: string; gain: number } {
  if (delta >= RANK_MOVE) {
    return {
      lever: "defend",
      action: `Slipped ${delta.toFixed(1)} places — refresh the target page and add internal links.`,
      gain: Math.max(1, Math.round(impressions * expectedCtr(position) * 0.4)),
    };
  }
  if (delta <= -RANK_MOVE) {
    return {
      lever: "compound",
      action: `Improved ${Math.abs(delta).toFixed(1)} places — add depth and links while it climbs.`,
      gain: Math.max(1, Math.round(impressions * (expectedCtr(Math.max(1, position - 3)) - ctr))),
    };
  }
  if (position <= 10) {
    const gain = Math.max(0, Math.round(impressions * (expectedCtr(position) - ctr)));
    return {
      lever: "ctr",
      action:
        gain > 0
          ? "On page 1 — rewrite the title/meta to earn the click."
          : "Performing at or above the CTR curve — hold.",
      gain,
    };
  }
  if (position <= 20) {
    return {
      lever: "ranking",
      action: "Striking distance — internal links + content refresh to reach page 1.",
      gain: Math.max(0, Math.round(impressions * (expectedCtr(STRIKING_TARGET_POSITION) - ctr))),
    };
  }
  return {
    lever: "content",
    action: "Ranks beyond page 2 — needs dedicated depth to compete.",
    gain: Math.max(0, Math.round(impressions * (expectedCtr(15) - ctr))),
  };
}

// ── Module: recommendations ───────────────────────────────────────────────────

export const keywordsModule: SeoModule = {
  key: "keywords",
  label: "Keyword Opportunity Engine",
  purpose: "Ranking-lever opportunities: striking distance, and keywords gaining or losing ground",
  run(ctx: SeoContext): Recommendation[] {
    const gsc = ctx.growth.searchConsole.data;
    const out: Recommendation[] = [];

    // Striking distance (page 2) — the cheapest ranking wins on the site.
    const striking = gsc.topPages
      .filter(
        (p) => p.position > 10 && p.position <= 20 && p.impressions >= MIN_IMPRESSIONS_STRIKING
      )
      .map((p) => ({
        p,
        upside: Math.max(
          0,
          Math.round(p.impressions * (expectedCtr(STRIKING_TARGET_POSITION) - p.ctr))
        ),
      }))
      .filter((x) => x.upside > 0)
      .sort((a, b) => b.upside - a.upside)
      .slice(0, PER_RULE_LIMIT);

    for (const { p, upside } of striking) {
      out.push(
        buildRecommendation({
          id: `seo-striking-${p.page}`,
          agent: "seo",
          title: `Push to page 1 — ${p.page}`,
          reason: `Sits at #${p.position.toFixed(1)} (page 2) on ${fmt(p.impressions)} impressions. Striking distance: internal links + a content refresh usually move this.`,
          expectedImpact: `≈ +${fmt(upside)} clicks/month if it reaches the top 10.`,
          impactClicks: upside,
          effort: "M",
          confidence: 0.65,
          owner: "SEO",
          page: p.page,
          evidence: [
            { label: "Position", value: p.position.toFixed(1) },
            { label: "Impressions", value: fmt(p.impressions) },
            { label: "Clicks", value: fmt(p.clicks) },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 14,
          now: ctx.now,
        })
      );
    }

    // Losing keywords.
    const losing = gsc.topQueries
      .filter((q) => q.positionDelta >= RANK_MOVE && q.impressions >= MIN_IMPRESSIONS_STRIKING)
      .sort((a, b) => b.positionDelta - a.positionDelta)
      .slice(0, PER_RULE_LIMIT);

    for (const q of losing) {
      const upside = Math.max(1, Math.round(q.impressions * expectedCtr(q.position) * 0.4));
      out.push(
        buildRecommendation({
          id: `seo-losing-${q.query}`,
          agent: "seo",
          title: `Losing ground — "${q.query}"`,
          reason: `Dropped ${q.positionDelta.toFixed(1)} positions to #${q.position.toFixed(1)} on ${fmt(q.impressions)} impressions. Refresh the target page and strengthen internal links.`,
          expectedImpact: `Recovering the lost rank protects ≈ ${fmt(upside)} clicks/month.`,
          impactClicks: upside,
          effort: "M",
          confidence: 0.6,
          owner: "SEO",
          query: q.query,
          evidence: [
            {
              label: "Position",
              value: `${q.position.toFixed(1)} (▼ ${q.positionDelta.toFixed(1)})`,
            },
            { label: "Impressions", value: fmt(q.impressions) },
            { label: "Clicks", value: fmt(q.clicks) },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: 0.8,
          deadlineDays: 10,
          now: ctx.now,
        })
      );
    }

    // Gaining keywords — momentum is cheap to compound.
    const gaining = gsc.topQueries
      .filter((q) => q.positionDelta <= -RANK_MOVE && q.impressions >= MIN_IMPRESSIONS_STRIKING)
      .sort((a, b) => a.positionDelta - b.positionDelta)
      .slice(0, 3);

    for (const q of gaining) {
      const upside = Math.max(
        1,
        Math.round(q.impressions * (expectedCtr(Math.max(1, q.position - 3)) - q.ctr))
      );
      out.push(
        buildRecommendation({
          id: `seo-gaining-${q.query}`,
          agent: "seo",
          title: `Compound a winner — "${q.query}"`,
          reason: `Improved ${Math.abs(q.positionDelta).toFixed(1)} positions to #${q.position.toFixed(1)}. Momentum here is cheap to extend with links and depth.`,
          expectedImpact:
            upside > 0
              ? `≈ +${fmt(upside)} clicks/month if it keeps climbing.`
              : "Protects and extends existing momentum.",
          impactClicks: upside > 0 ? upside : undefined,
          effort: "M",
          confidence: 0.55,
          owner: "SEO",
          query: q.query,
          evidence: [
            {
              label: "Position",
              value: `${q.position.toFixed(1)} (▲ ${Math.abs(q.positionDelta).toFixed(1)})`,
            },
            { label: "Impressions", value: fmt(q.impressions) },
          ],
          trafficPotential: trafficPotentialFromClicks(Math.max(1, upside)),
          businessValue: 0.8,
          deadlineDays: 21,
          now: ctx.now,
        })
      );
    }

    return out;
  },
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

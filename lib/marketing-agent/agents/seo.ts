/**
 * SEO Agent — reads Google Search Console.
 *
 * The lever depends on where a page already ranks:
 *   position ≤ 10   → the lever is **CTR** (title/meta rewrite)
 *   position 11–20  → the lever is **ranking** (internal links + refresh)
 *   position > 20   → the lever is **content depth** (usually a Content Agent job)
 *
 * Splitting the rules this way means a page is never double-recommended for
 * contradictory work, and each recommendation names the one action that moves it.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import {
  buildRecommendation,
  businessValueForPage,
  ctrUpsideClicks,
  expectedCtr,
  trafficPotentialFromClicks,
} from "../scoring";

const MIN_IMPRESSIONS_CTR = 800;
const MIN_IMPRESSIONS_STRIKING = 400;
const MIN_IMPRESSIONS_ZERO_CLICK = 250;
const RANK_MOVE = 1.5;
const PER_RULE_LIMIT = 5;

export const seoAgent: Agent = {
  key: "seo",
  label: "SEO Agent",
  status: "active",
  watches: "Search Console — rankings, CTR, impressions, striking-distance pages",
  run(ctx: AgentContext): Recommendation[] {
    const gsc = ctx.growth.searchConsole.data;
    const out: Recommendation[] = [];

    // 1 ─ CTR opportunity: already on page 1, but under-clicked for its position.
    const ctrOpps = gsc.topPages
      .filter((p) => p.position <= 10 && p.impressions >= MIN_IMPRESSIONS_CTR)
      .map((p) => ({ p, upside: ctrUpsideClicks(p.impressions, p.ctr, p.position) }))
      .filter((x) => x.upside > 0)
      .sort((a, b) => b.upside - a.upside)
      .slice(0, PER_RULE_LIMIT);

    for (const { p, upside } of ctrOpps) {
      out.push(
        buildRecommendation({
          id: `seo-ctr-${p.page}`,
          agent: "seo",
          title: `Rewrite title & meta — ${p.page}`,
          reason: `Ranks #${p.position.toFixed(1)} with ${fmt(p.impressions)} impressions but only ${pct(p.ctr)} CTR (expected ~${pct(expectedCtr(p.position))} at this position).`,
          expectedImpact: `≈ +${fmt(upside)} clicks/month at the same ranking.`,
          impactClicks: upside,
          effort: "S",
          confidence: 0.8,
          owner: "SEO",
          page: p.page,
          evidence: [
            { label: "Impressions", value: fmt(p.impressions) },
            { label: "CTR", value: pct(p.ctr) },
            { label: "Expected CTR", value: pct(expectedCtr(p.position)) },
            { label: "Position", value: p.position.toFixed(1) },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 7,
          now: ctx.now,
        })
      );
    }

    // 2 ─ Striking distance: page 2. The cheapest ranking wins on the site.
    const striking = gsc.topPages
      .filter(
        (p) => p.position > 10 && p.position <= 20 && p.impressions >= MIN_IMPRESSIONS_STRIKING
      )
      .map((p) => ({
        p,
        // Upside = getting to ~position 8 and earning that position's CTR.
        upside: Math.max(0, Math.round(p.impressions * (expectedCtr(8) - p.ctr))),
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

    // 3 ─ Impressions but no clicks: seen, never chosen.
    const zeroClick = gsc.topPages
      .filter((p) => p.clicks === 0 && p.impressions >= MIN_IMPRESSIONS_ZERO_CLICK)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, PER_RULE_LIMIT);

    for (const p of zeroClick) {
      const upside = Math.max(1, Math.round(p.impressions * expectedCtr(p.position)));
      out.push(
        buildRecommendation({
          id: `seo-zeroclick-${p.page}`,
          agent: "seo",
          title: `Zero clicks despite ${fmt(p.impressions)} impressions — ${p.page}`,
          reason: `Shown ${fmt(p.impressions)} times and clicked ${p.clicks} times at #${p.position.toFixed(1)}. The snippet is not earning the click.`,
          expectedImpact: `Recovering even the expected CTR is ≈ +${fmt(upside)} clicks/month.`,
          impactClicks: upside,
          effort: "S",
          confidence: 0.7,
          owner: "SEO",
          page: p.page,
          evidence: [
            { label: "Impressions", value: fmt(p.impressions) },
            { label: "Clicks", value: "0" },
            { label: "Position", value: p.position.toFixed(1) },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 7,
          now: ctx.now,
        })
      );
    }

    // 4 ─ Losing keywords: rankings slipped.
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

    // 5 ─ Gaining keywords: momentum worth compounding.
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
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

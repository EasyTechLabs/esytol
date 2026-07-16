/**
 * 6 — CTR Optimizer.
 *
 * Owns the **CTR lever**: pages already on page 1 that under-earn their position,
 * and pages seen but never clicked. Does not touch ranking (see `keywords.ts`).
 *
 * Goes beyond "rewrite the title" by generating an actual suggested title and meta
 * description from the registry/Learn metadata, plus schema advice — so the
 * recommendation is executable, not aspirational.
 *
 * Preserves the original ids `seo-ctr-*` and `seo-zeroclick-*`; this module is now
 * their single implementation.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import {
  buildRecommendation,
  businessValueForPage,
  ctrUpsideClicks,
  expectedCtr,
  trafficPotentialFromClicks,
} from "@/lib/marketing-agent/scoring";
import type { CtrSuggestion, SeoContext, SeoModule } from "../types";

const MIN_IMPRESSIONS_CTR = 800;
const MIN_IMPRESSIONS_ZERO_CLICK = 250;
const PER_RULE_LIMIT = 5;

const YEAR_HINT = "2026";

/**
 * Build a concrete title/description suggestion for a page.
 * Uses the real tool/article metadata so the copy is grounded, then applies the
 * levers that actually move CTR: specificity, a benefit, and freshness.
 */
export function ctrSuggestionFor(
  page: string,
  ctx: SeoContext
): Omit<CtrSuggestion, "position" | "ctr" | "expectedCtr" | "impressions" | "potentialClickGain"> {
  const tool = ctx.tools.find((t) => t.url === page);
  if (tool) {
    return {
      page,
      suggestedTitle: `${tool.name} — Free & Instant (${YEAR_HINT})`,
      suggestedDescription: `${firstSentence(tool.description)} Free, private, no signup — runs in your browser.`,
      schemaAdvice:
        (tool.faq?.length ?? 0) > 0
          ? "FAQPage schema is present — verify it renders as a rich result in Search Console."
          : "Add FAQ entries to the registry to emit FAQPage schema and widen the SERP footprint.",
    };
  }

  const slug = page.replace(/^\/learn\//, "");
  const article = ctx.articles.find((a) => a.slug === slug);
  if (article) {
    return {
      page,
      suggestedTitle: `${article.frontmatter.title} (${YEAR_HINT})`,
      suggestedDescription: firstSentence(article.frontmatter.metaDescription),
      schemaAdvice:
        article.faqs.length > 0
          ? "Article + FAQPage schema present — target the PAA box with the existing FAQs."
          : "No FAQ section — add one to emit FAQPage schema and compete for People-Also-Ask.",
    };
  }

  return {
    page,
    suggestedTitle: "Lead with the outcome and add the year for freshness.",
    suggestedDescription:
      "State the benefit in the first 120 characters; front-load the primary keyword.",
    schemaAdvice: "Ensure the page emits Breadcrumb + the type-appropriate schema.",
  };
}

/** The full CTR suggestion table — consumed by the weekly report. */
export function ctrSuggestions(ctx: SeoContext): CtrSuggestion[] {
  return ctx.growth.searchConsole.data.topPages
    .filter((p) => p.position <= 10 && p.impressions >= MIN_IMPRESSIONS_CTR)
    .map((p) => {
      const gain = ctrUpsideClicks(p.impressions, p.ctr, p.position);
      return {
        ...ctrSuggestionFor(p.page, ctx),
        position: p.position,
        ctr: p.ctr,
        expectedCtr: expectedCtr(p.position),
        impressions: p.impressions,
        potentialClickGain: gain,
      };
    })
    .filter((s) => s.potentialClickGain > 0)
    .sort((a, b) => b.potentialClickGain - a.potentialClickGain);
}

export const ctrModule: SeoModule = {
  key: "ctr",
  label: "CTR Optimizer",
  purpose: "Page-1 pages under-earning their position, plus concrete title/meta/schema fixes",
  run(ctx: SeoContext): Recommendation[] {
    const gsc = ctx.growth.searchConsole.data;
    const out: Recommendation[] = [];

    // CTR opportunity: on page 1, under-clicked for its position.
    const ctrOpps = gsc.topPages
      .filter((p) => p.position <= 10 && p.impressions >= MIN_IMPRESSIONS_CTR)
      .map((p) => ({ p, upside: ctrUpsideClicks(p.impressions, p.ctr, p.position) }))
      .filter((x) => x.upside > 0)
      .sort((a, b) => b.upside - a.upside)
      .slice(0, PER_RULE_LIMIT);

    for (const { p, upside } of ctrOpps) {
      const s = ctrSuggestionFor(p.page, ctx);
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
            { label: "Suggested title", value: s.suggestedTitle },
            { label: "Schema", value: s.schemaAdvice },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 7,
          now: ctx.now,
        })
      );
    }

    // Impressions but no clicks — seen, never chosen.
    const zeroClick = gsc.topPages
      .filter((p) => p.clicks === 0 && p.impressions >= MIN_IMPRESSIONS_ZERO_CLICK)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, PER_RULE_LIMIT);

    for (const p of zeroClick) {
      const upside = Math.max(1, Math.round(p.impressions * expectedCtr(p.position)));
      const s = ctrSuggestionFor(p.page, ctx);
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
            { label: "Suggested title", value: s.suggestedTitle },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 7,
          now: ctx.now,
        })
      );
    }

    return out;
  },
};

function firstSentence(s: string): string {
  const t = (s ?? "").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return (m ? m[1] : t).slice(0, 150);
}
function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

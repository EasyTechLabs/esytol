/**
 * 4 — SERP Opportunity Engine.
 *
 * Classifies queries by the *SERP feature* they can win, not by rank alone. Search
 * Console gives no feature data, so intent is inferred from query shape — the same
 * signal an editor would read:
 *
 *   "what is x"        → definition  → answer in ≤ 50 words near the top
 *   "how / why / when" → PAA         → an FAQ entry phrased as the question
 *   "x vs y", "x or y" → comparison  → a comparison table (AI-resistant, monetisable)
 *   4+ words           → long-tail   → dedicated section or article
 *   top-5, low CTR     → snippet     → structure to steal position 0
 *
 * Inference is honest about itself: confidence is capped, and every recommendation
 * names the query it was derived from.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import {
  buildRecommendation,
  expectedCtr,
  trafficPotentialFromClicks,
} from "@/lib/marketing-agent/scoring";
import type { SeoContext, SeoModule, SerpOpportunity, SerpOpportunityKind } from "../types";

const MIN_IMPRESSIONS = 300;
const PER_KIND_LIMIT = 3;
const SNIPPET_MAX_POSITION = 5;

/** Query shape → the SERP feature it can plausibly win. */
export function classifyQuery(
  query: string,
  position: number,
  ctr: number
): SerpOpportunityKind | null {
  const q = query.toLowerCase().trim();

  if (/\bvs\.?\b|\bversus\b|\bor\b.+\bbetter\b|which is better/.test(q)) return "comparison";
  if (/^what (is|are)\b|^define\b|\bmeaning\b/.test(q)) return "definition";
  if (/^(how|why|when|where|who|can|should|do|does|is)\b/.test(q)) return "people-also-ask";
  if (position <= SNIPPET_MAX_POSITION && ctr < expectedCtr(position)) return "featured-snippet";
  if (q.split(/\s+/).length >= 4) return "long-tail";
  return null;
}

const ACTION: Record<SerpOpportunityKind, string> = {
  "featured-snippet":
    "Add a 40–55 word direct answer immediately under the H1, then the detail — the shape Google lifts into position 0.",
  "people-also-ask":
    "Add this exact question as an FAQ entry with a concise answer so it emits FAQPage schema.",
  faq: "Cover this in the page's FAQ block so it qualifies for the FAQ rich result.",
  comparison:
    "Add a comparison table with a clear recommendation — decision content, not an explainer.",
  definition: "Open with a one-sentence definition before any elaboration.",
  "long-tail":
    "Give this specific phrasing its own section (or article) instead of burying it in a general page.",
};

const CONFIDENCE: Record<SerpOpportunityKind, number> = {
  "featured-snippet": 0.5,
  "people-also-ask": 0.6,
  faq: 0.6,
  comparison: 0.55,
  definition: 0.6,
  "long-tail": 0.5,
};

const EFFORT: Record<SerpOpportunityKind, "S" | "M" | "L"> = {
  "featured-snippet": "S",
  "people-also-ask": "S",
  faq: "S",
  comparison: "M",
  definition: "S",
  "long-tail": "M",
};

/** The SERP opportunity table — consumed by the weekly report. */
export function serpOpportunities(ctx: SeoContext): SerpOpportunity[] {
  const out: SerpOpportunity[] = [];
  for (const q of ctx.growth.searchConsole.data.topQueries) {
    if (q.impressions < MIN_IMPRESSIONS) continue;
    const kind = classifyQuery(q.query, q.position, q.ctr);
    if (!kind) continue;
    out.push({
      kind,
      query: q.query,
      position: q.position,
      impressions: q.impressions,
      action: ACTION[kind],
    });
  }
  return out.sort((a, b) => b.impressions - a.impressions);
}

export const serpModule: SeoModule = {
  key: "serp",
  label: "SERP Opportunity Engine",
  purpose: "Featured snippets, People-Also-Ask, FAQ, comparison, definition and long-tail capture",
  run(ctx: SeoContext): Recommendation[] {
    const out: Recommendation[] = [];
    const byKind = new Map<SerpOpportunityKind, SerpOpportunity[]>();

    for (const o of serpOpportunities(ctx)) {
      byKind.set(o.kind, [...(byKind.get(o.kind) ?? []), o]);
    }

    for (const [kind, list] of byKind) {
      for (const o of list.slice(0, PER_KIND_LIMIT)) {
        // Winning a SERP feature is worth roughly a doubling of the position's CTR.
        const upside = Math.max(1, Math.round(o.impressions * expectedCtr(o.position) * 0.5));
        out.push(
          buildRecommendation({
            id: `seo-serp-${kind}-${o.query}`,
            agent: "seo",
            title: `${LABEL[kind]} — "${o.query}"`,
            reason: `"${o.query}" draws ${fmt(o.impressions)} impressions at #${o.position.toFixed(1)} and its phrasing is a ${LABEL[kind].toLowerCase()} target. ${ACTION[kind]}`,
            expectedImpact: `Winning the feature is worth ≈ +${fmt(upside)} clicks/month without moving rank.`,
            impactClicks: upside,
            effort: EFFORT[kind],
            confidence: CONFIDENCE[kind],
            owner: kind === "comparison" ? "Content" : "SEO",
            query: o.query,
            evidence: [
              { label: "Query", value: o.query },
              { label: "Impressions", value: fmt(o.impressions) },
              { label: "Position", value: o.position.toFixed(1) },
              { label: "Feature", value: LABEL[kind] },
              {
                label: "Basis",
                value: "Inferred from query shape — Search Console reports no feature data.",
              },
            ],
            trafficPotential: trafficPotentialFromClicks(upside),
            businessValue: kind === "comparison" ? 0.9 : 0.7,
            deadlineDays: EFFORT[kind] === "S" ? 10 : 21,
            now: ctx.now,
          })
        );
      }
    }

    return out;
  },
};

const LABEL: Record<SerpOpportunityKind, string> = {
  "featured-snippet": "Featured snippet",
  "people-also-ask": "People-Also-Ask",
  faq: "FAQ rich result",
  comparison: "Comparison",
  definition: "Definition",
  "long-tail": "Long-tail",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

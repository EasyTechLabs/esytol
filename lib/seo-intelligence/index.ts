/**
 * SEO Intelligence Engine — the entry point.
 *
 * `analyseSeo(ctx)` is pure: same context in, same roadmap and reports out, with no
 * I/O — so the whole engine is unit-testable without a network.
 * `getSeoIntelligence(now)` is the I/O wrapper, reusing the Marketing Agent's context
 * builder so both engines always read identical inputs.
 *
 * ## Where the rules live
 * Every SEO and content-gap rule on the platform is implemented **here**, once. The
 * Marketing Agent's `seo` and `content` agents are thin adapters over these modules:
 * they select which slice reaches the daily briefing and own no rules of their own.
 * If a rule needs to change, it changes in `modules/` and every surface follows.
 *
 * ## Import direction (there is no cycle)
 *   marketing-agent/{scoring,types,context}  ← leaves, no agent imports
 *            ↑                    ↑
 *   seo-intelligence/*            |
 *            ↑                    |
 *   marketing-agent/agents/{seo,content}     → adapters
 *            ↑
 *   marketing-agent/index                    → barrel
 *
 * Never import the `marketing-agent` barrel from this engine — that closes the loop.
 */

import type { AgentContext } from "@/lib/marketing-agent/types";
import { buildContext } from "@/lib/marketing-agent/context";
import type { SeoContext, SeoIntelligenceResult } from "./types";
import { buildRoadmap } from "./roadmap";
import {
  keywordOpportunities,
  clusterHealth,
  serpOpportunities,
  linkSuggestions,
  ctrSuggestions,
} from "./modules";
import { dailySeoReport, weeklySeoReport, monthlySeoReport, type ReportInput } from "./reports";

/** The full SEO picture for a context. Pure + deterministic. */
export function analyseSeo(ctx: SeoContext): SeoIntelligenceResult {
  const roadmap = buildRoadmap(ctx);
  const input: ReportInput = {
    ctx,
    roadmap,
    keywords: keywordOpportunities(ctx),
    clusters: clusterHealth(ctx),
    serp: serpOpportunities(ctx),
    internalLinks: linkSuggestions(ctx),
    ctr: ctrSuggestions(ctx),
  };

  return {
    generatedAt: ctx.now.toISOString(),
    noneLive: ctx.growth.noneLive,
    recommendations: roadmap.tasks,
    roadmap,
    keywords: input.keywords,
    clusters: input.clusters,
    serp: input.serp,
    internalLinks: input.internalLinks,
    ctr: input.ctr,
    daily: dailySeoReport(input),
    weekly: weeklySeoReport(input),
    monthly: monthlySeoReport(input),
  };
}

/** The dashboard entry point: gather all data, then analyse. */
export async function getSeoIntelligence(now: Date = new Date()): Promise<SeoIntelligenceResult> {
  const ctx: AgentContext = await buildContext(now);
  return analyseSeo(ctx);
}

export * from "./types";
export { SEO_MODULES } from "./modules";
export { CLUSTERS } from "./clusters";
export { buildRoadmap, runModules } from "./roadmap";
export {
  keywordOpportunities,
  clusterHealth,
  serpOpportunities,
  linkSuggestions,
  ctrSuggestions,
  ctrSuggestionFor,
  classifyQuery,
  inboundGraph,
  outboundLinks,
} from "./modules";

/**
 * Content Agent — a thin adapter over the SEO Intelligence Engine's Content Gap module.
 *
 * This agent owns **no rules**. GROWTH-013 moved every content-gap rule into
 * `lib/seo-intelligence/modules/contentGap.ts`, which is now their single
 * implementation — the same code backs the daily briefing, the SEO roadmap and the
 * weekly/monthly reports, so they cannot drift apart.
 *
 * Imports the module directly, never the `seo-intelligence` barrel — the barrel
 * imports `marketing-agent/context`, which would close a cycle.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import { rankRecommendations } from "../scoring";
import { contentGapModule } from "@/lib/seo-intelligence/modules/contentGap";

export const contentAgent: Agent = {
  key: "content",
  label: "Content Agent",
  status: "active",
  watches:
    "Learn Center + registry + tool usage — content gaps, FAQs, internal links, collections, comparisons",
  run(ctx: AgentContext): Recommendation[] {
    return rankRecommendations(contentGapModule.run(ctx));
  },
};

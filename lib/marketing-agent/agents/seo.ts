/**
 * SEO Agent — a thin adapter over the SEO Intelligence Engine.
 *
 * This agent owns **no rules**. Every SEO rule on the platform lives in
 * `lib/seo-intelligence/modules/*`, which is the single implementation; GROWTH-013
 * moved them there so the daily briefing, the SEO roadmap and the reports can never
 * disagree about what "an SEO problem" is.
 *
 * What the adapter *does* own is the briefing decision: the engine's job is to be
 * exhaustive (up to 100 ranked tasks), the daily briefing's job is to be readable.
 * So it selects the modules whose output belongs in a founder's morning list and
 * lets the engine rank them.
 *
 * The lever split it used to implement is now doctrine inside the engine:
 *   position ≤ 10   → CTR lever      (modules/ctr.ts)
 *   position 11–20  → ranking lever  (modules/keywords.ts)
 *   position > 20   → content depth  (modules/contentGap.ts, modules/serp.ts)
 *
 * Imports the engine's modules directly, never the `seo-intelligence` barrel — the
 * barrel imports `marketing-agent/context`, which would close a cycle.
 */

import type { Agent, AgentContext, Recommendation } from "../types";
import { rankRecommendations } from "../scoring";
import { keywordsModule } from "@/lib/seo-intelligence/modules/keywords";
import { ctrModule } from "@/lib/seo-intelligence/modules/ctr";
import { internalLinksModule } from "@/lib/seo-intelligence/modules/internalLinks";
import { serpModule } from "@/lib/seo-intelligence/modules/serp";
import { clustersModule } from "@/lib/seo-intelligence/modules/clusters";

/**
 * The modules that produce `agent: "seo"` recommendations.
 * `contentGap` is excluded here — it produces `agent: "content"` and is surfaced by
 * the Content Agent, so each recommendation reaches the briefing exactly once.
 */
const SEO_BRIEFING_MODULES = [
  ctrModule,
  keywordsModule,
  internalLinksModule,
  serpModule,
  clustersModule,
];

export const seoAgent: Agent = {
  key: "seo",
  label: "SEO Agent",
  status: "active",
  watches:
    "Search Console — rankings, CTR, impressions, striking-distance pages, SERP features, internal links, cluster health",
  run(ctx: AgentContext): Recommendation[] {
    const out: Recommendation[] = [];
    const seen = new Set<string>();

    for (const seoModule of SEO_BRIEFING_MODULES) {
      for (const rec of seoModule.run(ctx)) {
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        out.push(rec);
      }
    }

    return rankRecommendations(out);
  },
};

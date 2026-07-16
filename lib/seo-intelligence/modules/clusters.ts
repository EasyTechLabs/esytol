/**
 * 5 — Topical Cluster Health.
 *
 * Scores every cluster on two axes that answer different questions:
 *
 *   **Coverage**  — does the cluster contain what it should? (expected topics met)
 *   **Authority** — is search actually rewarding it? (real clicks/position from GSC)
 *
 * The pair is what makes this useful: high coverage + low authority means the content
 * exists but isn't winning (a links/CTR problem); low coverage + high authority means
 * the cluster is punching above its weight and deserves investment. The depth-before-
 * breadth doctrine falls straight out of this — finish a cluster before opening a new
 * one.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import { buildRecommendation, clamp01, priorityFromScore } from "@/lib/marketing-agent/scoring";
import type { ClusterHealth, SeoContext, SeoModule } from "../types";
import { CLUSTERS, articlesInCluster, missingTopics, toolsInCluster } from "../clusters";

/** A cluster with tools but < this many articles cannot hold topical authority. */
const MIN_ARTICLES_PER_TOOL = 1;
const WEAK_AUTHORITY = 0.35;
const STRONG_COVERAGE = 0.7;

export function clusterHealth(ctx: SeoContext): ClusterHealth[] {
  const gsc = ctx.growth.searchConsole.data;
  const totalClicks = gsc.topPages.reduce((s, p) => s + p.clicks, 0) || 1;

  return CLUSTERS.map((def): ClusterHealth => {
    const tools = toolsInCluster(ctx.tools, def);
    const articles = articlesInCluster(ctx.articles, def);
    const missing = missingTopics(def, tools, articles);

    const coverage = clamp01(
      (def.expectedTopics.length - missing.length) / Math.max(1, def.expectedTopics.length)
    );

    // Authority: this cluster's share of clicks, lifted by how well its pages rank.
    const pages = gsc.topPages.filter((p) => {
      const inTools = tools.some((t) => t.url === p.page);
      const inArticles = articles.some((a) => `/learn/${a.slug}` === p.page);
      return inTools || inArticles;
    });
    const clicks = pages.reduce((s, p) => s + p.clicks, 0);
    const avgPosition = pages.length
      ? pages.reduce((s, p) => s + p.position, 0) / pages.length
      : 100;
    const share = clicks / totalClicks;
    const rankScore = clamp01((30 - avgPosition) / 30);
    const authority = clamp01(share * 0.6 + rankScore * 0.4);

    // Worst health × highest business value ⇒ highest priority.
    const gap = (1 - coverage) * 0.5 + (1 - authority) * 0.5;
    const score = clamp01(gap * def.businessValue) * 100;

    return {
      key: def.key,
      label: def.label,
      tools: tools.length,
      articles: articles.length,
      coverage,
      authority,
      missingTopics: missing,
      priority: priorityFromScore(score),
      businessValue: def.businessValue,
    };
  }).sort((a, b) => b.businessValue - a.businessValue || a.coverage - b.coverage);
}

export const clustersModule: SeoModule = {
  key: "clusters",
  label: "Topical Cluster Health",
  purpose: "Coverage vs authority per cluster — where depth pays before breadth",
  run(ctx: SeoContext): Recommendation[] {
    const out: Recommendation[] = [];

    for (const c of clusterHealth(ctx)) {
      // A cluster we've never entered is not "incomplete" — it's unopened. Entering
      // one is a breadth decision for the roadmap, not an SEO gap, and every rule
      // below assumes something exists to improve. Without this guard the engine
      // tells a site with no tax content to "complete the Tax cluster", which is
      // exactly the breadth-before-depth mistake the monthly report warns against.
      if (c.tools === 0 && c.articles === 0) continue;

      // 1 ─ Incomplete high-value cluster: named missing topics.
      if (c.missingTopics.length > 0 && c.businessValue >= 0.9) {
        out.push(
          buildRecommendation({
            id: `seo-cluster-gap-${c.key}`,
            agent: "seo",
            title: `Complete the ${c.label} cluster — ${c.missingTopics.length} topics missing`,
            reason: `${c.label} is a top-value cluster at ${pct(c.coverage)} coverage. Missing: ${c.missingTopics.join(", ")}. Google rewards demonstrated topical completeness, and an unfinished high-value cluster caps every page inside it.`,
            expectedImpact: `Completing the cluster lifts every existing ${c.label} page, not just the new ones.`,
            effort: c.missingTopics.length > 2 ? "L" : "M",
            confidence: 0.6,
            owner: "Content",
            evidence: [
              { label: "Cluster", value: c.label },
              { label: "Coverage", value: pct(c.coverage) },
              { label: "Authority", value: pct(c.authority) },
              { label: "Tools / Articles", value: `${c.tools} / ${c.articles}` },
              { label: "Missing", value: c.missingTopics.join(", ") },
            ],
            trafficPotential: 0.7,
            businessValue: c.businessValue,
            deadlineDays: 45,
            now: ctx.now,
          })
        );
      }

      // 2 ─ Content exists but search isn't rewarding it → links/CTR, not more content.
      if (c.coverage >= STRONG_COVERAGE && c.authority < WEAK_AUTHORITY && c.articles > 0) {
        out.push(
          buildRecommendation({
            id: `seo-cluster-authority-${c.key}`,
            agent: "seo",
            title: `${c.label} has content but no authority`,
            reason: `Coverage is ${pct(c.coverage)} but authority is only ${pct(c.authority)}. The content exists and isn't winning — this is a links and CTR problem, not a "write more" problem. Writing more here would be wasted effort.`,
            expectedImpact: "Interlinking and snippet work convert existing content into rankings.",
            effort: "M",
            confidence: 0.55,
            owner: "SEO",
            evidence: [
              { label: "Cluster", value: c.label },
              { label: "Coverage", value: pct(c.coverage) },
              { label: "Authority", value: pct(c.authority) },
              { label: "Articles", value: String(c.articles) },
            ],
            trafficPotential: 0.6,
            businessValue: c.businessValue,
            deadlineDays: 30,
            now: ctx.now,
          })
        );
      }

      // 3 ─ Tools shipped with no supporting cluster.
      if (c.tools > 0 && c.articles < c.tools * MIN_ARTICLES_PER_TOOL) {
        out.push(
          buildRecommendation({
            id: `seo-cluster-thin-${c.key}`,
            agent: "seo",
            title: `Thin cluster — ${c.label} has ${c.tools} tools but ${c.articles} articles`,
            reason: `${c.label} ships ${c.tools} tools with only ${c.articles} supporting article${c.articles === 1 ? "" : "s"}. Tools capture transactional search only; without a content cluster they never rank for the informational queries that feed them.`,
            expectedImpact:
              "Brings the cluster to at least one article per tool — the minimum to compete on topic.",
            effort: "L",
            confidence: 0.6,
            owner: "Content",
            evidence: [
              { label: "Cluster", value: c.label },
              { label: "Tools", value: String(c.tools) },
              { label: "Articles", value: String(c.articles) },
            ],
            trafficPotential: 0.6,
            businessValue: c.businessValue,
            deadlineDays: 45,
            now: ctx.now,
          })
        );
      }
    }

    return out;
  },
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

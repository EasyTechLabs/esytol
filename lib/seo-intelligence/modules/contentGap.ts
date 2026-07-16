/**
 * 2 — Content Gap Engine.
 *
 * The only module that sees the *product* (registry + Learn Center) alongside search
 * data, so it finds structural gaps no single provider can: tools with no supporting
 * content, missing FAQs (no FAQPage schema), articles that dead-end, clusters big
 * enough to deserve a Collection, missing comparison content, and tools with a weak
 * related-tools mesh.
 *
 * Preserves the original ids (`content-missing-article-*`, `content-missing-faq-*`,
 * `content-missing-links-*`, `content-collection-*`, `content-deepen-*`) — this
 * module is now their single implementation; the Marketing Agent's content agent
 * delegates here.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import {
  buildRecommendation,
  businessValueForPage,
  isFinanceTool,
  trafficPotentialFromClicks,
} from "@/lib/marketing-agent/scoring";
import type { SeoContext, SeoModule } from "../types";
import { CLUSTERS, articlesInCluster, toolsInCluster } from "../clusters";

const PER_RULE_LIMIT = 5;
const COLLECTION_MIN = 3;
const MIN_RELATED_TOOLS = 3;
const COMPARISON_MIN_TOOLS = 2;

export const contentGapModule: SeoModule = {
  key: "content-gap",
  label: "Content Gap Engine",
  purpose: "Missing articles, FAQs, internal links, collections, comparisons and related tools",
  run(ctx: SeoContext): Recommendation[] {
    const out: Recommendation[] = [];
    const { tools, articles } = ctx;

    const covered = new Set<string>();
    for (const a of articles) for (const slug of a.relatedToolSlugs) covered.add(slug);

    const views = new Map<string, number>();
    for (const p of ctx.growth.analytics.data.topPages) views.set(p.page, p.views);

    // 1 ─ Tools with no supporting article.
    const uncovered = tools
      .filter((t) => !covered.has(t.slug))
      .sort((a, b) => (views.get(b.url) ?? 0) - (views.get(a.url) ?? 0))
      .slice(0, PER_RULE_LIMIT);

    for (const t of uncovered) {
      const v = views.get(t.url) ?? 0;
      const upside = Math.max(20, Math.round(v * 0.4));
      out.push(
        buildRecommendation({
          id: `content-missing-article-${t.slug}`,
          agent: "content",
          title: `Write supporting content — ${t.name}`,
          reason: `${t.name} has no Learn article linking to it. Tools without a content cluster capture only transactional search and miss the informational funnel that feeds them.`,
          expectedImpact: `A 3-article cluster (what/how/comparison) typically adds ≈ ${fmt(upside)} assisted visits/month and internal-link equity.`,
          impactClicks: upside,
          effort: "L",
          confidence: 0.6,
          owner: "Content",
          page: t.url,
          evidence: [
            { label: "Tool", value: t.name },
            { label: "Current views", value: v ? fmt(v) : "not in top pages" },
            { label: "Articles linking", value: "0" },
          ],
          trafficPotential: trafficPotentialFromClicks(upside),
          businessValue: isFinanceTool(t) ? 1 : 0.6,
          deadlineDays: 30,
          now: ctx.now,
        })
      );
    }

    // 2 ─ Articles with no FAQ → no FAQPage schema, no PAA capture.
    for (const a of articles.filter((x) => x.faqs.length === 0).slice(0, PER_RULE_LIMIT)) {
      out.push(
        buildRecommendation({
          id: `content-missing-faq-${a.slug}`,
          agent: "content",
          title: `Add an FAQ — ${a.frontmatter.title}`,
          reason: `This article has no FAQ section, so it emits no FAQPage schema and cannot win People-Also-Ask or FAQ rich results.`,
          expectedImpact:
            "FAQ schema expands the SERP footprint and lifts CTR at the same ranking.",
          effort: "S",
          confidence: 0.7,
          owner: "Content",
          page: `/learn/${a.slug}`,
          evidence: [
            { label: "Article", value: a.frontmatter.title },
            { label: "FAQs", value: "0" },
          ],
          trafficPotential: 0.4,
          businessValue: 0.5,
          deadlineDays: 14,
          now: ctx.now,
        })
      );
    }

    // 3 ─ Articles that link to no tool → the funnel dead-ends.
    for (const a of articles
      .filter((x) => x.relatedToolSlugs.length === 0)
      .slice(0, PER_RULE_LIMIT)) {
      out.push(
        buildRecommendation({
          id: `content-missing-links-${a.slug}`,
          agent: "content",
          title: `Add internal links to tools — ${a.frontmatter.title}`,
          reason: `This article links to no calculator, so readers have no path into the product and the related-tools panel stays empty.`,
          expectedImpact:
            "Converts readers into tool users and strengthens the internal-link mesh.",
          effort: "S",
          confidence: 0.75,
          owner: "Content",
          page: `/learn/${a.slug}`,
          evidence: [
            { label: "Article", value: a.frontmatter.title },
            { label: "Tool links", value: "0" },
          ],
          trafficPotential: 0.35,
          businessValue: 0.6,
          deadlineDays: 10,
          now: ctx.now,
        })
      );
    }

    // 4 ─ Clusters big enough to deserve a Collection.
    const byCategory = new Map<string, number>();
    for (const a of articles) {
      const c = a.frontmatter.category || "uncategorised";
      byCategory.set(c, (byCategory.get(c) ?? 0) + 1);
    }
    for (const [category, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
      if (count < COLLECTION_MIN) continue;
      out.push(
        buildRecommendation({
          id: `content-collection-${category}`,
          agent: "content",
          title: `Create a Collection — "${titleCase(category)}"`,
          reason: `${count} articles already form a "${category}" cluster. A Collection page turns scattered pages into a task-level entry point ("plan my ${category}") and is a pure registry query.`,
          expectedImpact:
            "Collections are decision-intent surfaces — the bridge from tool directory to platform, and strong GEO/AI-citation targets.",
          effort: "M",
          confidence: 0.6,
          owner: "Growth",
          evidence: [
            { label: "Cluster", value: titleCase(category) },
            { label: "Articles", value: String(count) },
          ],
          trafficPotential: 0.55,
          businessValue: category.includes("tax") || category.includes("retire") ? 0.9 : 0.6,
          deadlineDays: 30,
          now: ctx.now,
        })
      );
    }

    // 5 ─ High-traffic articles worth deepening into decision content.
    const hot = ctx.growth.analytics.data.topPages
      .filter((p) => p.page.startsWith("/learn/"))
      .sort((a, b) => b.views - a.views)
      .slice(0, 3);

    for (const p of hot) {
      const upside = Math.round(p.views * 0.25);
      out.push(
        buildRecommendation({
          id: `content-deepen-${p.page}`,
          agent: "content",
          title: `Deepen into decision content — ${p.page}`,
          reason: `${fmt(p.views)} views makes this one of the strongest articles. Explainer content is the most AI-exposed format; converting it toward comparison/decision ("which is right for you") is what survives AI Overviews and feeds monetisation.`,
          expectedImpact: `≈ +${fmt(Math.max(1, upside))} durable visits/month and a monetisable decision path.`,
          impactClicks: Math.max(1, upside),
          effort: "M",
          confidence: 0.6,
          owner: "Content",
          page: p.page,
          evidence: [
            { label: "Views", value: fmt(p.views) },
            { label: "Bounce", value: `${(p.bounceRate * 100).toFixed(1)}%` },
          ],
          trafficPotential: trafficPotentialFromClicks(Math.max(1, upside)),
          businessValue: businessValueForPage(p.page, ctx.tools),
          deadlineDays: 21,
          now: ctx.now,
        })
      );
    }

    // 6 ─ NEW: missing comparison content. Comparisons are the AI-resistant,
    //     decision-intent format that feeds monetisation.
    for (const def of CLUSTERS) {
      const clusterTools = toolsInCluster(tools, def);
      if (clusterTools.length < COMPARISON_MIN_TOOLS) continue;
      const clusterArticles = articlesInCluster(articles, def);
      const hasComparison = clusterArticles.some((a) =>
        /\bvs\b|versus|compare|which is better|or /i.test(a.frontmatter.title)
      );
      if (hasComparison) continue;

      const [a, b] = clusterTools;
      out.push(
        buildRecommendation({
          id: `content-missing-comparison-${def.key}`,
          agent: "content",
          title: `Write a comparison — ${def.label} ("${a.name} vs ${b.name}")`,
          reason: `The ${def.label} cluster has ${clusterTools.length} tools but no comparison article. Comparison content captures decision intent, survives AI Overviews better than explainers, and is where affiliate paths live.`,
          expectedImpact:
            "Captures high-intent 'X vs Y' search and creates a monetisable decision surface.",
          effort: "M",
          confidence: 0.6,
          owner: "Content",
          evidence: [
            { label: "Cluster", value: def.label },
            { label: "Tools", value: String(clusterTools.length) },
            { label: "Comparison articles", value: "0" },
          ],
          trafficPotential: 0.6,
          businessValue: def.businessValue,
          deadlineDays: 30,
          now: ctx.now,
        })
      );
    }

    // 7 ─ NEW: tools with a weak related-tools mesh (lost internal-link equity).
    const weakMesh = tools
      .filter((t) => (t.relatedTools?.length ?? 0) < MIN_RELATED_TOOLS)
      .slice(0, PER_RULE_LIMIT);

    for (const t of weakMesh) {
      out.push(
        buildRecommendation({
          id: `content-missing-relatedtools-${t.slug}`,
          agent: "content",
          title: `Strengthen related tools — ${t.name}`,
          reason: `Only ${t.relatedTools?.length ?? 0} related tools are configured (target ≥ ${MIN_RELATED_TOOLS}). The related-tools panel is a primary internal-link surface; a thin mesh wastes authority and blocks cross-cluster routing.`,
          expectedImpact:
            "Distributes authority and routes users deeper — the everyday→finance bridge depends on this mesh.",
          effort: "S",
          confidence: 0.7,
          owner: "SEO",
          page: t.url,
          evidence: [
            { label: "Tool", value: t.name },
            { label: "Related tools", value: String(t.relatedTools?.length ?? 0) },
          ],
          trafficPotential: 0.35,
          businessValue: isFinanceTool(t) ? 0.9 : 0.5,
          deadlineDays: 14,
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
function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

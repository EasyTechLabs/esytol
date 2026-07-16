/**
 * 3 — Internal Linking Engine.
 *
 * Builds the site's internal link graph from article bodies (`/tools/…` and
 * `/learn/…` links) plus the registry's `relatedTools`, then finds where authority
 * fails to flow:
 *
 *   • **Striking-distance pages with thin inbound links** — internal links are the
 *     cheapest lever to move page 2 → page 1, and this names the exact source pages.
 *   • **Orphan tools** — live tools no article links to.
 *   • **Broken topical clusters** — articles in the same cluster that don't cross-link,
 *     so the cluster never accrues topical authority.
 *
 * The graph is computed here from `article.body` rather than extending `lib/learn`,
 * so the Learn Center keeps its narrow contract.
 */

import type { Recommendation } from "@/lib/marketing-agent/types";
import {
  buildRecommendation,
  businessValueForPage,
  isFinanceTool,
} from "@/lib/marketing-agent/scoring";
import type { InternalLinkSuggestion, SeoContext, SeoModule } from "../types";
import { CLUSTERS, articlesInCluster, clusterForPage } from "../clusters";

const MIN_INBOUND = 2;
const PER_RULE_LIMIT = 5;

/** All internal links found in an article body. */
export function outboundLinks(body: string): { tools: string[]; articles: string[] } {
  const tools = [...body.matchAll(/\/tools\/([a-z0-9-]+)/g)].map((m) => m[1]);
  const articles = [...body.matchAll(/\/learn\/([a-z0-9-]+)/g)].map((m) => m[1]);
  return { tools: unique(tools), articles: unique(articles) };
}

/** Inbound internal-link counts, keyed by page path. */
export function inboundGraph(ctx: SeoContext): Map<string, number> {
  const inbound = new Map<string, number>();
  const bump = (page: string) => inbound.set(page, (inbound.get(page) ?? 0) + 1);

  for (const a of ctx.articles) {
    const { tools, articles } = outboundLinks(a.body);
    for (const slug of tools) bump(`/tools/${slug}`);
    for (const slug of articles) if (slug !== a.slug) bump(`/learn/${slug}`);
  }
  // The registry's related-tools panel is a real internal-link surface.
  for (const t of ctx.tools) for (const slug of t.relatedTools ?? []) bump(`/tools/${slug}`);

  return inbound;
}

/** Concrete "link from X to Y" suggestions. */
export function linkSuggestions(ctx: SeoContext): InternalLinkSuggestion[] {
  const inbound = inboundGraph(ctx);
  const out: InternalLinkSuggestion[] = [];
  const striking = ctx.growth.searchConsole.data.topPages.filter(
    (p) => p.position > 10 && p.position <= 20
  );

  for (const p of striking) {
    const current = inbound.get(p.page) ?? 0;
    if (current >= MIN_INBOUND) continue;

    const def = clusterForPage(p.page, ctx.tools, ctx.articles);
    const sources = def
      ? articlesInCluster(ctx.articles, def).filter(
          (a) => !outboundLinks(a.body).tools.includes(p.page.replace("/tools/", ""))
        )
      : [];

    for (const src of sources.slice(0, 2)) {
      out.push({
        from: `/learn/${src.slug}`,
        to: p.page,
        reason: `${p.page} is #${p.position.toFixed(1)} (striking distance) with only ${current} inbound internal link${current === 1 ? "" : "s"}. Linking from a same-cluster article is the cheapest way to move it.`,
        cluster: def?.label ?? "—",
        currentInbound: current,
      });
    }
  }

  return out;
}

export const internalLinksModule: SeoModule = {
  key: "internal-links",
  label: "Internal Linking Engine",
  purpose: "Authority flow: thin inbound links, orphan tools, and clusters that don't cross-link",
  run(ctx: SeoContext): Recommendation[] {
    const out: Recommendation[] = [];
    const inbound = inboundGraph(ctx);

    // 1 ─ Striking-distance pages starved of internal links.
    const suggestions = linkSuggestions(ctx);
    const byTarget = new Map<string, InternalLinkSuggestion[]>();
    for (const s of suggestions) {
      byTarget.set(s.to, [...(byTarget.get(s.to) ?? []), s]);
    }

    for (const [target, list] of [...byTarget.entries()].slice(0, PER_RULE_LIMIT)) {
      const page = ctx.growth.searchConsole.data.topPages.find((p) => p.page === target);
      const upside = page ? Math.max(1, Math.round(page.impressions * 0.01)) : 1;
      out.push(
        buildRecommendation({
          id: `seo-link-${target}`,
          agent: "seo",
          title: `Add internal links to ${target}`,
          reason: `${target} ranks #${page?.position.toFixed(1) ?? "?"} with only ${list[0].currentInbound} inbound internal link${list[0].currentInbound === 1 ? "" : "s"}. Authority isn't reaching a page that is one push from page 1.`,
          expectedImpact: `Link from ${list.map((l) => l.from).join(" and ")} — ≈ +${fmt(upside)} clicks/month if it reaches the top 10.`,
          impactClicks: upside,
          effort: "S",
          confidence: 0.6,
          owner: "SEO",
          page: target,
          evidence: [
            { label: "Inbound links", value: String(list[0].currentInbound) },
            { label: "Cluster", value: list[0].cluster },
            { label: "Link from", value: list.map((l) => l.from).join(", ") },
          ],
          trafficPotential: 0.55,
          businessValue: businessValueForPage(target, ctx.tools),
          deadlineDays: 7,
          now: ctx.now,
        })
      );
    }

    // 2 ─ Orphan tools: live, but nothing links to them.
    const orphans = ctx.tools
      .filter((t) => (inbound.get(t.url) ?? 0) === 0)
      .slice(0, PER_RULE_LIMIT);
    for (const t of orphans) {
      out.push(
        buildRecommendation({
          id: `seo-orphan-${t.slug}`,
          agent: "seo",
          title: `Orphan tool — nothing links to ${t.name}`,
          reason: `No article or related-tools panel links to ${t.url}. Orphan pages receive no internal authority and are crawled least.`,
          expectedImpact: "Adding inbound links puts the page into the site's authority flow.",
          effort: "S",
          confidence: 0.75,
          owner: "SEO",
          page: t.url,
          evidence: [
            { label: "Tool", value: t.name },
            { label: "Inbound links", value: "0" },
          ],
          trafficPotential: 0.4,
          businessValue: isFinanceTool(t) ? 0.9 : 0.5,
          deadlineDays: 10,
          now: ctx.now,
        })
      );
    }

    // 3 ─ Broken topical clusters: articles that never cross-link.
    for (const def of CLUSTERS) {
      const arts = articlesInCluster(ctx.articles, def);
      if (arts.length < 2) continue;
      const crossLinked = arts.filter((a) => {
        const links = outboundLinks(a.body).articles;
        return arts.some((other) => other.slug !== a.slug && links.includes(other.slug));
      });
      if (crossLinked.length >= Math.ceil(arts.length / 2)) continue;

      out.push(
        buildRecommendation({
          id: `seo-cluster-links-${def.key}`,
          agent: "seo",
          title: `Cluster doesn't cross-link — ${def.label}`,
          reason: `${arts.length} ${def.label} articles exist but only ${crossLinked.length} link to a sibling. A cluster that doesn't interlink never accrues topical authority — Google reads them as unrelated pages.`,
          expectedImpact: "Cross-linking the cluster compounds authority across every page in it.",
          effort: "S",
          confidence: 0.65,
          owner: "SEO",
          evidence: [
            { label: "Cluster", value: def.label },
            { label: "Articles", value: String(arts.length) },
            { label: "Cross-linked", value: String(crossLinked.length) },
          ],
          trafficPotential: 0.5,
          businessValue: def.businessValue,
          deadlineDays: 14,
          now: ctx.now,
        })
      );
    }

    return out;
  },
};

function unique(a: string[]): string[] {
  return [...new Set(a)];
}
function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

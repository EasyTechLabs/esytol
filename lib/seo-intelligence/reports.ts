/**
 * SEO reports — daily, weekly, monthly.
 *
 * Three cadences because they answer three different questions, and mixing them is
 * how dashboards become noise:
 *
 *   **Daily**   — what changed and what do I do today? (movement + quick wins)
 *   **Weekly**  — is the machine working? (cluster health, SERP, links, CTR tables)
 *   **Monthly** — are we building the right thing? (coverage vs authority, strategy)
 *
 * Reports are *views* over the roadmap and module data. They compute no rules of
 * their own — every number here traces back to a module.
 */

import type {
  ClusterHealth,
  CtrSuggestion,
  DailySeoReport,
  InternalLinkSuggestion,
  KeywordOpportunity,
  MonthlySeoReport,
  SeoContext,
  SeoMetric,
  SeoRoadmap,
  SerpOpportunity,
  WeeklySeoReport,
} from "./types";

interface ReportInput {
  ctx: SeoContext;
  roadmap: SeoRoadmap;
  keywords: KeywordOpportunity[];
  clusters: ClusterHealth[];
  serp: SerpOpportunity[];
  internalLinks: InternalLinkSuggestion[];
  ctr: CtrSuggestion[];
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function seoKpis(ctx: SeoContext, roadmap: SeoRoadmap): SeoMetric[] {
  const gsc = ctx.growth.searchConsole.data;
  return [
    { label: "Clicks (28d)", value: fmt(gsc.totals.clicks) },
    { label: "Impressions (28d)", value: fmt(gsc.totals.impressions) },
    { label: "Avg CTR", value: pct(gsc.totals.ctr) },
    { label: "Avg position", value: gsc.totals.position.toFixed(1), lowerIsBetter: true },
    { label: "Click upside identified", value: `+${fmt(roadmap.totalClickUpside)}/mo` },
    { label: "Open SEO tasks", value: String(roadmap.tasks.length) },
  ];
}

// ── Daily ─────────────────────────────────────────────────────────────────────

export function dailySeoReport(input: ReportInput): DailySeoReport {
  const { ctx, roadmap, keywords } = input;

  const gaining = keywords.filter((k) => k.lever === "compound").slice(0, 5);
  const losing = keywords.filter((k) => k.lever === "defend").slice(0, 5);

  return {
    date: ctx.now.toISOString().slice(0, 10),
    headline: dailyHeadline(roadmap, gaining.length, losing.length),
    kpis: seoKpis(ctx, roadmap),
    topOpportunities: roadmap.topOpportunities.slice(0, 5),
    criticalIssues: roadmap.criticalIssues.slice(0, 5),
    quickWins: roadmap.quickWins.slice(0, 5),
    keywordMovement: { gaining, losing },
  };
}

function dailyHeadline(roadmap: SeoRoadmap, gaining: number, losing: number): string {
  if (roadmap.criticalIssues.length > 0) {
    const top = roadmap.criticalIssues[0];
    return `${roadmap.criticalIssues.length} critical SEO issue${roadmap.criticalIssues.length === 1 ? "" : "s"} — start with "${top.title}".`;
  }
  if (roadmap.quickWins.length > 0) {
    const upside = roadmap.quickWins.reduce((s, q) => s + (q.impactClicks ?? 0), 0);
    return `No critical issues. ${roadmap.quickWins.length} quick win${roadmap.quickWins.length === 1 ? "" : "s"} on the table worth ≈ +${fmt(upside)} clicks/month.`;
  }
  if (losing > gaining)
    return `${losing} keywords slipping vs ${gaining} climbing — defend before expanding.`;
  if (roadmap.tasks.length === 0) return "No SEO opportunities detected in the current data.";
  return `${roadmap.tasks.length} SEO tasks queued; the biggest is "${roadmap.tasks[0].title}".`;
}

// ── Weekly ────────────────────────────────────────────────────────────────────

export function weeklySeoReport(input: ReportInput): WeeklySeoReport {
  const { ctx, roadmap, clusters, serp, internalLinks, ctr } = input;

  return {
    period: periodLabel(ctx.now, 7),
    kpis: seoKpis(ctx, roadmap),
    clusterHealth: clusters,
    serpOpportunities: serp.slice(0, 15),
    internalLinks: internalLinks.slice(0, 15),
    ctrSuggestions: ctr.slice(0, 15),
    insights: weeklyInsights(input),
  };
}

function weeklyInsights({ roadmap, clusters, serp, internalLinks, ctr }: ReportInput): string[] {
  const out: string[] = [];

  const ctrUpside = ctr.reduce((s, c) => s + c.potentialClickGain, 0);
  if (ctrUpside > 0) {
    out.push(
      `≈ ${fmt(ctrUpside)} clicks/month are available from CTR alone — page-1 rankings we already hold but under-monetise. This is the cheapest traffic on the site: no new content, no new links.`
    );
  }

  const strongContentWeakAuthority = clusters.filter(
    (c) => c.coverage >= 0.7 && c.authority < 0.35
  );
  if (strongContentWeakAuthority.length > 0) {
    out.push(
      `${strongContentWeakAuthority.map((c) => c.label).join(", ")} ${strongContentWeakAuthority.length === 1 ? "has" : "have"} the content but not the rankings. Writing more here is wasted spend — the fix is internal links and snippets.`
    );
  }

  const incompleteHighValue = clusters.filter((c) => c.businessValue >= 0.9 && c.coverage < 0.7);
  if (incompleteHighValue.length > 0) {
    out.push(
      `Highest-value clusters still incomplete: ${incompleteHighValue.map((c) => `${c.label} (${Math.round(c.coverage * 100)}%)`).join(", ")}. Depth before breadth — finishing these lifts every page inside them.`
    );
  }

  if (internalLinks.length > 0) {
    out.push(
      `${internalLinks.length} internal links would feed striking-distance pages that currently receive almost no authority. Effort S, and it needs no new content.`
    );
  }

  const comparisons = serp.filter((s) => s.kind === "comparison").length;
  if (comparisons > 0) {
    out.push(
      `${comparisons} comparison-intent queries are surfacing. Comparison content is the most AI-resistant format we can publish and the closest to monetisation — it should outrank explainers in the queue.`
    );
  }

  if (roadmap.byEffort.S > 0 && roadmap.byEffort.L > 0) {
    out.push(
      `Roadmap shape: ${roadmap.byEffort.S} small / ${roadmap.byEffort.M} medium / ${roadmap.byEffort.L} large. Clear the S column first — it buys the compounding time the L column needs.`
    );
  }

  return out;
}

// ── Monthly ───────────────────────────────────────────────────────────────────

export function monthlySeoReport(input: ReportInput): MonthlySeoReport {
  const { ctx, roadmap, clusters } = input;

  const biggestGaps = clusters
    .filter((c) => c.missingTopics.length > 0)
    .sort(
      (a, b) => b.businessValue - a.businessValue || b.missingTopics.length - a.missingTopics.length
    )
    .slice(0, 5)
    .map(
      (c) =>
        `${c.label}: missing ${c.missingTopics.join(", ")} (${Math.round(c.coverage * 100)}% coverage, ${Math.round(c.authority * 100)}% authority)`
    );

  const roadmapSummary = [
    `${roadmap.tasks.length} ranked tasks — ${roadmap.criticalIssues.length} critical, ${roadmap.quickWins.length} quick wins, ${roadmap.longTermWork.length} long-term.`,
    `Quantified upside across the roadmap: ≈ +${fmt(roadmap.totalClickUpside)} clicks/month.`,
    `By module — ${roadmap.byModule.map((m) => `${m.label}: ${m.count}`).join(" · ")}.`,
  ];

  return {
    period: periodLabel(ctx.now, 30),
    clusterHealth: clusters,
    longTermWork: roadmap.longTermWork.slice(0, 10),
    roadmapSummary,
    strategicNotes: strategicNotes(input),
    biggestGaps,
  };
}

function strategicNotes({ ctx, clusters, roadmap }: ReportInput): string[] {
  const out: string[] = [];

  const finance = clusters.filter((c) => c.businessValue >= 0.9);
  const other = clusters.filter((c) => c.businessValue < 0.9);
  const financeCoverage = avg(finance.map((c) => c.coverage));
  const otherCoverage = avg(other.map((c) => c.coverage));

  out.push(
    `Finance clusters average ${Math.round(financeCoverage * 100)}% coverage vs ${Math.round(otherCoverage * 100)}% elsewhere. Finance traffic is the transaction-adjacent traffic (affiliate/B2B), so this ratio is the one that decides revenue — not total pageviews.`
  );

  const thin = clusters.filter((c) => c.tools > 0 && c.articles < c.tools);
  if (thin.length > 0) {
    out.push(
      `${thin.map((c) => c.label).join(", ")} ship tools without a supporting content cluster. Shipping tools faster than content compounds a structural weakness: the tools capture only transactional search and nothing feeds them.`
    );
  }

  const empty = clusters.filter((c) => c.tools === 0 && c.articles === 0);
  if (empty.length > 0) {
    out.push(
      `${empty.map((c) => c.label).join(", ")} ${empty.length === 1 ? "is" : "are"} defined but empty. Opening a new cluster before finishing a high-value one is the most expensive mistake available here — breadth without depth ranks for nothing.`
    );
  }

  const upsideVsClicks = ctx.growth.searchConsole.data.totals.clicks;
  if (upsideVsClicks > 0) {
    const ratio = roadmap.totalClickUpside / upsideVsClicks;
    out.push(
      `Identified upside is ≈ ${Math.round(ratio * 100)}% of current clicks — i.e. the roadmap, fully executed, is worth roughly ${ratio >= 1 ? "more than a doubling" : `a ${Math.round(ratio * 100)}% lift`} of organic search, before any new tool ships.`
    );
  }

  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function periodLabel(now: Date, days: number): string {
  const from = new Date(now.getTime() - days * 86_400_000);
  return `${from.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`;
}
function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export type { ReportInput };

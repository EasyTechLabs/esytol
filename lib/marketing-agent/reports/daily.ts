/**
 * Founder Daily Report.
 *
 * The morning briefing: what happened, what changed, what needs attention, and the
 * ranked list of what to do today — assembled so the founder never has to open
 * GA, Search Console, Clarity, GitHub or Vercel individually.
 */

import type {
  AgentContext,
  AgentRun,
  DailyReport,
  Metric,
  Recommendation,
  ReportSection,
  TrendPoint,
} from "../types";
import { pickTopPriorities } from "../scoring";

const TOP_PRIORITIES = 10;
/** Cap per agent so the briefing spans the business instead of one agent's list. */
const MAX_PER_AGENT = 2;

export function buildDailyReport(
  ctx: AgentContext,
  runs: AgentRun[],
  ranked: Recommendation[]
): DailyReport {
  const { growth, now } = ctx;
  const gsc = growth.searchConsole.data;
  const ga = growth.analytics.data;
  const clarity = growth.clarity.data;

  const yesterday: Metric[] = [
    {
      label: "Clicks",
      value: fmt(gsc.totals.clicks),
      deltaPct: trendDelta(gsc.clicksTrend),
      trend: gsc.clicksTrend,
    },
    {
      label: "Impressions",
      value: fmt(gsc.totals.impressions),
      deltaPct: trendDelta(gsc.impressionsTrend),
      trend: gsc.impressionsTrend,
    },
    { label: "Avg CTR", value: pct(gsc.totals.ctr) },
    { label: "Avg position", value: gsc.totals.position.toFixed(1), lowerIsBetter: true },
    {
      label: "Users",
      value: fmt(ga.totals.users),
      deltaPct: trendDelta(ga.usersTrend),
      trend: ga.usersTrend,
    },
    { label: "Engagement rate", value: pct(ga.totals.engagementRate) },
  ];

  // ── Wins: what's going right (worth compounding) ──
  const wins: string[] = [];
  const gaining = gsc.topPages
    .filter((p) => p.positionDelta <= -1)
    .sort((a, b) => a.positionDelta - b.positionDelta);
  if (gaining.length) {
    wins.push(
      `${gaining.length} page${gaining.length > 1 ? "s" : ""} gained rankings — best: ${gaining[0].page} (▲ ${Math.abs(gaining[0].positionDelta).toFixed(1)} to #${gaining[0].position.toFixed(1)}).`
    );
  }
  const gainingQueries = gsc.topQueries.filter((q) => q.positionDelta <= -1.5);
  if (gainingQueries.length) {
    wins.push(
      `${gainingQueries.length} keyword${gainingQueries.length > 1 ? "s" : ""} improving — top: "${gainingQueries[0].query}".`
    );
  }
  const clicksDelta = trendDelta(gsc.clicksTrend);
  if (clicksDelta !== undefined && clicksDelta > 0) {
    wins.push(`Clicks trending up ${clicksDelta.toFixed(1)}% across the period.`);
  }
  const topTool = ga.topPages
    .filter((p) => p.page.startsWith("/tools/"))
    .sort((a, b) => b.views - a.views)[0];
  if (topTool) wins.push(`Most-used tool: ${topTool.page} (${fmt(topTool.views)} views).`);
  if (growth.vercel.data.latest.state.toUpperCase() === "READY") {
    wins.push(`Production is healthy (${growth.vercel.data.latest.state}).`);
  }
  if (!wins.length) wins.push("No standout wins in this period.");

  // ── Problems: what needs attention ──
  const problems: string[] = [];
  const losing = gsc.topPages
    .filter((p) => p.positionDelta >= 1)
    .sort((a, b) => b.positionDelta - a.positionDelta);
  if (losing.length) {
    problems.push(
      `${losing.length} page${losing.length > 1 ? "s" : ""} lost rankings — worst: ${losing[0].page} (▼ ${losing[0].positionDelta.toFixed(1)}).`
    );
  }
  const critical = ranked.filter((r) => r.priority === "critical");
  if (critical.length)
    problems.push(
      `${critical.length} critical recommendation${critical.length > 1 ? "s" : ""} open.`
    );
  if (clarity.rageClicks > 0)
    problems.push(
      `${fmt(clarity.rageClicks)} rage clicks and ${fmt(clarity.deadClicks)} dead clicks detected.`
    );
  if (ga.totals.users > 0 && ga.totals.returningUsers / ga.totals.users < 0.3) {
    problems.push(
      `Only ${pct(ga.totals.returningUsers / ga.totals.users)} of users return — no retention layer exists.`
    );
  }
  if (gsc.indexCoverage.errors > 0)
    problems.push(`${gsc.indexCoverage.errors} index coverage errors.`);
  if (!problems.length) problems.push("No blocking problems detected.");

  // ── Per-agent sections ──
  const sections: ReportSection[] = runs.map((run) => ({
    key: run.key,
    label: run.label,
    metrics: metricsFor(run.key, ctx),
    recommendations: run.recommendations.slice(0, 3),
  }));

  const topPriorities = pickTopPriorities(ranked, TOP_PRIORITIES, MAX_PER_AGENT);

  // ── Headline: the single most important sentence of the day ──
  const top = topPriorities[0];
  const headline = top
    ? `${top.priority.toUpperCase()} — ${top.title}. ${top.expectedImpact}`
    : "No recommendations — everything within thresholds.";

  const futureWork = [
    "Competitor Agent: wire a SERP signal source (architecture ready, no scraping yet).",
    "Revenue Agent: connect affiliate/AdSense to unlock revenue analysis.",
    "Entry/exit page analysis: needs a GA4 landing-page dimension pull.",
    "Query-level position deltas: live Search Console needs a second-period query.",
  ];

  return {
    date: iso(now),
    generatedAt: now.toISOString(),
    noneLive: growth.noneLive,
    headline,
    yesterday,
    wins,
    problems,
    sections,
    topPriorities,
    weeklyTrend: toTrend(gsc.clicksTrend.slice(-7), "D"),
    monthlyTrend: toTrend(ga.usersTrend, "W"),
    futureWork,
  };
}

/** The headline numbers each agent is accountable for. */
function metricsFor(key: AgentRun["key"], ctx: AgentContext): Metric[] {
  const gsc = ctx.growth.searchConsole.data;
  const ga = ctx.growth.analytics.data;
  const c = ctx.growth.clarity.data;
  const v = ctx.growth.vercel.data;

  switch (key) {
    case "seo":
      return [
        { label: "Clicks", value: fmt(gsc.totals.clicks), trend: gsc.clicksTrend },
        { label: "CTR", value: pct(gsc.totals.ctr) },
        { label: "Avg position", value: gsc.totals.position.toFixed(1), lowerIsBetter: true },
        { label: "Indexed", value: fmt(gsc.indexCoverage.indexed) },
      ];
    case "traffic":
      return [
        { label: "Users", value: fmt(ga.totals.users), trend: ga.usersTrend },
        { label: "Sessions", value: fmt(ga.totals.sessions) },
        { label: "Engagement", value: pct(ga.totals.engagementRate) },
        { label: "Returning", value: fmt(ga.totals.returningUsers) },
      ];
    case "ux":
      return [
        { label: "Rage clicks", value: fmt(c.rageClicks) },
        { label: "Dead clicks", value: fmt(c.deadClicks) },
        { label: "Quick-backs", value: fmt(c.quickBacks) },
        { label: "Avg scroll", value: pct(c.avgScrollDepth) },
      ];
    case "engineering":
      return [
        { label: "Deployment", value: v.latest.state },
        { label: "Builds tracked", value: String(v.builds.length) },
        {
          label: "CWV good",
          value: `${v.performance.filter((m) => m.rating === "good").length}/${v.performance.length}`,
        },
      ];
    case "content":
      return [
        { label: "Articles", value: String(ctx.articles.length) },
        { label: "Tools", value: String(ctx.tools.length) },
        {
          label: "Articles w/ FAQ",
          value: String(ctx.articles.filter((a) => a.faqs.length > 0).length),
        },
      ];
    case "competitor":
      return [{ label: "Tracked", value: "7 (planned)" }];
    case "revenue":
      return [{ label: "Revenue sources", value: "0 configured" }];
    default:
      return [];
  }
}

// ── helpers ──
function toTrend(values: number[], prefix: string): TrendPoint[] {
  return values.map((v, i) => ({ label: `${prefix}${i + 1}`, value: v }));
}
export function trendDelta(arr: number[]): number | undefined {
  if (arr.length < 2) return undefined;
  const first = arr[0] || 1;
  return ((arr[arr.length - 1] - first) / first) * 100;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

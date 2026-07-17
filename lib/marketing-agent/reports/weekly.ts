/**
 * Weekly Executive Report.
 *
 * Where the daily report is operational ("do these today"), the weekly report is
 * strategic: trends, progress, and the two lists a founder actually decides on —
 * biggest risks and biggest opportunities.
 */

import type { AgentContext, Recommendation, WeeklyReport, Metric } from "../types";
import { trendDelta } from "./daily";

const TOP_RECOMMENDATIONS = 8;

export function buildWeeklyReport(ctx: AgentContext, ranked: Recommendation[]): WeeklyReport {
  const { growth, now } = ctx;
  const gsc = growth.searchConsole.data;
  const ga = growth.analytics.data;
  const c = growth.clarity.data;

  const kpis: Metric[] = [
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
    { label: "Avg position", value: gsc.totals.position.toFixed(1), lowerIsBetter: true },
    {
      label: "Users",
      value: fmt(ga.totals.users),
      deltaPct: trendDelta(ga.usersTrend),
      trend: ga.usersTrend,
    },
    { label: "Engagement", value: pct(ga.totals.engagementRate) },
    { label: "Avg scroll depth", value: pct(c.avgScrollDepth) },
  ];

  const graphs = [
    { label: "Clicks", series: gsc.clicksTrend },
    { label: "Impressions", series: gsc.impressionsTrend },
    { label: "Users", series: ga.usersTrend },
  ];

  // ── Insights: what the numbers mean ──
  const insights: string[] = [];
  const organic = ga.sources.find((s) => /organic/i.test(s.label));
  const totalSessions = ga.sources.reduce((s, x) => s + x.value, 0);
  if (organic && totalSessions > 0) {
    insights.push(
      `${pct(organic.value / totalSessions)} of sessions are organic search — the growth engine and the single largest risk.`
    );
  }
  const strikers = gsc.topPages.filter((p) => p.position > 10 && p.position <= 20);
  if (strikers.length) {
    insights.push(
      `${strikers.length} page${strikers.length > 1 ? "s are" : " is"} in striking distance (position 11–20) — the cheapest available ranking wins.`
    );
  }
  const lowCtr = gsc.topPages.filter((p) => p.position <= 10 && p.ctr < 0.02);
  if (lowCtr.length) {
    insights.push(
      `${lowCtr.length} page-1 page${lowCtr.length > 1 ? "s" : ""} under-click at <2% CTR — title/meta is the lever, not ranking.`
    );
  }
  if (ga.totals.users > 0) {
    insights.push(
      `Returning users are ${pct(ga.totals.returningUsers / ga.totals.users)} — retention is structural, not tactical.`
    );
  }
  if (ga.conversions.length === 0) {
    insights.push(
      "No conversions are tracked — revenue and value per session are currently unmeasurable."
    );
  }

  // ── Progress ──
  const progress: string[] = [
    `${ctx.tools.length} live tools · ${ctx.articles.length} Learn articles.`,
    `${fmt(gsc.indexCoverage.indexed)} pages indexed, ${gsc.indexCoverage.errors} coverage error${gsc.indexCoverage.errors === 1 ? "" : "s"}.`,
    `Production: ${growth.vercel.data.latest.state} · ${growth.vercel.data.performance.filter((m) => m.rating === "good").length}/${growth.vercel.data.performance.length} Core Web Vitals in the good band.`,
    `${ranked.length} open recommendations across ${new Set(ranked.map((r) => r.agent)).size} agents.`,
  ];

  // ── Risks: ranked by what could actually hurt ──
  const risks: string[] = [];
  const criticals = ranked.filter((r) => r.priority === "critical");
  if (criticals.length)
    risks.push(
      `${criticals.length} critical item${criticals.length > 1 ? "s" : ""} open — top: ${criticals[0].title}.`
    );
  if (organic && totalSessions > 0 && organic.value / totalSessions >= 0.55) {
    risks.push(
      "Single-channel dependence on Google — AI Overviews are compressing clicks industry-wide."
    );
  }
  if (ga.conversions.length === 0) risks.push("Zero monetisation configured — no revenue runway.");
  if (ga.totals.users > 0 && ga.totals.returningUsers / ga.totals.users < 0.3) {
    risks.push("No retention layer — every visit is a one-shot, anonymous session.");
  }
  const losingPages = gsc.topPages.filter((p) => p.positionDelta >= 1);
  if (losingPages.length)
    risks.push(`${losingPages.length} page${losingPages.length > 1 ? "s" : ""} losing rankings.`);
  if (growth.noneLive)
    risks.push(
      "No analytics provider is live — search and traffic figures are absent, not estimated."
    );

  // ── Opportunities: the ranked upside, in money-shaped language ──
  const opportunities: string[] = [];
  const withImpact = ranked.filter((r) => (r.impactClicks ?? 0) > 0);
  const totalUpside = withImpact.reduce((s, r) => s + (r.impactClicks ?? 0), 0);
  if (totalUpside > 0) {
    opportunities.push(
      `≈ ${fmt(totalUpside)} clicks/month of identified upside across ${withImpact.length} recommendations.`
    );
  }
  for (const r of ranked.slice(0, 3)) {
    opportunities.push(`${r.title} — ${r.expectedImpact} (score ${r.score}, ${r.effort} effort).`);
  }
  if (strikers.length)
    opportunities.push(`Striking-distance pages are the fastest SEO wins available this week.`);

  const providerStatus = (
    [
      ["Search Console", growth.searchConsole],
      ["Analytics", growth.analytics],
      ["Clarity", growth.clarity],
    ] as const
  ).map(([label, p]) =>
    p.status === "live"
      ? `${label}: live`
      : `${label}: waiting for provider access (${p.status}${p.note ? ` — ${p.note}` : ""})`
  );

  return {
    period: `${iso(new Date(now.getTime() - 6 * 86_400_000))} → ${iso(now)}`,
    generatedAt: now.toISOString(),
    noneLive: growth.noneLive,
    providerStatus,
    kpis,
    graphs,
    insights,
    recommendations: ranked.slice(0, TOP_RECOMMENDATIONS),
    progress,
    biggestRisks: risks.length ? risks : ["No material risks detected."],
    biggestOpportunities: opportunities.length
      ? opportunities
      : ["No quantified opportunities this period."],
  };
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

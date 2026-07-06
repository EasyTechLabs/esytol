/**
 * Insight engine — turns raw provider metrics into ranked, actionable highlights.
 * Pure and deterministic: given the same inputs it always returns the same
 * insights, so it is fully unit-testable and independent of any provider.
 */

import type { SearchConsoleData, AnalyticsData, ClarityData, Insight, InsightItem } from "./types";
import { formatFull, formatPercent } from "./format";

const HIGH_IMPRESSIONS = 3000;
const LOW_CTR = 0.02;
const HIGH_VIEWS = 400;
const HIGH_BOUNCE = 0.6;
const RANK_MOVE = 1.0;
const MAX_ITEMS = 6;

export function computeInsights(
  gsc: SearchConsoleData,
  ga: AnalyticsData,
  clarity: ClarityData
): Insight[] {
  const insights: Insight[] = [];

  // 1. High impressions + low CTR → title/meta optimisation opportunity.
  const lowCtr = gsc.topPages
    .filter((p) => p.impressions >= HIGH_IMPRESSIONS && p.ctr < LOW_CTR)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_ITEMS)
    .map((p): InsightItem => ({
      label: p.page,
      detail: `${formatFull(p.impressions)} impressions · ${formatPercent(p.ctr)} CTR · pos ${p.position}`,
    }));
  if (lowCtr.length) {
    insights.push({
      id: "high-impressions-low-ctr",
      severity: "opportunity",
      title: "High impressions, low CTR",
      description:
        "These pages are seen often but rarely clicked. Rewrite the title and meta description to lift click-through.",
      items: lowCtr,
    });
  }

  // 2. High traffic + high bounce → UX / intent-match issue.
  const highBounce = ga.topPages
    .filter((p) => p.views >= HIGH_VIEWS && p.bounceRate >= HIGH_BOUNCE)
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_ITEMS)
    .map((p): InsightItem => ({
      label: p.page,
      detail: `${formatFull(p.views)} views · ${formatPercent(p.bounceRate)} bounce`,
    }));
  if (highBounce.length) {
    insights.push({
      id: "high-traffic-high-bounce",
      severity: "warning",
      title: "High traffic, high bounce",
      description:
        "Visitors arrive but leave quickly. Check page intent match, above-the-fold clarity, and load speed.",
      items: highBounce,
    });
  }

  // 3. Pages losing rankings.
  const losing = gsc.topPages
    .filter((p) => p.positionDelta >= RANK_MOVE)
    .sort((a, b) => b.positionDelta - a.positionDelta)
    .slice(0, MAX_ITEMS)
    .map((p): InsightItem => ({
      label: p.page,
      detail: `now #${p.position} (▼ ${p.positionDelta.toFixed(1)})`,
    }));
  if (losing.length) {
    insights.push({
      id: "pages-losing-rankings",
      severity: "warning",
      title: "Pages losing rankings",
      description:
        "Average position slipped versus the previous period. Refresh content and internal links.",
      items: losing,
    });
  }

  // 4. Pages gaining rankings.
  const gaining = gsc.topPages
    .filter((p) => p.positionDelta <= -RANK_MOVE)
    .sort((a, b) => a.positionDelta - b.positionDelta)
    .slice(0, MAX_ITEMS)
    .map((p): InsightItem => ({
      label: p.page,
      detail: `now #${p.position} (▲ ${Math.abs(p.positionDelta).toFixed(1)})`,
    }));
  if (gaining.length) {
    insights.push({
      id: "pages-gaining-rankings",
      severity: "positive",
      title: "Pages gaining rankings",
      description:
        "Average position improved. Double down — add related internal links and expand these pages.",
      items: gaining,
    });
  }

  // 5. Most used calculators.
  const calculators = ga.topPages
    .filter((p) => p.page.startsWith("/tools/"))
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_ITEMS)
    .map((p): InsightItem => ({ label: p.page, detail: `${formatFull(p.views)} views` }));
  if (calculators.length) {
    insights.push({
      id: "most-used-calculators",
      severity: "info",
      title: "Most used calculators",
      description:
        "Your highest-traffic tools — prioritise them for polish, features, and monetisation.",
      items: calculators,
    });
  }

  // 6. Most viewed articles.
  const articles = ga.topPages
    .filter((p) => p.page.startsWith("/learn/"))
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_ITEMS)
    .map((p): InsightItem => ({ label: p.page, detail: `${formatFull(p.views)} views` }));
  if (articles.length) {
    insights.push({
      id: "most-viewed-articles",
      severity: "info",
      title: "Most viewed articles",
      description:
        "Top Learn Center content — link these to related calculators to convert readers.",
      items: articles,
    });
  }

  // 7. UX friction from Clarity (rage/dead clicks).
  if (clarity.rageClicks > 0 || clarity.deadClicks > 0) {
    const frictionPages = clarity.topPagesByActivity
      .filter((p) => p.rageClicks > 0 || p.deadClicks > 0)
      .sort((a, b) => b.rageClicks + b.deadClicks - (a.rageClicks + a.deadClicks))
      .slice(0, MAX_ITEMS)
      .map((p): InsightItem => ({
        label: p.page,
        detail: `${p.rageClicks} rage · ${p.deadClicks} dead clicks`,
      }));
    if (frictionPages.length) {
      insights.push({
        id: "ux-friction",
        severity: "warning",
        title: "UX friction (rage & dead clicks)",
        description:
          "Clarity detected frustrated interactions. Review these pages for broken/unclear clickable elements.",
        items: frictionPages,
      });
    }
  }

  return insights;
}

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeInsights } from "@/lib/growth/insights";
import type { SearchConsoleData, AnalyticsData, ClarityData } from "@/lib/growth/types";

function gsc(topPages: SearchConsoleData["topPages"]): SearchConsoleData {
  return {
    totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    clicksTrend: [1, 2],
    impressionsTrend: [1, 2],
    topQueries: [],
    topPages,
    indexCoverage: { indexed: 0, discovered: 0, excluded: 0, errors: 0 },
    sitemap: { path: "/sitemap.xml", submitted: 0, indexed: 0, lastRead: "", status: "Success" },
  };
}
function ga(topPages: AnalyticsData["topPages"]): AnalyticsData {
  return {
    totals: { users: 0, sessions: 0, engagementRate: 0, returningUsers: 0, avgEngagementSec: 0 },
    usersTrend: [1, 2],
    topPages,
    sources: [],
    countries: [],
    devices: [],
    conversions: [],
    events: [],
  };
}
const emptyClarity: ClarityData = {
  sessions: 0,
  recordings: 0,
  deadClicks: 0,
  rageClicks: 0,
  quickBacks: 0,
  excessiveScroll: 0,
  avgScrollDepth: 0,
  scrollByPage: [],
  topPagesByActivity: [],
};

const P = (
  over: Partial<SearchConsoleData["topPages"][number]>
): SearchConsoleData["topPages"][number] => ({
  page: "/x",
  clicks: 10,
  impressions: 1000,
  ctr: 0.05,
  position: 10,
  positionDelta: 0,
  ...over,
});
const G = (
  over: Partial<AnalyticsData["topPages"][number]>
): AnalyticsData["topPages"][number] => ({
  page: "/x",
  views: 100,
  users: 80,
  avgEngagementSec: 60,
  bounceRate: 0.3,
  ...over,
});

describe("computeInsights", () => {
  it("flags high impressions + low CTR", () => {
    const ins = computeInsights(
      gsc([P({ page: "/a", impressions: 5000, ctr: 0.01 })]),
      ga([]),
      emptyClarity
    );
    const hit = ins.find((i) => i.id === "high-impressions-low-ctr");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("opportunity");
    expect(hit!.items[0].label).toBe("/a");
  });

  it("does not flag low-impression or high-CTR pages", () => {
    const ins = computeInsights(
      gsc([P({ impressions: 1000, ctr: 0.01 }), P({ impressions: 5000, ctr: 0.06 })]),
      ga([]),
      emptyClarity
    );
    expect(ins.find((i) => i.id === "high-impressions-low-ctr")).toBeUndefined();
  });

  it("flags high traffic + high bounce", () => {
    const ins = computeInsights(
      gsc([]),
      ga([G({ page: "/", views: 900, bounceRate: 0.72 })]),
      emptyClarity
    );
    expect(ins.find((i) => i.id === "high-traffic-high-bounce")?.items[0].label).toBe("/");
  });

  it("separates losing and gaining rankings by position delta", () => {
    const ins = computeInsights(
      gsc([P({ page: "/down", positionDelta: 3 }), P({ page: "/up", positionDelta: -2.5 })]),
      ga([]),
      emptyClarity
    );
    expect(ins.find((i) => i.id === "pages-losing-rankings")?.items[0].label).toBe("/down");
    const gaining = ins.find((i) => i.id === "pages-gaining-rankings");
    expect(gaining?.severity).toBe("positive");
    expect(gaining?.items[0].label).toBe("/up");
  });

  it("surfaces most-used calculators and most-viewed articles", () => {
    const ins = computeInsights(
      gsc([]),
      ga([
        G({ page: "/tools/emi-calculator", views: 800 }),
        G({ page: "/learn/what-is-hra", views: 600 }),
        G({ page: "/about", views: 500 }),
      ]),
      emptyClarity
    );
    expect(ins.find((i) => i.id === "most-used-calculators")?.items[0].label).toBe(
      "/tools/emi-calculator"
    );
    expect(ins.find((i) => i.id === "most-viewed-articles")?.items[0].label).toBe(
      "/learn/what-is-hra"
    );
  });

  it("flags UX friction from rage/dead clicks", () => {
    const ins = computeInsights(gsc([]), ga([]), {
      ...emptyClarity,
      rageClicks: 5,
      deadClicks: 10,
      topPagesByActivity: [{ page: "/tools/z", sessions: 100, deadClicks: 8, rageClicks: 4 }],
    });
    expect(ins.find((i) => i.id === "ux-friction")?.items[0].label).toBe("/tools/z");
  });

  it("returns no insights for empty inputs", () => {
    expect(computeInsights(gsc([]), ga([]), emptyClarity)).toEqual([]);
  });
});

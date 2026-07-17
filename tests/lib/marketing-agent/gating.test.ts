/**
 * GROWTH-002 validation contract: with no analytics access, the engines produce
 * ZERO search-derived recommendations and the reports say "waiting for provider
 * access". No fabricated rankings, no invented opportunities, no placeholder
 * metrics — blindness is a reported state, never a guessed number.
 */

import { describe, it, expect } from "vitest";
import { makeContext } from "./fixtures";
import { emptySearchConsole, emptyAnalytics, emptyClarity } from "@/lib/growth/empty";
import { runAgents } from "@/lib/marketing-agent";
import { buildWeeklyReport } from "@/lib/marketing-agent/reports/weekly";
import { revenueAgent } from "@/lib/marketing-agent/agents/revenue";

const NOW = new Date("2026-07-16T08:00:00.000Z");

/** A context exactly like production today: providers blind, empty datasets. */
function blindContext() {
  const ctx = makeContext({ now: NOW, articles: [], tools: [] });
  ctx.growth.searchConsole = {
    status: "unconfigured",
    data: emptySearchConsole(),
    note: "Search Console not configured",
    fetchedAt: NOW.toISOString(),
  };
  ctx.growth.analytics = {
    status: "unconfigured",
    data: emptyAnalytics(),
    note: "Analytics not configured",
    fetchedAt: NOW.toISOString(),
  };
  ctx.growth.clarity = {
    status: "unconfigured",
    data: emptyClarity(),
    note: "Clarity not configured",
    fetchedAt: NOW.toISOString(),
  };
  ctx.growth.noneLive = true;
  return ctx;
}

describe("no fabrication when blind (GROWTH-002)", () => {
  it("produces zero search-derived recommendations on empty providers", () => {
    const { ranked: recs } = runAgents(blindContext());
    const searchDerived = recs.filter((r) =>
      /^seo-(striking|ctr|zeroclick|losing|gaining|serp|link|cluster-authority)/.test(r.id)
    );
    expect(searchDerived).toEqual([]);
  });

  it("produces zero traffic/UX recommendations on empty analytics", () => {
    const { ranked: recs } = runAgents(blindContext());
    expect(recs.filter((r) => /^(traffic|ux)-/.test(r.id))).toEqual([]);
  });

  it("comparison-funnel rule is silent without live analytics", () => {
    const recs = revenueAgent.run(blindContext());
    expect(recs.find((r) => r.id === "revenue-comparison-funnel")).toBeUndefined();
  });

  it("comparison-funnel rule fires only on live data with a weak funnel", () => {
    const ctx = blindContext();
    ctx.growth.analytics = {
      status: "live",
      data: {
        ...emptyAnalytics(),
        events: [
          { label: "comparison_view", value: 400 },
          { label: "comparison_cta_click", value: 3 },
        ],
      },
      fetchedAt: NOW.toISOString(),
    };
    const rec = revenueAgent.run(ctx).find((r) => r.id === "revenue-comparison-funnel");
    expect(rec).toBeDefined();
    expect(rec?.reason).toMatch(/400/);
    expect(rec?.evidence.some((e) => e.value.includes("0.8%"))).toBe(true);
  });

  it("comparison-funnel rule stays silent when the funnel is healthy or thin", () => {
    const ctx = blindContext();
    ctx.growth.analytics = {
      status: "live",
      data: {
        ...emptyAnalytics(),
        events: [
          { label: "comparison_view", value: 400 },
          { label: "comparison_cta_click", value: 40 }, // 10% — healthy
        ],
      },
      fetchedAt: NOW.toISOString(),
    };
    expect(revenueAgent.run(ctx).find((r) => r.id === "revenue-comparison-funnel")).toBeUndefined();

    ctx.growth.analytics.data.events = [{ label: "comparison_view", value: 10 }]; // below minimum
    expect(revenueAgent.run(ctx).find((r) => r.id === "revenue-comparison-funnel")).toBeUndefined();
  });

  it("weekly report names each blind provider as waiting for access", () => {
    const ctx = blindContext();
    const report = buildWeeklyReport(ctx, runAgents(ctx).ranked);
    expect(report.providerStatus).toHaveLength(3);
    for (const line of report.providerStatus) {
      expect(line).toMatch(/waiting for provider access/);
    }
  });

  it("weekly report says live when a provider is live", () => {
    const ctx = blindContext();
    ctx.growth.searchConsole.status = "live";
    const report = buildWeeklyReport(ctx, runAgents(ctx).ranked);
    expect(report.providerStatus[0]).toBe("Search Console: live");
  });
});

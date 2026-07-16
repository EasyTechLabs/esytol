// @vitest-environment node
import { describe, it, expect } from "vitest";
import { analyse, runAgents, getMarketingReport } from "@/lib/marketing-agent";
import { makeContext, page, gaPage, financeTool } from "./fixtures";

const NOW = new Date("2026-07-16T08:00:00Z");

describe("engine — runAgents", () => {
  it("runs every registered agent and returns a ranked combined list", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [
        page({ page: "/tools/income-tax-calculator", position: 3, ctr: 0.01, impressions: 30_000 }),
      ],
      gaPages: [gaPage({ page: "/tools/income-tax-calculator", views: 3_000, bounceRate: 0.8 })],
      tools: [financeTool({})],
    });
    const { runs, ranked } = runAgents(ctx);

    expect(runs).toHaveLength(7);
    expect(ranked.length).toBeGreaterThan(0);
    // globally ranked by score
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    // every recommendation is fully formed
    for (const r of ranked) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.reason).toBeTruthy();
      expect(r.expectedImpact).toBeTruthy();
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(r.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["S", "M", "L"]).toContain(r.effort);
    }
  });

  it("recommendation ids are unique", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [
        page({ page: "/a", position: 3, ctr: 0.01, impressions: 30_000 }),
        page({ page: "/b", position: 14, ctr: 0.004, impressions: 9_000 }),
      ],
    });
    const { ranked } = runAgents(ctx);
    expect(new Set(ranked.map((r) => r.id)).size).toBe(ranked.length);
  });
});

describe("engine — analyse", () => {
  const ctx = makeContext({
    now: NOW,
    pages: [
      page({ page: "/tools/income-tax-calculator", position: 3, ctr: 0.01, impressions: 30_000 }),
    ],
    gaPages: [gaPage({ page: "/tools/income-tax-calculator", views: 3_000, bounceRate: 0.8 })],
    tools: [financeTool({})],
  });

  it("produces agents, ranked recommendations and both reports", () => {
    const r = analyse(ctx);
    expect(r.agents).toHaveLength(7);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.daily).toBeDefined();
    expect(r.weekly).toBeDefined();
    expect(r.generatedAt).toBe(NOW.toISOString());
  });

  it("is deterministic", () => {
    const a = analyse(ctx);
    const b = analyse(ctx);
    expect(a.recommendations.map((r) => r.id + r.score)).toEqual(
      b.recommendations.map((r) => r.id + r.score)
    );
    expect(a.daily.headline).toBe(b.daily.headline);
  });
});

describe("daily report", () => {
  const ctx = makeContext({
    now: NOW,
    pages: [
      page({
        page: "/tools/income-tax-calculator",
        position: 3,
        ctr: 0.01,
        impressions: 30_000,
        positionDelta: -2,
      }),
      page({ page: "/tools/old", position: 8, ctr: 0.05, impressions: 5_000, positionDelta: 3 }),
    ],
    gaPages: [gaPage({ page: "/tools/income-tax-calculator", views: 3_000, bounceRate: 0.8 })],
    tools: [financeTool({})],
  });

  it("has the required founder sections", () => {
    const { daily } = analyse(ctx);
    expect(daily.date).toBe("2026-07-16");
    expect(daily.headline).toBeTruthy();
    expect(daily.yesterday.length).toBeGreaterThan(0);
    expect(daily.wins.length).toBeGreaterThan(0);
    expect(daily.problems.length).toBeGreaterThan(0);
    expect(daily.sections).toHaveLength(7);
    expect(daily.topPriorities.length).toBeGreaterThan(0);
    expect(daily.weeklyTrend.length).toBeGreaterThan(0);
    expect(daily.monthlyTrend.length).toBeGreaterThan(0);
    expect(daily.futureWork.length).toBeGreaterThan(0);
  });

  it("reports gaining pages as wins and losing pages as problems", () => {
    const { daily } = analyse(ctx);
    expect(daily.wins.join(" ")).toMatch(/gained rankings/i);
    expect(daily.problems.join(" ")).toMatch(/lost rankings/i);
  });

  it("caps any single agent's share of the top priorities", () => {
    const many = makeContext({
      now: NOW,
      clarityActivity: Array.from({ length: 6 }, (_, i) => ({
        page: `/tools/p${i}`,
        sessions: 2_000,
        deadClicks: 40,
        rageClicks: 12,
      })),
    });
    const { daily } = analyse(many);
    const ux = daily.topPriorities.filter((r) => r.agent === "ux").length;
    // 2 from the cap + at most a back-fill; never all 10
    expect(ux).toBeLessThan(daily.topPriorities.length);
  });

  it("the headline names the single highest-priority action", () => {
    const { daily, recommendations } = analyse(ctx);
    expect(daily.headline).toContain(daily.topPriorities[0].title);
    expect(recommendations[0].score).toBeGreaterThanOrEqual(
      recommendations[recommendations.length - 1].score
    );
  });
});

describe("weekly report", () => {
  const ctx = makeContext({
    now: NOW,
    pages: [page({ page: "/tools/a", position: 14, ctr: 0.004, impressions: 9_000 })],
    sources: [
      { label: "Organic Search", value: 900 },
      { label: "Direct", value: 100 },
    ],
    tools: [financeTool({})],
  });

  it("has KPIs, graphs, insights, progress, risks and opportunities", () => {
    const { weekly } = analyse(ctx);
    expect(weekly.period).toMatch(/^\d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}$/);
    expect(weekly.kpis.length).toBeGreaterThan(0);
    expect(weekly.graphs.length).toBe(3);
    expect(weekly.graphs.every((g) => g.series.length > 0)).toBe(true);
    expect(weekly.insights.length).toBeGreaterThan(0);
    expect(weekly.progress.length).toBeGreaterThan(0);
    expect(weekly.biggestRisks.length).toBeGreaterThan(0);
    expect(weekly.biggestOpportunities.length).toBeGreaterThan(0);
  });

  it("names channel concentration and striking-distance pages", () => {
    const { weekly } = analyse(ctx);
    expect(weekly.insights.join(" ")).toMatch(/organic/i);
    expect(weekly.insights.join(" ")).toMatch(/striking distance/i);
    expect(weekly.biggestRisks.join(" ")).toMatch(/single-channel|sample data/i);
  });
});

describe("getMarketingReport — live wiring (providers degrade to sample)", () => {
  it("runs end-to-end with no credentials and no network", async () => {
    const r = await getMarketingReport(NOW);
    expect(r.allSample).toBe(true);
    expect(r.agents).toHaveLength(7);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.daily.topPriorities.length).toBeGreaterThan(0);
    expect(r.weekly.kpis.length).toBeGreaterThan(0);
  });

  it("reads the real registry and Learn Center", async () => {
    const r = await getMarketingReport(NOW);
    // Content agent only produces output when it can see real tools/articles.
    const content = r.agents.find((a) => a.key === "content");
    expect(content!.recommendations.length).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed clock", async () => {
    const a = await getMarketingReport(NOW);
    const b = await getMarketingReport(NOW);
    expect(a.recommendations.map((r) => r.id + r.score)).toEqual(
      b.recommendations.map((r) => r.id + r.score)
    );
  });
});

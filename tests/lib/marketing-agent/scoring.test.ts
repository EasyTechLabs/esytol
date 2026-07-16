// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  opportunityScore,
  priorityFromScore,
  easeOfFix,
  clamp01,
  trafficPotentialFromClicks,
  businessValueForPage,
  isFinanceTool,
  expectedCtr,
  ctrUpsideClicks,
  rankRecommendations,
  pickTopPriorities,
  buildRecommendation,
  addDays,
} from "@/lib/marketing-agent/scoring";
import type { Recommendation } from "@/lib/marketing-agent/types";
import type { Tool } from "@/types/tool";

const NOW = new Date("2026-07-16T08:00:00Z");

const tool = (over: Partial<Tool>): Tool =>
  ({
    id: "x",
    name: "X",
    slug: "x",
    description: "",
    category: "calculator",
    tags: [],
    icon: "🧮",
    url: "/tools/x",
    ...over,
  }) as Tool;

describe("opportunity score", () => {
  it("is the product of the four factors, as 0..100", () => {
    expect(
      opportunityScore({ trafficPotential: 1, businessValue: 1, easeOfFix: 1, confidence: 1 })
    ).toBe(100);
    expect(
      opportunityScore({ trafficPotential: 0.5, businessValue: 0.5, easeOfFix: 1, confidence: 1 })
    ).toBe(25);
  });

  it("zeroes when any factor is zero — an opportunity we can't act on ranks last", () => {
    expect(
      opportunityScore({ trafficPotential: 1, businessValue: 1, easeOfFix: 0, confidence: 1 })
    ).toBe(0);
    expect(
      opportunityScore({ trafficPotential: 1, businessValue: 0, easeOfFix: 1, confidence: 1 })
    ).toBe(0);
  });

  it("clamps out-of-range factors", () => {
    expect(
      opportunityScore({ trafficPotential: 9, businessValue: 9, easeOfFix: 9, confidence: 9 })
    ).toBe(100);
    expect(
      opportunityScore({ trafficPotential: -5, businessValue: 1, easeOfFix: 1, confidence: 1 })
    ).toBe(0);
    expect(clamp01(NaN)).toBe(0);
  });

  it("effort maps to ease-of-fix, so cheap fixes outrank expensive ones", () => {
    expect(easeOfFix("S")).toBeGreaterThan(easeOfFix("M"));
    expect(easeOfFix("M")).toBeGreaterThan(easeOfFix("L"));
  });

  it("priority bands follow the score", () => {
    expect(priorityFromScore(60)).toBe("critical");
    expect(priorityFromScore(30)).toBe("high");
    expect(priorityFromScore(12)).toBe("medium");
    expect(priorityFromScore(2)).toBe("low");
  });
});

describe("traffic potential", () => {
  it("is log-scaled and bounded to 0..1", () => {
    expect(trafficPotentialFromClicks(0)).toBe(0);
    expect(trafficPotentialFromClicks(-10)).toBe(0);
    expect(trafficPotentialFromClicks(1000)).toBeCloseTo(1, 1);
    expect(trafficPotentialFromClicks(100_000)).toBe(1);
    expect(trafficPotentialFromClicks(100)).toBeGreaterThan(trafficPotentialFromClicks(10));
  });
});

describe("business value — strategy encoded in the score", () => {
  const tools = [
    tool({
      slug: "income-tax-calculator",
      url: "/tools/income-tax-calculator",
      tags: ["tax", "finance"],
    }),
    tool({
      slug: "age-calculator",
      url: "/tools/age-calculator",
      tags: ["age", "everyday", "utility"],
    }),
  ];

  it("ranks finance tools above everyday tools", () => {
    const finance = businessValueForPage("/tools/income-tax-calculator", tools);
    const everyday = businessValueForPage("/tools/age-calculator", tools);
    expect(finance).toBeGreaterThan(everyday);
    expect(finance).toBe(1);
  });

  it("scores articles and hubs below tools, and unknown paths lowest", () => {
    expect(businessValueForPage("/learn/what-is-hra", tools)).toBe(0.5);
    expect(businessValueForPage("/", tools)).toBe(0.7);
    expect(businessValueForPage("/privacy", tools)).toBe(0.3);
  });

  it("isFinanceTool reads tags today and an explicit domain after migration", () => {
    expect(isFinanceTool(tool({ tags: ["everyday"] }))).toBe(false);
    expect(isFinanceTool(tool({ tags: ["tax"] }))).toBe(true);
    expect(isFinanceTool(tool({ tags: [], category: "finance" as Tool["category"] }))).toBe(true);
  });
});

describe("expected CTR curve", () => {
  it("decreases monotonically with position", () => {
    const positions = [1, 2, 3, 5, 8, 12, 18, 30];
    const ctrs = positions.map(expectedCtr);
    for (let i = 1; i < ctrs.length; i++) expect(ctrs[i]).toBeLessThanOrEqual(ctrs[i - 1]);
  });

  it("quantifies upside only when CTR is below the curve", () => {
    // position 3 expects ~10%; actual 2% on 10,000 impressions → ~800 clicks upside
    expect(ctrUpsideClicks(10_000, 0.02, 3)).toBe(800);
    // already over-performing → no upside
    expect(ctrUpsideClicks(10_000, 0.5, 3)).toBe(0);
  });
});

// ── ranking + diversity ──

const rec = (over: Partial<Recommendation>): Recommendation =>
  ({
    id: "r",
    agent: "seo",
    category: "seo",
    priority: "medium",
    title: "t",
    reason: "r",
    expectedImpact: "i",
    effort: "S",
    confidence: 0.5,
    owner: "SEO",
    deadline: "2026-07-20",
    score: 10,
    evidence: [],
    ...over,
  }) as Recommendation;

describe("ranking", () => {
  it("sorts by score descending", () => {
    const out = rankRecommendations([
      rec({ id: "a", score: 10 }),
      rec({ id: "b", score: 50 }),
      rec({ id: "c", score: 30 }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("is deterministic — ties break on id", () => {
    const a = rankRecommendations([rec({ id: "z", score: 10 }), rec({ id: "a", score: 10 })]);
    const b = rankRecommendations([rec({ id: "a", score: 10 }), rec({ id: "z", score: 10 })]);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
  });
});

describe("pickTopPriorities — the briefing must span the business", () => {
  it("caps how many slots one agent can take", () => {
    const ranked = rankRecommendations([
      rec({ id: "ux1", agent: "ux", score: 90 }),
      rec({ id: "ux2", agent: "ux", score: 89 }),
      rec({ id: "ux3", agent: "ux", score: 88 }),
      rec({ id: "ux4", agent: "ux", score: 87 }),
      rec({ id: "rev", agent: "revenue", score: 20 }),
      rec({ id: "seo1", agent: "seo", score: 15 }),
    ]);
    const top = pickTopPriorities(ranked, 4, 2);
    const uxCount = top.filter((r) => r.agent === "ux").length;
    expect(uxCount).toBeLessThanOrEqual(2);
    // the low-scoring but strategically distinct items get surfaced
    expect(top.map((r) => r.id)).toContain("rev");
    expect(top.map((r) => r.id)).toContain("seo1");
  });

  it("back-fills by score when the cap leaves slots empty", () => {
    const ranked = rankRecommendations([
      rec({ id: "a", agent: "ux", score: 50 }),
      rec({ id: "b", agent: "ux", score: 40 }),
      rec({ id: "c", agent: "ux", score: 30 }),
    ]);
    expect(pickTopPriorities(ranked, 3, 2)).toHaveLength(3);
  });

  it("returns score-ordered output", () => {
    const ranked = rankRecommendations([
      rec({ id: "a", agent: "seo", score: 10 }),
      rec({ id: "b", agent: "ux", score: 80 }),
    ]);
    const top = pickTopPriorities(ranked, 5, 2);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
  });
});

describe("buildRecommendation", () => {
  it("scores, prioritises and dates every recommendation the same way", () => {
    const r = buildRecommendation({
      id: "x",
      agent: "seo",
      title: "T",
      reason: "R",
      expectedImpact: "I",
      effort: "S",
      confidence: 1,
      owner: "SEO",
      evidence: [],
      trafficPotential: 1,
      businessValue: 1,
      deadlineDays: 7,
      now: NOW,
    });
    expect(r.score).toBe(100);
    expect(r.priority).toBe("critical");
    expect(r.deadline).toBe("2026-07-23");
    expect(r.category).toBe("seo");
  });

  it("addDays produces an ISO date", () => {
    expect(addDays(NOW, 0)).toBe("2026-07-16");
    expect(addDays(NOW, 10)).toBe("2026-07-26");
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { seoAgent } from "@/lib/marketing-agent/agents/seo";
import { trafficAgent } from "@/lib/marketing-agent/agents/traffic";
import { uxAgent } from "@/lib/marketing-agent/agents/ux";
import { engineeringAgent } from "@/lib/marketing-agent/agents/engineering";
import { contentAgent } from "@/lib/marketing-agent/agents/content";
import { competitorAgent, COMPETITORS } from "@/lib/marketing-agent/agents/competitor";
import { revenueAgent, revenueSources } from "@/lib/marketing-agent/agents/revenue";
import { agents } from "@/lib/marketing-agent/agents";
import type { AgentContext } from "@/lib/marketing-agent/types";
import type { Article } from "@/lib/learn";
import type { Tool } from "@/types/tool";
import { makeContext, page, query, gaPage, financeTool } from "./fixtures";

const NOW = new Date("2026-07-16T08:00:00Z");

describe("agent registry", () => {
  it("registers all seven agents with unique keys", () => {
    expect(agents).toHaveLength(7);
    expect(new Set(agents.map((a) => a.key)).size).toBe(7);
  });

  it("marks competitor + revenue as planned, the rest active", () => {
    const planned = agents.filter((a) => a.status === "planned").map((a) => a.key);
    expect(planned.sort()).toEqual(["competitor", "revenue"]);
  });

  it("every agent is pure — same context in, same output out", () => {
    const ctx = makeContext({ now: NOW });
    for (const agent of agents) {
      const a = agent.run(ctx);
      const b = agent.run(ctx);
      expect(a.map((r) => r.id + r.score)).toEqual(b.map((r) => r.id + r.score));
    }
  });
});

describe("SEO agent", () => {
  it("recommends a title rewrite for a page-1 page with CTR below its position's curve", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [
        page({
          page: "/tools/income-tax-calculator",
          position: 3,
          ctr: 0.012,
          impressions: 20_000,
          clicks: 240,
        }),
      ],
    });
    const recs = seoAgent.run(ctx);
    const hit = recs.find((r) => r.id.startsWith("seo-ctr-"));
    expect(hit).toBeDefined();
    expect(hit!.impactClicks).toBeGreaterThan(0);
    expect(hit!.effort).toBe("S");
    expect(hit!.owner).toBe("SEO");
  });

  it("does NOT raise a CTR rec when the page already beats the curve", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/tools/a", position: 3, ctr: 0.4, impressions: 20_000 })],
    });
    expect(seoAgent.run(ctx).filter((r) => r.id.startsWith("seo-ctr-"))).toHaveLength(0);
  });

  it("treats position 11–20 as a ranking problem, not a CTR problem", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/tools/b", position: 14, ctr: 0.005, impressions: 9_000 })],
    });
    const recs = seoAgent.run(ctx);
    expect(recs.some((r) => r.id.startsWith("seo-striking-"))).toBe(true);
    expect(recs.some((r) => r.id.startsWith("seo-ctr-"))).toBe(false);
  });

  it("flags impressions with zero clicks", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/tools/c", position: 6, ctr: 0, clicks: 0, impressions: 5_000 })],
    });
    expect(seoAgent.run(ctx).some((r) => r.id.startsWith("seo-zeroclick-"))).toBe(true);
  });

  it("separates losing from gaining keywords", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [
        query({ query: "down", positionDelta: 4, impressions: 5_000 }),
        query({ query: "up", positionDelta: -4, impressions: 5_000 }),
      ],
    });
    const recs = seoAgent.run(ctx);
    expect(recs.some((r) => r.id === "seo-losing-down")).toBe(true);
    expect(recs.some((r) => r.id === "seo-gaining-up")).toBe(true);
  });

  it("stays silent on low-impression noise", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/x", impressions: 5, ctr: 0, clicks: 0 })],
    });
    expect(seoAgent.run(ctx)).toHaveLength(0);
  });
});

describe("Traffic agent", () => {
  it("flags high-traffic high-bounce pages", () => {
    const ctx = makeContext({
      now: NOW,
      gaPages: [gaPage({ page: "/tools/x", views: 2_000, bounceRate: 0.8 })],
    });
    expect(trafficAgent.run(ctx).some((r) => r.id === "traffic-bounce-/tools/x")).toBe(true);
  });

  it("flags single-channel concentration as a risk", () => {
    const ctx = makeContext({
      now: NOW,
      sources: [
        { label: "Organic Search", value: 900 },
        { label: "Direct", value: 100 },
      ],
    });
    const hit = trafficAgent.run(ctx).find((r) => r.id === "traffic-channel-concentration");
    expect(hit).toBeDefined();
    expect(hit!.confidence).toBeGreaterThan(0.8);
  });

  it("flags low returning-user share", () => {
    const ctx = makeContext({ now: NOW, users: 1000, returningUsers: 50 });
    expect(trafficAgent.run(ctx).some((r) => r.id === "traffic-retention")).toBe(true);
  });

  it("does not flag retention when returning share is healthy", () => {
    const ctx = makeContext({ now: NOW, users: 1000, returningUsers: 600 });
    expect(trafficAgent.run(ctx).some((r) => r.id === "traffic-retention")).toBe(false);
  });
});

describe("UX agent", () => {
  it("flags rage/dead click friction", () => {
    const ctx = makeContext({
      now: NOW,
      clarityActivity: [{ page: "/tools/x", sessions: 900, deadClicks: 40, rageClicks: 12 }],
    });
    const hit = uxAgent.run(ctx).find((r) => r.id === "ux-friction-/tools/x");
    expect(hit).toBeDefined();
    expect(hit!.owner).toBe("UX");
  });

  it("flags shallow scroll depth", () => {
    const ctx = makeContext({ now: NOW, scrollByPage: [{ page: "/tools/y", scrollDepth: 0.2 }] });
    expect(uxAgent.run(ctx).some((r) => r.id === "ux-scroll-/tools/y")).toBe(true);
  });

  it("flags a high quick-back share", () => {
    const ctx = makeContext({ now: NOW, claritySessions: 1000, quickBacks: 400 });
    expect(uxAgent.run(ctx).some((r) => r.id === "ux-quickbacks")).toBe(true);
  });
});

describe("Engineering agent", () => {
  it("raises a critical item when production is not READY", () => {
    const ctx = makeContext({ now: NOW, latestState: "ERROR" });
    const hit = engineeringAgent.run(ctx).find((r) => r.id === "eng-latest-deploy");
    expect(hit).toBeDefined();
    expect(hit!.priority).toBe("critical");
  });

  it("flags failed builds and poor Core Web Vitals", () => {
    const ctx = makeContext({
      now: NOW,
      builds: [
        {
          id: "1",
          state: "ERROR",
          target: "production",
          createdAt: NOW.toISOString(),
          commit: "abc",
          durationSec: 10,
        },
      ],
      performance: [{ metric: "LCP", value: 5, unit: "s", rating: "poor" }],
    });
    const recs = engineeringAgent.run(ctx);
    expect(recs.some((r) => r.id === "eng-build-failures")).toBe(true);
    expect(recs.some((r) => r.id === "eng-cwv-LCP")).toBe(true);
  });

  it("is silent on a healthy pipeline", () => {
    expect(engineeringAgent.run(makeContext({ now: NOW }))).toHaveLength(0);
  });
});

describe("Content agent", () => {
  const article = (over: Partial<Article>): Article =>
    ({
      slug: "a",
      frontmatter: {
        title: "A",
        metaDescription: "",
        category: "income-tax",
        tags: [],
        lastUpdated: "2026-01-01",
        reviewedBy: "T",
      },
      readingTime: 5,
      body: "",
      faqs: [{ question: "q", answer: "a" }],
      relatedToolSlugs: ["income-tax-calculator"],
      ...over,
    }) as Article;

  it("flags a tool with no supporting article", () => {
    const ctx = makeContext({
      now: NOW,
      tools: [
        financeTool({ slug: "fd-calculator", name: "FD Calculator", url: "/tools/fd-calculator" }),
      ],
      articles: [article({})],
    });
    expect(
      contentAgent.run(ctx).some((r) => r.id === "content-missing-article-fd-calculator")
    ).toBe(true);
  });

  it("flags an article with no FAQ (no FAQPage schema)", () => {
    const ctx = makeContext({ now: NOW, articles: [article({ slug: "no-faq", faqs: [] })] });
    expect(contentAgent.run(ctx).some((r) => r.id === "content-missing-faq-no-faq")).toBe(true);
  });

  it("flags an article that links to no tool", () => {
    const ctx = makeContext({
      now: NOW,
      articles: [article({ slug: "orphan", relatedToolSlugs: [] })],
    });
    expect(contentAgent.run(ctx).some((r) => r.id === "content-missing-links-orphan")).toBe(true);
  });

  it("suggests a Collection once a cluster is big enough", () => {
    const ctx = makeContext({
      now: NOW,
      articles: [article({ slug: "a1" }), article({ slug: "a2" }), article({ slug: "a3" })],
    });
    expect(contentAgent.run(ctx).some((r) => r.id === "content-collection-income-tax")).toBe(true);
  });
});

describe("planned agents", () => {
  it("Competitor agent is wired but produces nothing until a signal source exists", () => {
    expect(competitorAgent.status).toBe("planned");
    expect(competitorAgent.run(makeContext({ now: NOW }))).toHaveLength(0);
    expect(COMPETITORS.length).toBeGreaterThanOrEqual(7);
    expect(COMPETITORS.map((c) => c.key)).toContain("cleartax");
  });

  it("Revenue agent reports the configuration gap, not invented revenue", () => {
    const recs = revenueAgent.run(makeContext({ now: NOW }));
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("revenue-not-configured");
    expect(recs[0].owner).toBe("Founder");
    expect(revenueSources().every((s) => s.configured === false)).toBe(true);
    // affiliate is the highest-priority source per strategy
    expect(revenueSources().find((s) => s.priority === 1)?.key).toBe("affiliate");
  });
});

describe("context typing", () => {
  it("accepts real Tool/Article shapes", () => {
    const t: Tool[] = [financeTool({})];
    const ctx: AgentContext = makeContext({ now: NOW, tools: t });
    expect(ctx.tools).toHaveLength(1);
  });
});

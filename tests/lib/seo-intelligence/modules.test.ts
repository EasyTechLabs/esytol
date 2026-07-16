/**
 * SEO Intelligence Engine — module tests.
 *
 * Reuses the Marketing Agent fixtures: both engines read the same context, so the
 * fixtures must be shared or they will drift. `makeContext()` triggers nothing, and
 * each test overrides exactly one signal — a passing assertion proves that rule fired.
 */

import { describe, it, expect } from "vitest";
import {
  makeContext,
  page,
  query,
  gaPage,
  financeTool,
  article,
} from "../marketing-agent/fixtures";
import { keywordOpportunities, keywordsModule } from "@/lib/seo-intelligence/modules/keywords";
import { ctrModule, ctrSuggestions, ctrSuggestionFor } from "@/lib/seo-intelligence/modules/ctr";
import { contentGapModule } from "@/lib/seo-intelligence/modules/contentGap";
import {
  internalLinksModule,
  outboundLinks,
  inboundGraph,
} from "@/lib/seo-intelligence/modules/internalLinks";
import { serpModule, classifyQuery } from "@/lib/seo-intelligence/modules/serp";
import { clustersModule, clusterHealth } from "@/lib/seo-intelligence/modules/clusters";

const NOW = new Date("2026-07-16T00:00:00Z");

describe("Keyword Opportunity Engine", () => {
  it("assigns the CTR lever on page 1 and the ranking lever on page 2", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [
        query({ query: "page-one", position: 3, ctr: 0.01, impressions: 5_000 }),
        query({ query: "page-two", position: 14, ctr: 0.002, impressions: 5_000 }),
      ],
    });
    const rows = keywordOpportunities(ctx);
    expect(rows.find((r) => r.query === "page-one")?.lever).toBe("ctr");
    expect(rows.find((r) => r.query === "page-two")?.lever).toBe("ranking");
  });

  it("prefers the movement lever over the rank lever when a keyword has moved", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [query({ query: "slipping", position: 3, positionDelta: 4, impressions: 5_000 })],
    });
    // Rank 3 would normally be "ctr" — a 4-place drop makes defending it the story.
    expect(keywordOpportunities(ctx)[0].lever).toBe("defend");
  });

  it("fires striking-distance only above the impression floor", () => {
    const quiet = makeContext({
      now: NOW,
      pages: [page({ page: "/x", position: 14, impressions: 50, ctr: 0 })],
    });
    expect(keywordsModule.run(quiet)).toHaveLength(0);

    const loud = makeContext({
      now: NOW,
      pages: [page({ page: "/x", position: 14, impressions: 5_000, ctr: 0 })],
    });
    expect(keywordsModule.run(loud).some((r) => r.id === "seo-striking-/x")).toBe(true);
  });

  it("ranks opportunities by score, descending", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [
        query({ query: "small", position: 14, impressions: 500, ctr: 0 }),
        query({ query: "big", position: 14, impressions: 50_000, ctr: 0 }),
      ],
    });
    const rows = keywordOpportunities(ctx);
    expect(rows[0].query).toBe("big");
  });
});

describe("CTR Optimizer", () => {
  it("stays silent when a page already beats its position's expected CTR", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/x", position: 1, ctr: 0.9, impressions: 10_000 })],
    });
    expect(ctrSuggestions(ctx)).toHaveLength(0);
  });

  it("quantifies the click gap for an under-performing page-1 page", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/x", position: 1, ctr: 0.01, impressions: 10_000 })],
    });
    const [s] = ctrSuggestions(ctx);
    // Expected CTR at #1 is 26%; earning 1% leaves ~25% of 10,000 on the table.
    expect(s.potentialClickGain).toBe(2_500);
  });

  it("grounds the suggested copy in real tool metadata", () => {
    const tool = financeTool({ description: "Work out your tax in seconds. Free forever." });
    const ctx = makeContext({ now: NOW, tools: [tool] });
    const s = ctrSuggestionFor("/tools/income-tax-calculator", ctx);
    expect(s.suggestedTitle).toContain("Income Tax Calculator");
    expect(s.suggestedDescription).toContain("Work out your tax in seconds.");
    expect(s.schemaAdvice).toMatch(/FAQ/i);
  });

  it("falls back to generic advice for an unknown page", () => {
    const ctx = makeContext({ now: NOW });
    expect(ctrSuggestionFor("/nope", ctx).suggestedTitle).toBeTruthy();
  });

  it("flags zero-click pages", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/x", clicks: 0, impressions: 1_000 })],
    });
    expect(ctrModule.run(ctx).some((r) => r.id === "seo-zeroclick-/x")).toBe(true);
  });
});

describe("Content Gap Engine", () => {
  it("flags a tool with no supporting article", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool()] });
    expect(
      contentGapModule
        .run(ctx)
        .some((r) => r.id === "content-missing-article-income-tax-calculator")
    ).toBe(true);
  });

  it("does not flag a tool that an article already covers", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool()], articles: [article()] });
    expect(
      contentGapModule
        .run(ctx)
        .some((r) => r.id === "content-missing-article-income-tax-calculator")
    ).toBe(false);
  });

  it("flags an article with no FAQ", () => {
    const ctx = makeContext({ now: NOW, articles: [article({ faqs: [] })] });
    expect(contentGapModule.run(ctx).some((r) => r.id.startsWith("content-missing-faq-"))).toBe(
      true
    );
  });

  it("asks for a comparison when a cluster has tools but no comparison article", () => {
    const ctx = makeContext({
      now: NOW,
      tools: [
        financeTool(),
        financeTool({
          slug: "hra-calculator",
          name: "HRA Calculator",
          url: "/tools/hra-calculator",
        }),
      ],
    });
    expect(contentGapModule.run(ctx).some((r) => r.id === "content-missing-comparison-tax")).toBe(
      true
    );
  });

  it("does not ask for a comparison that already exists", () => {
    const ctx = makeContext({
      now: NOW,
      tools: [
        financeTool(),
        financeTool({
          slug: "hra-calculator",
          name: "HRA Calculator",
          url: "/tools/hra-calculator",
        }),
      ],
      articles: [article({ frontmatter: { title: "Old regime vs new regime" } as never })],
    });
    expect(contentGapModule.run(ctx).some((r) => r.id === "content-missing-comparison-tax")).toBe(
      false
    );
  });

  it("flags a thin related-tools mesh", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool({ relatedTools: ["a"] })] });
    expect(
      contentGapModule
        .run(ctx)
        .some((r) => r.id === "content-missing-relatedtools-income-tax-calculator")
    ).toBe(true);
  });
});

describe("Internal Linking Engine", () => {
  it("extracts tool and article links from a body", () => {
    const links = outboundLinks("see /tools/a and /learn/b and /tools/a again");
    expect(links.tools).toEqual(["a"]);
    expect(links.articles).toEqual(["b"]);
  });

  it("counts related-tools panels as inbound links", () => {
    const ctx = makeContext({
      now: NOW,
      tools: [financeTool({ relatedTools: ["hra-calculator"] })],
    });
    expect(inboundGraph(ctx).get("/tools/hra-calculator")).toBe(1);
  });

  it("flags an orphan tool", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool()] });
    expect(
      internalLinksModule.run(ctx).some((r) => r.id === "seo-orphan-income-tax-calculator")
    ).toBe(true);
  });

  it("does not call a linked tool an orphan", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool()], articles: [article()] });
    expect(
      internalLinksModule.run(ctx).some((r) => r.id === "seo-orphan-income-tax-calculator")
    ).toBe(false);
  });

  it("names the source page for a striking-distance target", () => {
    const ctx = makeContext({
      now: NOW,
      pages: [page({ page: "/tools/hra-calculator", position: 14, impressions: 5_000 })],
      tools: [
        financeTool({
          slug: "hra-calculator",
          name: "HRA",
          url: "/tools/hra-calculator",
          tags: ["tax"],
        }),
      ],
      articles: [article({ body: "no links here", relatedToolSlugs: [] })],
    });
    const rec = internalLinksModule.run(ctx).find((r) => r.id === "seo-link-/tools/hra-calculator");
    expect(rec?.expectedImpact).toContain("/learn/how-to-calculate-income-tax");
  });
});

describe("SERP Opportunity Engine", () => {
  it("classifies queries by shape", () => {
    expect(classifyQuery("hra vs standard deduction", 5, 0.1)).toBe("comparison");
    expect(classifyQuery("what is gratuity", 5, 0.1)).toBe("definition");
    expect(classifyQuery("how to calculate epf", 5, 0.1)).toBe("people-also-ask");
    expect(classifyQuery("epf calculator online india 2026", 30, 0.1)).toBe("long-tail");
  });

  it("treats an under-clicked top-5 page as a snippet target", () => {
    expect(classifyQuery("epf", 3, 0.001)).toBe("featured-snippet");
  });

  it("returns nothing for a plain query that is already performing", () => {
    expect(classifyQuery("epf", 3, 0.5)).toBeNull();
  });

  it("ignores low-impression queries", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [query({ query: "what is epf", impressions: 10 })],
    });
    expect(serpModule.run(ctx)).toHaveLength(0);
  });

  it("declares that the feature is inferred, not measured", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [query({ query: "what is epf", impressions: 5_000 })],
    });
    const rec = serpModule.run(ctx)[0];
    expect(rec.evidence.some((e) => /inferred/i.test(e.value))).toBe(true);
  });
});

describe("Cluster Health", () => {
  it("scores coverage from the cluster's expected topics", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool()] });
    const tax = clusterHealth(ctx).find((c) => c.key === "tax");
    expect(tax?.tools).toBe(1);
    expect(tax?.coverage).toBeGreaterThan(0);
    expect(tax?.coverage).toBeLessThan(1);
    expect(tax?.missingTopics).toContain("gst");
  });

  it("stays silent on clusters we have never entered", () => {
    // An empty context defines six clusters but contains no product. "Complete the
    // Tax cluster" would be breadth advice, not an SEO gap.
    expect(clustersModule.run(makeContext({ now: NOW }))).toHaveLength(0);
  });

  it("flags a cluster that ships tools without supporting content", () => {
    const ctx = makeContext({ now: NOW, tools: [financeTool()] });
    expect(clustersModule.run(ctx).some((r) => r.id === "seo-cluster-thin-tax")).toBe(true);
  });

  it("reports low authority when the cluster's pages do not rank", () => {
    const ctx = makeContext({
      now: NOW,
      tools: [financeTool()],
      pages: [page({ page: "/tools/income-tax-calculator", position: 80, clicks: 0 })],
    });
    const tax = clusterHealth(ctx).find((c) => c.key === "tax");
    expect(tax?.authority).toBeLessThan(0.35);
  });
});

describe("Determinism", () => {
  it("produces identical output for identical input", () => {
    const build = () =>
      makeContext({
        now: NOW,
        pages: [
          page({ page: "/tools/income-tax-calculator", position: 14, impressions: 5_000, ctr: 0 }),
        ],
        queries: [query({ query: "what is hra vs rent", impressions: 5_000 })],
        gaPages: [gaPage({ page: "/learn/a", views: 900 })],
        tools: [financeTool()],
        articles: [article()],
      });
    const run = (ctx: ReturnType<typeof build>) =>
      [
        keywordsModule,
        ctrModule,
        contentGapModule,
        internalLinksModule,
        serpModule,
        clustersModule,
      ].flatMap((m) => m.run(ctx));
    expect(JSON.stringify(run(build()))).toBe(JSON.stringify(run(build())));
  });
});

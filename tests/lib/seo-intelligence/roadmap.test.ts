/**
 * SEO Intelligence Engine — roadmap + reports tests.
 *
 * The roadmap is where the engine makes its judgement calls (de-duplication, slicing,
 * module diversity), so these tests pin the *shape* of the output, not just its
 * presence.
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
import { analyseSeo } from "@/lib/seo-intelligence";
import { buildRoadmap } from "@/lib/seo-intelligence/roadmap";

const NOW = new Date("2026-07-16T00:00:00Z");

/** A context rich enough that most modules have something to say. */
const richContext = () =>
  makeContext({
    now: NOW,
    pages: [
      page({ page: "/tools/income-tax-calculator", position: 3, ctr: 0.01, impressions: 20_000 }),
      page({ page: "/tools/hra-calculator", position: 14, ctr: 0.001, impressions: 9_000 }),
      page({ page: "/learn/a", position: 6, clicks: 0, impressions: 4_000 }),
    ],
    queries: [
      query({ query: "hra vs rent deduction", impressions: 6_000 }),
      query({ query: "what is gratuity", impressions: 5_000 }),
      query({ query: "epf interest", positionDelta: 4, impressions: 5_000 }),
    ],
    gaPages: [gaPage({ page: "/learn/a", views: 4_000 })],
    tools: [
      financeTool(),
      financeTool({ slug: "hra-calculator", name: "HRA Calculator", url: "/tools/hra-calculator" }),
    ],
    articles: [article()],
  });

describe("SEO Roadmap", () => {
  it("caps the backlog at 100 tasks", () => {
    expect(buildRoadmap(richContext()).tasks.length).toBeLessThanOrEqual(100);
  });

  it("names every task exactly once", () => {
    const ids = buildRoadmap(richContext()).tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ranks tasks by score, descending", () => {
    const scores = buildRoadmap(richContext()).tasks.map((t) => t.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("slices quick wins as cheap work with real upside", () => {
    for (const q of buildRoadmap(richContext()).quickWins) {
      expect(q.effort).toBe("S");
      expect(q.score).toBeGreaterThanOrEqual(10);
    }
  });

  it("slices long-term work as effort L", () => {
    for (const t of buildRoadmap(richContext()).longTermWork) expect(t.effort).toBe("L");
  });

  it("does not let one module own the top opportunities", () => {
    // Five under-clicked page-1 pages: the CTR module scores all five at the very top
    // and, on a pure score sort, would take five of ten slots and bury every other
    // kind of work. This is the GROWTH-012 "ranking ≠ briefing" failure, reproduced.
    // Enough other work exists here that the list can be filled without CTR, so the
    // cap must actually bite rather than back-fill.
    const ctx = makeContext({
      now: NOW,
      pages: ["a", "b", "c", "d", "e"].map((s) =>
        page({ page: `/tools/${s}`, position: 1, ctr: 0.01, impressions: 20_000 })
      ),
      queries: [
        query({ query: "what is gratuity", impressions: 5_000 }),
        query({ query: "hra vs rent", impressions: 5_000 }),
        query({ query: "how to calculate epf", impressions: 5_000 }),
      ],
      tools: ["a", "b", "c", "d", "e"].map((s) =>
        financeTool({ id: s, slug: s, name: s.toUpperCase(), url: `/tools/${s}` })
      ),
      articles: [article()],
    });

    const roadmap = buildRoadmap(ctx);
    const top = roadmap.topOpportunities;
    const ctrInTop = top.filter((t) => t.id.startsWith("seo-ctr-"));

    // The cap bites: CTR produced 5 top-scoring tasks but may only take 3 slots…
    expect(roadmap.tasks.filter((t) => t.id.startsWith("seo-ctr-")).length).toBe(5);
    expect(ctrInTop).toHaveLength(3);
    // …the list is still full, and the surrendered slots went to other modules…
    expect(top).toHaveLength(10);
    expect(new Set(top.map((t) => t.agent)).size).toBeGreaterThan(1);
    // …even though those replacements score strictly lower. The cap changes the
    // selection only — it never distorts a score to reshape the list.
    const dropped = roadmap.tasks.filter((t) => t.id.startsWith("seo-ctr-") && !top.includes(t));
    const backfilled = top.filter((t) => !t.id.startsWith("seo-ctr-"));
    expect(Math.min(...dropped.map((t) => t.score))).toBeGreaterThan(
      Math.max(...backfilled.map((t) => t.score))
    );
  });

  it("keeps top opportunities score-ordered despite the module cap", () => {
    const scores = buildRoadmap(richContext()).topOpportunities.map((t) => t.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("sums quantified upside across the roadmap", () => {
    const roadmap = buildRoadmap(richContext());
    const expected = roadmap.tasks.reduce((s, t) => s + (t.impactClicks ?? 0), 0);
    expect(roadmap.totalClickUpside).toBe(expected);
  });

  it("counts every task in exactly one module bucket", () => {
    const roadmap = buildRoadmap(richContext());
    const total = roadmap.byModule.reduce((s, m) => s + m.count, 0);
    expect(total).toBe(roadmap.tasks.length);
  });

  it("returns an empty roadmap for a context with no signals", () => {
    const roadmap = buildRoadmap(makeContext({ now: NOW }));
    expect(roadmap.tasks).toHaveLength(0);
    expect(roadmap.totalClickUpside).toBe(0);
  });
});

describe("SEO reports", () => {
  it("reports all three cadences", () => {
    const r = analyseSeo(richContext());
    expect(r.daily.date).toBe("2026-07-16");
    expect(r.weekly.period).toBe("2026-07-09 → 2026-07-16");
    expect(r.monthly.period).toBe("2026-06-16 → 2026-07-16");
  });

  it("leads the daily headline with critical issues when they exist", () => {
    const r = analyseSeo(richContext());
    if (r.roadmap.criticalIssues.length > 0) {
      expect(r.daily.headline).toMatch(/critical/i);
    } else {
      expect(r.daily.headline).toBeTruthy();
    }
  });

  it("says so plainly when there is nothing to do", () => {
    expect(analyseSeo(makeContext({ now: NOW })).daily.headline).toMatch(/no seo opportunities/i);
  });

  it("splits keyword movement into gaining and losing", () => {
    const ctx = makeContext({
      now: NOW,
      queries: [
        query({ query: "down", positionDelta: 4, impressions: 5_000 }),
        query({ query: "up", positionDelta: -4, impressions: 5_000 }),
      ],
    });
    const { keywordMovement } = analyseSeo(ctx).daily;
    expect(keywordMovement.losing.map((k) => k.query)).toContain("down");
    expect(keywordMovement.gaining.map((k) => k.query)).toContain("up");
  });

  it("carries the sample-data flag through from the providers", () => {
    expect(analyseSeo(richContext()).noneLive).toBe(true);
  });

  it("exposes cluster health on the weekly and monthly reports", () => {
    const r = analyseSeo(richContext());
    expect(r.weekly.clusterHealth.length).toBeGreaterThan(0);
    expect(r.monthly.clusterHealth).toEqual(r.weekly.clusterHealth);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(analyseSeo(richContext()))).toBe(
      JSON.stringify(analyseSeo(richContext()))
    );
  });
});

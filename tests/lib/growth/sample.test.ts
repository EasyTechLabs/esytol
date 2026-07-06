// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  sampleSearchConsole,
  sampleAnalytics,
  sampleClarity,
  sampleGitHub,
  sampleVercel,
} from "@/lib/growth/sample";

const NOW = new Date("2026-07-06T10:00:00Z");

describe("sample datasets", () => {
  it("Search Console derives real page paths and consistent totals", () => {
    const d = sampleSearchConsole(NOW);
    expect(d.topPages.length).toBeGreaterThan(0);
    expect(d.topQueries.length).toBeGreaterThan(0);
    // real site URLs
    expect(d.topPages.some((p) => p.page.startsWith("/tools/"))).toBe(true);
    // ctr and position are in sane ranges
    for (const p of d.topPages) {
      expect(p.ctr).toBeGreaterThanOrEqual(0);
      expect(p.ctr).toBeLessThanOrEqual(1);
      expect(p.position).toBeGreaterThan(0);
      expect(p.clicks).toBeLessThanOrEqual(p.impressions);
    }
    expect(d.totals.impressions).toBeGreaterThan(0);
    expect(d.sitemap.submitted).toBeGreaterThan(0);
  });

  it("top pages are sorted by impressions descending", () => {
    const d = sampleSearchConsole(NOW);
    for (let i = 1; i < d.topPages.length; i++) {
      expect(d.topPages[i - 1].impressions).toBeGreaterThanOrEqual(d.topPages[i].impressions);
    }
  });

  it("Analytics distributions sum sensibly and include mobile-first devices", () => {
    const d = sampleAnalytics(NOW);
    expect(d.topPages.length).toBeGreaterThan(0);
    expect(d.devices[0].label).toBe("Mobile");
    expect(d.countries[0].label).toBe("India");
    expect(d.conversions).toEqual([]); // future-ready
    expect(d.sources.reduce((s, x) => s + x.value, 0)).toBeGreaterThan(0);
  });

  it("Clarity, GitHub and Vercel samples are well-formed", () => {
    expect(sampleClarity(NOW).scrollByPage.length).toBeGreaterThan(0);
    const gh = sampleGitHub(NOW);
    expect(gh.commits.length).toBeGreaterThan(0);
    expect(gh.releases.length).toBeGreaterThan(0);
    expect(gh.repo).toContain("/");
    const v = sampleVercel(NOW);
    expect(v.builds.length).toBeGreaterThan(0);
    expect(v.performance.length).toBe(4);
    expect(v.productionUrl).toMatch(/^https:\/\//);
  });

  it("is deterministic for a fixed 'now'", () => {
    const a = sampleSearchConsole(NOW);
    const b = sampleSearchConsole(NOW);
    expect(a.totals.impressions).toBe(b.totals.impressions);
    expect(a.topPages[0].page).toBe(b.topPages[0].page);
  });
});

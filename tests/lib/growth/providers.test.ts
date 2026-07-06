// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getGrowthData, providerRegistry } from "@/lib/growth";
import { fetchGitHub } from "@/lib/growth/providers";

const NOW = new Date("2026-07-06T10:00:00Z");

describe("providers + aggregator (no credentials → sample)", () => {
  it("every provider falls back to sample with a connect note", async () => {
    const gh = await fetchGitHub(NOW);
    expect(gh.status).toBe("sample");
    expect(gh.note).toMatch(/GITHUB_TOKEN/);
    expect(gh.data.commits.length).toBeGreaterThan(0);
    expect(gh.fetchedAt).toBe(NOW.toISOString());
  });

  it("getGrowthData aggregates all providers and computes insights", async () => {
    const d = await getGrowthData(NOW);
    expect(d.allSample).toBe(true);
    expect(d.searchConsole.status).toBe("sample");
    expect(d.analytics.status).toBe("sample");
    expect(d.clarity.status).toBe("sample");
    expect(d.github.status).toBe("sample");
    expect(d.vercel.status).toBe("sample");
    expect(d.insights.length).toBeGreaterThan(0);
    expect(d.generatedAt).toBe(NOW.toISOString());
  });

  it("is deterministic across calls with the same 'now'", async () => {
    const a = await getGrowthData(NOW);
    const b = await getGrowthData(NOW);
    expect(a.searchConsole.data.totals.impressions).toBe(b.searchConsole.data.totals.impressions);
    expect(a.insights.map((i) => i.id)).toEqual(b.insights.map((i) => i.id));
  });

  it("provider registry lists connected + future-ready providers", () => {
    const reg = providerRegistry();
    const keys = reg.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining(["search-console", "analytics", "clarity", "github", "vercel"])
    );
    // future-ready providers are marked planned
    expect(reg.find((r) => r.key === "bing")?.planned).toBe(true);
    expect(reg.find((r) => r.key === "adsense")?.planned).toBe(true);
    // none configured in a clean env
    expect(reg.every((r) => r.configured === false)).toBe(true);
  });
});

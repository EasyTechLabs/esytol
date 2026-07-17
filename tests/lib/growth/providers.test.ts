// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getGrowthData, providerRegistry } from "@/lib/growth";
import { fetchGitHub } from "@/lib/growth/providers";

const NOW = new Date("2026-07-06T10:00:00Z");

describe("providers + aggregator (no credentials → honest empty, P0-3)", () => {
  it("an unconfigured provider returns EMPTY data with a connect note — never fake values", async () => {
    const gh = await fetchGitHub(NOW);
    expect(gh.status).toBe("unconfigured");
    expect(gh.note).toMatch(/GITHUB_TOKEN/);
    expect(gh.data.commits).toEqual([]);
    expect(gh.fetchedAt).toBe(NOW.toISOString());
  });

  it("getGrowthData reports noneLive and empty datasets with nothing configured", async () => {
    const d = await getGrowthData(NOW);
    expect(d.noneLive).toBe(true);
    for (const p of [d.searchConsole, d.analytics, d.clarity, d.github, d.vercel]) {
      expect(p.status).toBe("unconfigured");
      expect(p.note).toBeTruthy();
    }
    // The old behaviour fabricated plausible metrics here. Zeros are the contract.
    expect(d.searchConsole.data.totals.clicks).toBe(0);
    expect(d.analytics.data.totals.users).toBe(0);
    expect(d.clarity.data.sessions).toBe(0);
    expect(Array.isArray(d.insights)).toBe(true);
    expect(d.generatedAt).toBe(NOW.toISOString());
  });

  it("provider registry lists connected + future-ready providers", () => {
    const reg = providerRegistry();
    const keys = reg.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining(["search-console", "analytics", "clarity", "github", "vercel"])
    );
    expect(reg.find((r) => r.key === "bing")?.planned).toBe(true);
    expect(reg.find((r) => r.key === "adsense")?.planned).toBe(true);
    expect(reg.every((r) => r.configured === false)).toBe(true);
  });
});

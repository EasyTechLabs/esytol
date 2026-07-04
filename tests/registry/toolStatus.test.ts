import { describe, it, expect } from "vitest";
import {
  toolRegistry,
  isToolLive,
  getLiveTools,
  getLiveToolCount,
  getToolBySlug,
} from "@/registry";
import sitemap from "@/app/sitemap";

// Tools that are registered/listed but not yet implemented.
const COMING_SOON_SLUGS = [
  "json-formatter",
  "base64-encoder",
  "url-encoder",
  "word-counter",
  "case-converter",
  "lorem-ipsum",
  "password-generator",
  "hash-generator",
  "uuid-generator",
];

// Fully implemented, interactive calculators.
const LIVE_SLUGS = [
  "emi-calculator",
  "gst-calculator",
  "sip-calculator",
  "fd-calculator",
  "rd-calculator",
  "ppf-calculator",
  "cagr-calculator",
  "lumpsum-calculator",
  "home-loan-calculator",
  "personal-loan-calculator",
];

describe("tool status — placeholder handling", () => {
  it("all coming-soon tools are marked status: 'coming-soon'", () => {
    for (const slug of COMING_SOON_SLUGS) {
      const tool = getToolBySlug(slug);
      expect(tool, `missing tool ${slug}`).toBeDefined();
      expect(tool!.status).toBe("coming-soon");
      expect(isToolLive(tool!)).toBe(false);
    }
  });

  it("all calculator tools are live (status omitted or 'live')", () => {
    for (const slug of LIVE_SLUGS) {
      const tool = getToolBySlug(slug);
      expect(tool, `missing tool ${slug}`).toBeDefined();
      expect(tool!.status).not.toBe("coming-soon");
      expect(isToolLive(tool!)).toBe(true);
    }
  });

  it("getLiveTools excludes every coming-soon tool", () => {
    const liveSlugs = new Set(getLiveTools().map((t) => t.slug));
    for (const slug of COMING_SOON_SLUGS) {
      expect(liveSlugs.has(slug)).toBe(false);
    }
    for (const slug of LIVE_SLUGS) {
      expect(liveSlugs.has(slug)).toBe(true);
    }
  });

  it("getLiveToolCount equals registry length minus coming-soon count", () => {
    const comingSoon = toolRegistry.filter((t) => t.status === "coming-soon").length;
    expect(getLiveToolCount()).toBe(toolRegistry.length - comingSoon);
    expect(getLiveToolCount()).toBe(LIVE_SLUGS.length);
  });
});

describe("sitemap — coming-soon exclusion", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("includes every live tool URL", () => {
    for (const slug of LIVE_SLUGS) {
      expect(urls.some((u) => u.endsWith(`/tools/${slug}`))).toBe(true);
    }
  });

  it("excludes every coming-soon tool URL", () => {
    for (const slug of COMING_SOON_SLUGS) {
      expect(urls.some((u) => u.endsWith(`/tools/${slug}`))).toBe(false);
    }
  });

  it("still includes core static routes", () => {
    expect(urls.some((u) => u.endsWith("/tools"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/categories"))).toBe(true);
  });
});

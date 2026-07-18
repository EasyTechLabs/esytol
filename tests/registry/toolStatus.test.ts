import { describe, it, expect } from "vitest";
import {
  toolRegistry,
  isToolLive,
  getLiveTools,
  getLiveToolCount,
  getLiveCategories,
  getToolBySlug,
  getFeaturedTools,
  getPopularTools,
  getNewTools,
} from "@/registry";
import sitemap from "@/app/sitemap";

// Tools that are registered/listed but not yet implemented.
const COMING_SOON_SLUGS = [
  // json-formatter, base64-encoder, url-encoder went live in PLATFORM-003.
  // word-counter, case-converter went live in PLATFORM-004.
  "lorem-ipsum",
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
  "income-tax-calculator",
  "hra-calculator",
  "epf-calculator",
  "gratuity-calculator",
  "nps-calculator",
  "age-calculator",
  "financial-roadmap",
  "financial-dashboard",
  // Developer category (PLATFORM-003) — the platform's second first-class category.
  "json-formatter",
  "base64-encoder",
  "url-encoder",
  // Everyday category foundation (PLATFORM-004).
  "word-counter",
  "case-converter",
  // Security category — first interactive tool.
  "password-generator",
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

describe("live-only listing surfaces", () => {
  it("getLiveCategories returns only categories that contain a live tool", () => {
    const live = getLiveCategories();
    const liveToolCategories = new Set(getLiveTools().map((t) => t.category));
    // Every returned category must contain at least one live tool.
    for (const cat of live) {
      expect(liveToolCategories.has(cat.slug)).toBe(true);
    }
    // Finance (calculator) remains live, and PLATFORM-003 added the Developer
    // category — the platform now surfaces more than one live format category.
    const slugs = live.map((c) => c.slug);
    expect(slugs).toContain("calculator");
    expect(slugs).toContain("developer"); // json-formatter
    expect(slugs).toContain("encoder"); // base64 + url
  });

  it("featured / popular / new getters never return coming-soon tools", () => {
    for (const tool of [...getFeaturedTools(), ...getPopularTools(), ...getNewTools()]) {
      expect(tool.status).not.toBe("coming-soon");
      expect(isToolLive(tool)).toBe(true);
    }
  });

  it("Recently Added (new) surfaces real live tools", () => {
    const newTools = getNewTools();
    expect(newTools.length).toBeGreaterThan(0);
    // Live only — across any category now that Developer is live (PLATFORM-003).
    expect(newTools.every((t) => isToolLive(t))).toBe(true);
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

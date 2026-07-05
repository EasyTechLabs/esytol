import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/config/site";
import { toolRegistry, getLiveTools, getLiveCategories } from "@/registry";
import { categories } from "@/registry/categories";

describe("sitemap", () => {
  const entries = sitemap();

  it("returns an array", () => {
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("includes the home route at priority 1.0", () => {
    const home = entries.find((e) => e.url === siteConfig.url);
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1.0);
  });

  it("includes /tools route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/tools`)).toBe(true);
  });

  it("includes /categories route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/categories`)).toBe(true);
  });

  it("includes /popular route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/popular`)).toBe(true);
  });

  it("includes /new route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/new`)).toBe(true);
  });

  it("includes /about route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/about`)).toBe(true);
  });

  it("includes /privacy route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/privacy`)).toBe(true);
  });

  it("includes /terms route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/terms`)).toBe(true);
  });

  it("includes every live tool from the registry", () => {
    for (const tool of getLiveTools()) {
      const found = entries.some((e) => e.url === `${siteConfig.url}${tool.url}`);
      expect(found, `Missing tool route: ${tool.url}`).toBe(true);
    }
  });

  it("excludes coming-soon tools", () => {
    const comingSoon = toolRegistry.filter((t) => t.status === "coming-soon");
    expect(comingSoon.length).toBeGreaterThan(0);
    for (const tool of comingSoon) {
      const found = entries.some((e) => e.url === `${siteConfig.url}${tool.url}`);
      expect(found, `Coming-soon tool must not be in sitemap: ${tool.url}`).toBe(false);
    }
  });

  it("includes every live category", () => {
    for (const cat of getLiveCategories()) {
      const found = entries.some((e) => e.url === `${siteConfig.url}/categories/${cat.slug}`);
      expect(found, `Missing category route: /categories/${cat.slug}`).toBe(true);
    }
  });

  it("excludes categories with no live tools", () => {
    const liveSlugs = new Set(getLiveCategories().map((c) => c.slug));
    const emptyCats = categories.filter((c) => !liveSlugs.has(c.slug));
    expect(emptyCats.length).toBeGreaterThan(0);
    for (const cat of emptyCats) {
      const found = entries.some((e) => e.url === `${siteConfig.url}/categories/${cat.slug}`);
      expect(found, `Empty category must not be in sitemap: ${cat.slug}`).toBe(false);
    }
  });

  it("includes the contact route", () => {
    expect(entries.some((e) => e.url === `${siteConfig.url}/contact`)).toBe(true);
  });

  it("all URLs start with the site base URL", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(siteConfig.url)).toBe(true);
    }
  });

  it("all entries have a lastModified Date", () => {
    for (const entry of entries) {
      expect(entry.lastModified instanceof Date).toBe(true);
    }
  });

  it("has no duplicate URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

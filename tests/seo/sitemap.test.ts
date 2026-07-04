import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/config/site";
import { toolRegistry } from "@/registry";
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

  it("includes every tool from the registry", () => {
    for (const tool of toolRegistry) {
      const found = entries.some((e) => e.url === `${siteConfig.url}${tool.url}`);
      expect(found, `Missing tool route: ${tool.url}`).toBe(true);
    }
  });

  it("includes every category", () => {
    for (const cat of categories) {
      const found = entries.some((e) => e.url === `${siteConfig.url}/categories/${cat.slug}`);
      expect(found, `Missing category route: /categories/${cat.slug}`).toBe(true);
    }
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

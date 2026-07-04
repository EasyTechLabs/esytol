import { describe, it, expect } from "vitest";
import { toolRegistry, getToolBySlug } from "@/registry";
import { categories } from "@/registry/categories";
import { mainNav, footerNav } from "@/config/nav";
import type { CategorySlug } from "@/types/category";

describe("route integrity", () => {
  it("every tool has a unique id", () => {
    const ids = toolRegistry.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every tool has a unique slug", () => {
    const slugs = toolRegistry.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every tool URL follows the /tools/<slug> pattern", () => {
    for (const tool of toolRegistry) {
      expect(tool.url).toBe(`/tools/${tool.slug}`);
    }
  });

  it("every tool category exists in the category list", () => {
    const validSlugs = new Set<CategorySlug>(categories.map((c) => c.slug));
    for (const tool of toolRegistry) {
      expect(validSlugs.has(tool.category), `Unknown category: ${tool.category}`).toBe(true);
    }
  });

  it("getToolBySlug resolves every registered slug (O(1) Map path)", () => {
    for (const tool of toolRegistry) {
      expect(getToolBySlug(tool.slug)).toEqual(tool);
    }
  });

  it("getToolBySlug returns undefined for unknown slugs", () => {
    expect(getToolBySlug("does-not-exist")).toBeUndefined();
  });

  it("all main nav hrefs are known application routes", () => {
    const knownRoutes = new Set([
      "/",
      "/tools",
      "/categories",
      "/popular",
      "/new",
      "/about",
      "/blog",
      "/privacy",
      "/terms",
    ]);
    for (const item of mainNav) {
      expect(knownRoutes.has(item.href), `Unknown nav href: ${item.href}`).toBe(true);
    }
  });

  it("all footer tool links reference valid category slugs", () => {
    const validSlugs = new Set<string>(categories.map((c) => c.slug));
    for (const item of footerNav.tools) {
      const slug = item.href.replace("/categories/", "");
      expect(validSlugs.has(slug), `Invalid category slug in footer: ${slug}`).toBe(true);
    }
  });

  it("all footer company links reference known routes", () => {
    const knownRoutes = new Set(["/about", "/blog", "/privacy", "/terms"]);
    for (const item of footerNav.company) {
      expect(knownRoutes.has(item.href), `Unknown company link: ${item.href}`).toBe(true);
    }
  });
});

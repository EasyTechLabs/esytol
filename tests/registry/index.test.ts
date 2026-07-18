import { describe, it, expect } from "vitest";
import {
  toolRegistry,
  getTools,
  getFeaturedTools,
  getPopularTools,
  getNewTools,
  getToolBySlug,
  getToolCount,
} from "@/registry";

describe("toolRegistry", () => {
  it("contains at least one tool", () => {
    expect(toolRegistry.length).toBeGreaterThan(0);
  });

  it("every tool has required fields", () => {
    for (const tool of toolRegistry) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.slug).toBeTruthy();
      expect(tool.url).toBeTruthy();
      expect(tool.category).toBeTruthy();
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = toolRegistry.map((t) => t.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });
});

describe("getTools()", () => {
  it("returns all tools when no filter is given", () => {
    expect(getTools().length).toBe(toolRegistry.length);
  });

  it("filters by category", () => {
    const devTools = getTools({ category: "developer" });
    expect(devTools.every((t) => t.category === "developer")).toBe(true);
  });

  it("filters by query (name match)", () => {
    const results = getTools({ query: "json" });
    expect(results.some((t) => t.name.toLowerCase().includes("json"))).toBe(true);
  });
});

describe("getFeaturedTools()", () => {
  it("returns only featured tools", () => {
    const tools = getFeaturedTools();
    expect(tools.every((t) => t.featured === true)).toBe(true);
  });
});

describe("getPopularTools()", () => {
  it("returns only popular tools", () => {
    const tools = getPopularTools();
    expect(tools.every((t) => t.popular === true)).toBe(true);
  });
});

describe("getNewTools()", () => {
  it("returns only new tools", () => {
    const tools = getNewTools();
    expect(tools.every((t) => t.isNew === true)).toBe(true);
  });
});

describe("getToolBySlug()", () => {
  it("finds an existing tool", () => {
    const tool = getToolBySlug("json-formatter");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("JSON Formatter & Validator");
  });

  it("returns undefined for a missing slug", () => {
    expect(getToolBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("getToolCount()", () => {
  it("matches registry length", () => {
    expect(getToolCount()).toBe(toolRegistry.length);
  });
});

describe("tool framework fields", () => {
  it("every tool has a version string", () => {
    for (const tool of toolRegistry) {
      expect(typeof tool.version).toBe("string");
      expect(tool.version!.length).toBeGreaterThan(0);
    }
  });

  it("every tool has a lastUpdated string", () => {
    for (const tool of toolRegistry) {
      expect(typeof tool.lastUpdated).toBe("string");
      expect(tool.lastUpdated!.length).toBeGreaterThan(0);
    }
  });

  it("every tool has keywords array with at least one entry", () => {
    for (const tool of toolRegistry) {
      expect(Array.isArray(tool.keywords)).toBe(true);
      expect(tool.keywords!.length).toBeGreaterThan(0);
    }
  });

  it("every tool has at least one FAQ item with non-empty question and answer", () => {
    for (const tool of toolRegistry) {
      expect(Array.isArray(tool.faq)).toBe(true);
      expect(tool.faq!.length).toBeGreaterThan(0);
      for (const item of tool.faq!) {
        expect(item.question.trim().length).toBeGreaterThan(0);
        expect(item.answer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("every relatedTools entry references a valid registry slug", () => {
    const slugs = new Set(toolRegistry.map((t) => t.slug));
    for (const tool of toolRegistry) {
      for (const rel of tool.relatedTools ?? []) {
        expect(slugs.has(rel), `${tool.slug} references unknown relatedTool: ${rel}`).toBe(true);
      }
    }
  });
});

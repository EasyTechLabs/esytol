/**
 * Related-tools & internal-link engine tests (PLATFORM-006).
 */

import { describe, it, expect } from "vitest";
import { getRelatedTools, getAdjacentTools, getToolBySlug, getLiveTools } from "@/registry";
import { collectionPageSchema } from "@/seo/jsonld";
import type { Tool } from "@/types/tool";

describe("getRelatedTools", () => {
  it("honours curated relatedTools first (author intent wins)", () => {
    const jsonFormatter = getToolBySlug("json-formatter")!;
    const related = getRelatedTools(jsonFormatter, 5).map((t) => t.slug);
    // Its curated list is surfaced (all live curated entries appear before derived fillers).
    const curatedLive = (jsonFormatter.relatedTools ?? []).filter((s) => getToolBySlug(s));
    for (const slug of curatedLive.slice(0, 5)) expect(related).toContain(slug);
  });

  it("fills up to the limit and never includes the tool itself", () => {
    for (const tool of getLiveTools()) {
      const related = getRelatedTools(tool, 5);
      expect(related.length).toBe(5); // 36 live tools → always fillable
      expect(related.map((t) => t.slug)).not.toContain(tool.slug);
      expect(new Set(related.map((t) => t.slug)).size).toBe(related.length); // no dupes
    }
  });

  it("derives related tools from shared tags when none are curated", () => {
    const bare: Tool = {
      id: "x",
      name: "Test JSON Thing",
      slug: "test-json-thing",
      description: "A test tool with no curated related list.",
      category: "developer",
      tags: ["json", "developer"],
      icon: "🧪",
      url: "/tools/test-json-thing",
    };
    const related = getRelatedTools(bare, 3).map((t) => t.slug);
    // JSON-tagged developer tools should surface.
    expect(related.some((s) => s.includes("json"))).toBe(true);
  });
});

describe("getAdjacentTools", () => {
  it("returns previous and next within the same category, wrapping at the ends", () => {
    const devTools = getLiveTools().filter((t) => t.category === "developer");
    if (devTools.length >= 2) {
      const { previous, next } = getAdjacentTools(devTools[0]);
      expect(previous).not.toBeNull();
      expect(next).not.toBeNull();
      expect(previous!.slug).not.toBe(devTools[0].slug);
      expect(next!.slug).not.toBe(devTools[0].slug);
    }
  });
});

describe("collectionPageSchema", () => {
  it("produces a CollectionPage wrapping an ordered ItemList", () => {
    const schema = collectionPageSchema({
      name: "Developer Tools",
      description: "desc",
      url: "https://esytol.com/categories/developer",
      items: [
        { name: "A", url: "https://esytol.com/tools/a" },
        { name: "B", url: "https://esytol.com/tools/b" },
      ],
    }) as {
      "@type": string;
      mainEntity: {
        "@type": string;
        numberOfItems: number;
        itemListElement: { position: number }[];
      };
    };
    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.mainEntity["@type"]).toBe("ItemList");
    expect(schema.mainEntity.numberOfItems).toBe(2);
    expect(schema.mainEntity.itemListElement[0].position).toBe(1);
    expect(schema.mainEntity.itemListElement[1].position).toBe(2);
  });
});

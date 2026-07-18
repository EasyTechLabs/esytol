/**
 * Global search engine tests (PLATFORM-006).
 *
 * The engine auto-indexes the live registry, so these tests double as a guarantee that the whole
 * catalogue is discoverable: every live tool must be findable by its own name.
 */

import { describe, it, expect } from "vitest";
import { searchTools, searchToolList, fuzzySubsequence } from "@/lib/search/toolSearch";
import { getLiveTools } from "@/registry";
import type { Tool } from "@/types/tool";

const sample: Tool[] = [
  {
    id: "json-formatter",
    name: "JSON Formatter & Validator",
    slug: "json-formatter",
    description: "Format, validate and beautify JSON in your browser.",
    category: "developer",
    tags: ["json", "formatter", "developer"],
    keywords: ["json beautifier", "pretty print json"],
    aliases: ["json beautify", "json prettify"],
    icon: "🧩",
    url: "/tools/json-formatter",
  },
  {
    id: "csv-json-converter",
    name: "CSV ↔ JSON Converter",
    slug: "csv-json-converter",
    description: "Convert between CSV and JSON.",
    category: "developer",
    tags: ["csv", "json", "developer"],
    keywords: ["csv to json", "json to csv"],
    icon: "🧮",
    url: "/tools/csv-json-converter",
  },
  {
    id: "password-generator",
    name: "Password Generator",
    slug: "password-generator",
    description: "Generate strong random passwords.",
    category: "security",
    tags: ["password", "security", "generator"],
    keywords: ["strong password", "random password"],
    icon: "🔐",
    url: "/tools/password-generator",
  },
];

describe("fuzzySubsequence", () => {
  it("matches characters in order", () => {
    expect(fuzzySubsequence("jsn", "json")).toBe(true);
    expect(fuzzySubsequence("json", "json")).toBe(true);
    expect(fuzzySubsequence("", "anything")).toBe(true);
    expect(fuzzySubsequence("xyz", "json")).toBe(false);
    expect(fuzzySubsequence("noj", "json")).toBe(false); // order matters
  });
});

describe("searchTools", () => {
  it("ranks an exact name match first", () => {
    const r = searchTools("password generator", sample);
    expect(r[0].tool.slug).toBe("password-generator");
  });

  it("finds by keyword and alias", () => {
    expect(searchToolList("beautify", 5, sample).map((t) => t.slug)).toContain("json-formatter");
    expect(searchToolList("prettify", 5, sample).map((t) => t.slug)).toContain("json-formatter");
  });

  it("finds by tag and category", () => {
    const dev = searchToolList("developer", 5, sample).map((t) => t.slug);
    expect(dev).toContain("json-formatter");
    expect(dev).toContain("csv-json-converter");
    expect(dev).not.toContain("password-generator");
  });

  it("is AND-ish for multi-word queries", () => {
    const r = searchToolList("json csv", 5, sample);
    expect(r[0].slug).toBe("csv-json-converter"); // matches both words best
  });

  it("tolerates a small typo via subsequence on the name", () => {
    expect(searchToolList("passwrd", 5, sample).map((t) => t.slug)).toContain("password-generator");
  });

  it("returns nothing for an empty or unmatched query", () => {
    expect(searchTools("", sample)).toEqual([]);
    expect(searchTools("zzzznomatch", sample)).toEqual([]);
  });
});

describe("catalogue discoverability (auto-index guarantee)", () => {
  it("finds every live tool by its own exact name", () => {
    const live = getLiveTools();
    for (const tool of live) {
      const top = searchToolList(tool.name, 3).map((t) => t.slug);
      expect(top, `search for "${tool.name}"`).toContain(tool.slug);
    }
  });
});

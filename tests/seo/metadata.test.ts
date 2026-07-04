import { describe, it, expect } from "vitest";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

describe("buildMetadata", () => {
  it("returns site name as title when no title given", () => {
    const meta = buildMetadata();
    expect(meta.title).toBe(siteConfig.name);
  });

  it("formats title with em-dash separator", () => {
    const meta = buildMetadata({ title: "JSON Formatter" });
    expect(meta.title).toBe(`JSON Formatter — ${siteConfig.name}`);
  });

  it("uses siteConfig description by default", () => {
    const meta = buildMetadata();
    expect(meta.description).toBe(siteConfig.description);
  });

  it("overrides description when provided", () => {
    const meta = buildMetadata({ description: "Custom desc" });
    expect(meta.description).toBe("Custom desc");
  });

  it("sets canonical URL including the given path", () => {
    const meta = buildMetadata({ path: "/tools/json-formatter" });
    expect(meta.alternates?.canonical).toBe(`${siteConfig.url}/tools/json-formatter`);
  });

  it("defaults canonical to home", () => {
    const meta = buildMetadata();
    expect(meta.alternates?.canonical).toBe(`${siteConfig.url}/`);
  });

  it("sets noIndex when noIndex is true", () => {
    const meta = buildMetadata({ noIndex: true });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("allows indexing by default", () => {
    const meta = buildMetadata();
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("returns keywords as a mutable string array", () => {
    const meta = buildMetadata();
    expect(Array.isArray(meta.keywords)).toBe(true);
    expect((meta.keywords as string[]).length).toBeGreaterThan(0);
  });

  it("sets OG image", () => {
    const meta = buildMetadata();
    const images = meta.openGraph?.images as { url: string }[];
    expect(images?.[0]?.url).toBeDefined();
  });

  it("includes Twitter metadata with images", () => {
    const meta = buildMetadata();
    expect(meta.twitter).toBeDefined();
    // card is set in buildMetadata; access via cast since Next.js Twitter type is a union
    expect((meta.twitter as Record<string, unknown>)?.card).toBe("summary_large_image");
  });

  it("sets metadataBase to site URL", () => {
    const meta = buildMetadata();
    expect(meta.metadataBase?.toString()).toContain("esytol");
  });

  it("merges additional keywords with site keywords", () => {
    const meta = buildMetadata({ keywords: ["extra-keyword"] });
    const kw = meta.keywords as string[];
    expect(kw).toContain("extra-keyword");
    expect(kw.length).toBeGreaterThan(siteConfig.keywords.length);
  });

  it("uses only site keywords when no extra keywords provided", () => {
    const meta = buildMetadata();
    const kw = meta.keywords as string[];
    expect(kw).toEqual([...siteConfig.keywords]);
  });
});

describe("buildToolMetadata", () => {
  it("is accessible from seo/metadata", async () => {
    const { buildToolMetadata } = await import("@/seo/metadata");
    expect(typeof buildToolMetadata).toBe("function");
  });

  it("formats title as [Tool Name] — Esytol", async () => {
    const { buildToolMetadata } = await import("@/seo/metadata");
    const tool = {
      id: "test",
      name: "JSON Formatter",
      slug: "json-formatter",
      description: "Format JSON",
      category: "developer" as const,
      tags: [],
      icon: "📋",
      url: "/tools/json-formatter",
    };
    const meta = buildToolMetadata(tool);
    expect(meta.title).toBe(`JSON Formatter — ${siteConfig.name}`);
  });

  it("sets canonical to /tools/[slug]", async () => {
    const { buildToolMetadata } = await import("@/seo/metadata");
    const tool = {
      id: "test",
      name: "JSON Formatter",
      slug: "json-formatter",
      description: "Format JSON",
      category: "developer" as const,
      tags: [],
      icon: "📋",
      url: "/tools/json-formatter",
    };
    const meta = buildToolMetadata(tool);
    expect(meta.alternates?.canonical).toBe(`${siteConfig.url}/tools/json-formatter`);
  });

  it("merges tool keywords into the keywords list", async () => {
    const { buildToolMetadata } = await import("@/seo/metadata");
    const tool = {
      id: "test",
      name: "JSON Formatter",
      slug: "json-formatter",
      description: "Format JSON",
      category: "developer" as const,
      tags: [],
      keywords: ["json formatter online"],
      icon: "📋",
      url: "/tools/json-formatter",
    };
    const meta = buildToolMetadata(tool);
    const kw = meta.keywords as string[];
    expect(kw).toContain("json formatter online");
    expect(kw).toContain("online tools");
  });

  it("sets OpenGraph title and url for the tool", async () => {
    const { buildToolMetadata } = await import("@/seo/metadata");
    const tool = {
      id: "test",
      name: "JSON Formatter",
      slug: "json-formatter",
      description: "Format JSON",
      category: "developer" as const,
      tags: [],
      icon: "📋",
      url: "/tools/json-formatter",
    };
    const meta = buildToolMetadata(tool);
    const og = meta.openGraph;
    expect((og as { title: string }).title).toBe(`JSON Formatter — ${siteConfig.name}`);
    expect((og as { url: string }).url).toContain("/tools/json-formatter");
  });
});

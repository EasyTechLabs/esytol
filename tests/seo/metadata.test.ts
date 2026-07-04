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
});

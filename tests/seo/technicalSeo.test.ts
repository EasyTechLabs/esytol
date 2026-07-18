/**
 * Technical-SEO guardrail suite (PLATFORM-006).
 *
 * This is the enforcement layer of the SEO platform: it holds EVERY live tool to the same SEO
 * contract, so a new tool cannot ship without inheriting it. If someone adds a tool with a duplicate
 * title, a missing FAQ, no related links, or a missing schema, CI fails here — that is what makes
 * "every future page inherits world-class SEO" a guarantee rather than a hope.
 */

import { describe, it, expect } from "vitest";
import { getLiveTools, getRelatedTools, getAdjacentTools } from "@/registry";
import { domainForTool } from "@/registry/domains";
import { buildToolMetadata } from "@/seo/metadata";
import { buildToolSchemas } from "@/seo/tool-seo";
import { searchToolList } from "@/lib/search/toolSearch";
import { siteConfig } from "@/config/site";
import sitemap from "@/app/sitemap";

const live = getLiveTools();
const sitemapUrls = new Set(sitemap().map((e) => e.url));

describe("every live tool inherits the SEO contract", () => {
  it.each(live.map((t) => [t.slug, t] as const))("%s — metadata & canonical", (_slug, tool) => {
    const meta = buildToolMetadata(tool);
    // Title present and site-suffixed.
    expect(String(meta.title)).toMatch(/— Esytol$/);
    // Canonical is the absolute tool URL.
    expect(meta.alternates?.canonical).toBe(`${siteConfig.url}/tools/${tool.slug}`);
    // Description present and non-thin.
    expect(meta.description, `${tool.slug} description`).toBeTruthy();
    expect(String(meta.description).length).toBeGreaterThanOrEqual(40);
    // Indexable (not accidentally noindex).
    expect(meta.robots).toMatchObject({ index: true });
  });

  it.each(live.map((t) => [t.slug, t] as const))(
    "%s — content & discoverability",
    (_slug, tool) => {
      // At least one FAQ (drives the FAQPage schema + long-tail SEO).
      expect(tool.faq?.length ?? 0, `${tool.slug} needs an FAQ`).toBeGreaterThan(0);
      // At least one keyword.
      expect(tool.keywords?.length ?? 0, `${tool.slug} needs keywords`).toBeGreaterThan(0);
      // Related links exist (metadata-driven — never an internal-linking orphan).
      expect(
        getRelatedTools(tool).length,
        `${tool.slug} needs related tools`
      ).toBeGreaterThanOrEqual(3);
      // Routes to a browse domain (not orphaned from navigation).
      expect(domainForTool(tool), `${tool.slug} must belong to a domain`).not.toBeNull();
      // Present in the sitemap.
      expect(
        sitemapUrls.has(`${siteConfig.url}${tool.url}`),
        `${tool.slug} missing from sitemap`
      ).toBe(true);
      // Findable in global search by its own name.
      expect(searchToolList(tool.name, 3).map((t) => t.slug)).toContain(tool.slug);
    }
  );

  it.each(live.map((t) => [t.slug, t] as const))("%s — structured data", (_slug, tool) => {
    const schemas = buildToolSchemas(tool) as { "@type": string }[];
    const types = schemas.map((s) => s["@type"]);
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("BreadcrumbList");
    if (tool.faq && tool.faq.length > 0) expect(types).toContain("FAQPage");
  });
});

describe("no duplicate metadata across tools", () => {
  it("titles are unique", () => {
    const titles = live.map((t) => t.name.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("descriptions are unique", () => {
    const descs = live.map((t) => t.description.trim().toLowerCase());
    const dupes = descs.filter((d, i) => descs.indexOf(d) !== i);
    expect(dupes, `duplicate descriptions: ${dupes.join(" | ")}`).toEqual([]);
  });

  it("slugs and urls are unique", () => {
    const slugs = live.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const urls = live.map((t) => t.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("internal-link graph has no dead ends", () => {
  it("every related/adjacent link points at a live tool", () => {
    const liveSlugs = new Set(live.map((t) => t.slug));
    for (const tool of live) {
      for (const rel of getRelatedTools(tool)) expect(liveSlugs.has(rel.slug)).toBe(true);
      const { previous, next } = getAdjacentTools(tool);
      if (previous) expect(liveSlugs.has(previous.slug)).toBe(true);
      if (next) expect(liveSlugs.has(next.slug)).toBe(true);
    }
  });

  it("related tools never include the tool itself", () => {
    for (const tool of live) {
      expect(getRelatedTools(tool).map((t) => t.slug)).not.toContain(tool.slug);
    }
  });
});

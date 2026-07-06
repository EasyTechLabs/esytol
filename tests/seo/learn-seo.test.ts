// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildArticleMetadata, buildArticleSchemas } from "@/seo/learn-seo";
import { getArticleBySlug, getArticleSlugs } from "@/lib/learn";
import { siteConfig } from "@/config/site";

const firstSlug = getArticleSlugs()[0];
const article = getArticleBySlug(firstSlug)!;

describe("buildArticleMetadata", () => {
  it("sets a single-branded title and the canonical Learn URL", () => {
    const meta = buildArticleMetadata(article);
    expect(typeof meta.title).toBe("string");
    expect(meta.title as string).toContain(article.frontmatter.title);
    expect(meta.title as string).toContain("Esytol");
    // no double-branding from the frontmatter metaTitle
    expect(meta.title as string).not.toContain("| Esytol");
    expect(meta.alternates?.canonical).toBe(`${siteConfig.url}/learn/${firstSlug}`);
  });

  it("indexable and carries the article keywords", () => {
    const meta = buildArticleMetadata(article);
    expect(meta.robots).toMatchObject({ index: true });
    expect(meta.keywords).toEqual(expect.arrayContaining(article.frontmatter.tags));
  });
});

describe("buildArticleSchemas", () => {
  it("emits Article + Breadcrumb (+ FAQ) with correct shape", () => {
    const schemas = buildArticleSchemas(article) as Array<Record<string, unknown>>;
    const types = schemas.map((s) => s["@type"]);
    expect(types).toContain("Article");
    expect(types).toContain("BreadcrumbList");

    const articleLd = schemas.find((s) => s["@type"] === "Article")!;
    expect(articleLd.headline).toBe(article.frontmatter.title);
    expect(articleLd.url).toBe(`${siteConfig.url}/learn/${firstSlug}`);

    const breadcrumb = schemas.find((s) => s["@type"] === "BreadcrumbList")! as {
      itemListElement: unknown[];
    };
    expect(breadcrumb.itemListElement).toHaveLength(3);
  });

  it("includes a FAQPage when the article has FAQs", () => {
    const schemas = buildArticleSchemas(article) as Array<Record<string, unknown>>;
    if (article.faqs.length > 0) {
      const faq = schemas.find((s) => s["@type"] === "FAQPage") as
        { mainEntity: unknown[] } | undefined;
      expect(faq).toBeDefined();
      expect(faq!.mainEntity.length).toBe(article.faqs.length);
    }
  });
});

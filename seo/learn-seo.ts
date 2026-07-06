import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "./metadata";
import { articleSchema, breadcrumbSchema, faqSchema } from "./jsonld";
import { categoryLabel, type Article } from "@/lib/learn";

/** Per-article metadata (canonical, OG, Twitter, keywords) via the shared builder. */
export function buildArticleMetadata(article: Article): Metadata {
  const fm = article.frontmatter;
  return buildMetadata({
    title: fm.title,
    description: fm.metaDescription,
    path: `/learn/${article.slug}`,
    keywords: fm.tags,
  });
}

/** JSON-LD graph for an article: Article + Breadcrumb + (FAQPage where available). */
export function buildArticleSchemas(article: Article): object[] {
  const fm = article.frontmatter;
  const url = `${siteConfig.url}/learn/${article.slug}`;

  const schemas: object[] = [
    articleSchema({
      title: fm.title,
      description: fm.metaDescription,
      url,
      datePublished: fm.lastUpdated || undefined,
      dateModified: fm.lastUpdated || undefined,
      author: fm.reviewedBy,
      section: categoryLabel(fm.category),
      keywords: fm.tags,
    }),
    breadcrumbSchema([
      { name: "Home", url: siteConfig.url },
      { name: "Learn", url: `${siteConfig.url}/learn` },
      { name: fm.title, url },
    ]),
  ];

  if (article.faqs.length > 0) {
    schemas.push(faqSchema(article.faqs));
  }

  return schemas;
}

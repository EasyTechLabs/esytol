import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getLiveTools, getLiveCategories } from "@/registry";
import { getAllArticles } from "@/lib/learn";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/tools`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/popular`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/new`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/learn`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Learn Center articles — indexable long-form content.
  const learnRoutes: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: `${base}/learn/${a.slug}`,
    lastModified: a.frontmatter.lastUpdated ? new Date(a.frontmatter.lastUpdated) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Only live tools are indexable — "coming-soon" placeholders are excluded to
  // avoid thin/placeholder content in search results.
  const toolRoutes: MetadataRoute.Sitemap = getLiveTools().map((tool) => ({
    url: `${base}${tool.url}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Only categories that contain live tools are indexable.
  const categoryRoutes: MetadataRoute.Sitemap = getLiveCategories().map((cat) => ({
    url: `${base}/categories/${cat.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...toolRoutes, ...categoryRoutes, ...learnRoutes];
}

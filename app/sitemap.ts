import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getLiveTools } from "@/registry";
import { categories } from "@/registry/categories";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/tools`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/popular`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/new`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Only live tools are indexable — "coming-soon" placeholders are excluded to
  // avoid thin/placeholder content in search results.
  const toolRoutes: MetadataRoute.Sitemap = getLiveTools().map((tool) => ({
    url: `${base}${tool.url}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${base}/categories/${cat.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...toolRoutes, ...categoryRoutes];
}

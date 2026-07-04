import type { OpenGraph } from "next/dist/lib/metadata/types/opengraph-types";
import { siteConfig } from "@/config/site";

export function toolOg(toolName: string, toolDescription: string): OpenGraph {
  return {
    title: `${toolName} — ${siteConfig.name}`,
    description: toolDescription,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${toolName} — ${siteConfig.name}`,
      },
    ],
    type: "website",
    locale: "en_US",
  };
}

export function categoryOg(categoryName: string): OpenGraph {
  return toolOg(
    `${categoryName} Tools`,
    `Free online ${categoryName.toLowerCase()} tools on ${siteConfig.name}.`
  );
}

import type { Tool } from "@/types/tool";
import { toolSchema, faqSchema, breadcrumbSchema } from "./jsonld";
import { siteConfig } from "@/config/site";

export function buildToolSchemas(tool: Tool): object[] {
  const schemas: object[] = [
    toolSchema(tool),
    breadcrumbSchema([
      { name: "Home", url: siteConfig.url },
      { name: "Tools", url: `${siteConfig.url}/tools` },
      { name: tool.name, url: `${siteConfig.url}${tool.url}` },
    ]),
  ];

  if (tool.faq && tool.faq.length > 0) {
    schemas.push(faqSchema(tool.faq));
  }

  return schemas;
}

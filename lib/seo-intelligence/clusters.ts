/**
 * Cluster definitions — the topical map of the product.
 *
 * A cluster is a *topic*, not a category slug: it spans tools and articles that
 * compete for the same search intent. Clusters are matched by tool tags/slugs and
 * article categories/tags, so this keeps working after the planned taxonomy
 * migration (calculator → finance/everyday domains).
 *
 * `expectedTopics` is the yardstick for coverage: what a complete cluster *should*
 * contain. Missing topics become content recommendations.
 */

import type { Tool } from "@/types/tool";
import type { Article } from "@/lib/learn";

export interface ClusterDef {
  key: string;
  label: string;
  /** Tool tags that place a tool in this cluster. */
  toolTags: string[];
  /** Article frontmatter categories that place an article in this cluster. */
  articleCategories: string[];
  /** What a complete cluster covers. Matched loosely against tool/article text. */
  expectedTopics: string[];
  /** Strategic weight (finance is transaction-adjacent → highest). */
  businessValue: number;
}

export const CLUSTERS: ClusterDef[] = [
  {
    key: "tax",
    label: "Tax",
    toolTags: ["tax", "income tax", "gst", "hra"],
    articleCategories: ["income-tax", "tax"],
    expectedTopics: [
      "income tax",
      "hra",
      "gst",
      "capital gains",
      "tds",
      "80c deductions",
      "advance tax",
    ],
    businessValue: 1,
  },
  {
    key: "retirement",
    label: "Retirement",
    toolTags: ["retirement", "epf", "nps", "gratuity", "pension"],
    articleCategories: ["retirement"],
    expectedTopics: ["epf", "nps", "gratuity", "ppf", "pension planning", "retirement corpus"],
    businessValue: 1,
  },
  {
    key: "loans",
    label: "Loans",
    toolTags: ["loan", "emi", "home loan", "mortgage"],
    articleCategories: ["loans"],
    expectedTopics: [
      "emi",
      "home loan",
      "personal loan",
      "car loan",
      "loan prepayment",
      "balance transfer",
    ],
    businessValue: 1,
  },
  {
    key: "investment",
    label: "Investment",
    toolTags: ["investment", "sip", "mutual fund", "fd", "rd", "cagr", "lumpsum"],
    articleCategories: ["investment", "investing"],
    expectedTopics: ["sip", "lumpsum", "fd", "rd", "cagr", "goal planning", "mutual funds"],
    businessValue: 0.9,
  },
  {
    key: "everyday",
    label: "Everyday",
    toolTags: ["everyday", "utility", "age", "date"],
    articleCategories: ["everyday"],
    expectedTopics: ["age", "date difference", "time duration", "unit conversion"],
    businessValue: 0.6,
  },
  {
    key: "developer",
    label: "Developer",
    toolTags: ["developer", "json", "encoder", "formatter", "regex"],
    articleCategories: ["developer"],
    expectedTopics: ["json formatter", "base64", "url encoder", "regex tester", "diff"],
    businessValue: 0.6,
  },
];

/** Loose text match — a topic is "covered" if any tool/article mentions it. */
function mentions(haystack: string, topic: string): boolean {
  const h = haystack.toLowerCase();
  return topic
    .toLowerCase()
    .split(" ")
    .every((word) => h.includes(word));
}

export function toolsInCluster(tools: Tool[], def: ClusterDef): Tool[] {
  return tools.filter((t) => {
    const tags = t.tags.map((x) => x.toLowerCase());
    if (def.toolTags.some((tag) => tags.includes(tag))) return true;
    // Fall back to name/slug so a tool without perfect tags still lands in a cluster.
    const text = `${t.name} ${t.slug}`.toLowerCase();
    return def.toolTags.some((tag) => text.includes(tag));
  });
}

export function articlesInCluster(articles: Article[], def: ClusterDef): Article[] {
  return articles.filter((a) => {
    const cat = (a.frontmatter.category || "").toLowerCase();
    if (def.articleCategories.includes(cat)) return true;
    const tags = (a.frontmatter.tags ?? []).map((x) => x.toLowerCase());
    return def.toolTags.some((tag) => tags.includes(tag));
  });
}

/** Which expected topics have no tool or article covering them. */
export function missingTopics(def: ClusterDef, tools: Tool[], articles: Article[]): string[] {
  const corpus = [
    ...tools.map((t) => `${t.name} ${t.slug} ${t.tags.join(" ")} ${(t.keywords ?? []).join(" ")}`),
    ...articles.map(
      (a) => `${a.frontmatter.title} ${a.slug} ${(a.frontmatter.tags ?? []).join(" ")}`
    ),
  ].join(" | ");
  return def.expectedTopics.filter((topic) => !mentions(corpus, topic));
}

/** Find the cluster a page belongs to, if any. */
export function clusterForPage(
  page: string,
  tools: Tool[],
  articles: Article[]
): ClusterDef | null {
  for (const def of CLUSTERS) {
    const toolHit = toolsInCluster(tools, def).some((t) => t.url === page);
    if (toolHit) return def;
    const articleHit = articlesInCluster(articles, def).some((a) => `/learn/${a.slug}` === page);
    if (articleHit) return def;
  }
  return null;
}

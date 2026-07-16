/**
 * Context assembly — the single place the analysis context is built.
 *
 * Both the Marketing Agent (breadth) and the SEO Intelligence Engine (depth) read
 * exactly the same inputs, so they must read them the same way. This lives in its
 * own leaf module rather than in the barrel because the SEO engine cannot import
 * `marketing-agent/index` — the agents import the SEO engine, and that would close
 * a cycle.
 *
 * Providers degrade to sample data when unconfigured (Growth Dashboard behaviour),
 * so this never throws for missing credentials.
 */

import { getGrowthData } from "@/lib/growth";
import { getLiveTools } from "@/registry";
import { getArticleBySlug, getArticleSlugs } from "@/lib/learn";
import type { Article } from "@/lib/learn";
import type { AgentContext } from "./types";

export async function buildContext(now: Date = new Date()): Promise<AgentContext> {
  const growth = await getGrowthData(now);
  return {
    growth,
    tools: getLiveTools(),
    // The content and internal-link rules need the parsed body (FAQs + tool links),
    // so load full articles rather than the lightweight `getAllArticles()` metadata
    // list — `getAllArticles()` returns `ArticleMeta[]`, which has neither.
    articles: getArticleSlugs()
      .map((slug) => getArticleBySlug(slug))
      .filter((a): a is Article => a !== null),
    now,
  };
}

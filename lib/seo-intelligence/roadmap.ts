/**
 * 7 — SEO Roadmap Generator.
 *
 * Runs every module, de-duplicates, ranks, and slices the backlog into the four
 * views the mission asks for. The slices answer different questions and deliberately
 * overlap — a quick win can also be a top opportunity:
 *
 *   **Top Opportunities** — what to do first, diversified **by module**. This applies
 *                           GROWTH-012's "ranking ≠ briefing" lesson, but on the axis
 *                           that discriminates *here*: every rule in this engine is
 *                           agent `seo` or `content`, so `pickTopPriorities`' per-agent
 *                           cap would collapse to two buckets and diversify nothing.
 *                           A per-module cap is what stops the loudest module (usually
 *                           CTR, which fires on every page-1 page) from owning the list.
 *                           Scores are never distorted to shape the list — only the
 *                           selection is.
 *   **Critical Issues**   — priority "critical": bleeding now.
 *   **Quick Wins**        — effort S with real upside: cheap, do this week.
 *   **Long-term Work**    — effort L: compounding, needs a plan.
 *
 * De-duplication is by id, which is why module ids are stable and deterministic.
 */

import type { Effort, Recommendation } from "@/lib/marketing-agent/types";
import { rankRecommendations } from "@/lib/marketing-agent/scoring";
import type { SeoContext, SeoModuleKey, SeoRoadmap } from "./types";
import { SEO_MODULES } from "./modules";

const MAX_TASKS = 100;
const QUICK_WIN_MIN_SCORE = 10;
const TOP_OPPORTUNITIES = 10;
const MAX_PER_MODULE = 3;

/**
 * Score-ranked, but capped per module so one loud module can't own the briefing.
 * Back-fills by score if the cap leaves slots — the list is always `limit` long when
 * enough tasks exist. Mirrors `pickTopPriorities`, keyed on module instead of agent.
 */
function pickTopByModule(
  ranked: Recommendation[],
  moduleOf: Map<string, SeoModuleKey>,
  limit: number,
  maxPerModule: number
): Recommendation[] {
  const used = new Map<SeoModuleKey | "unknown", number>();
  const picked: Recommendation[] = [];

  for (const rec of ranked) {
    if (picked.length >= limit) break;
    const key = moduleOf.get(rec.id) ?? "unknown";
    const n = used.get(key) ?? 0;
    if (n >= maxPerModule) continue;
    used.set(key, n + 1);
    picked.push(rec);
  }

  if (picked.length < limit) {
    const taken = new Set(picked.map((r) => r.id));
    for (const rec of ranked) {
      if (picked.length >= limit) break;
      if (!taken.has(rec.id)) picked.push(rec);
    }
  }

  return rankRecommendations(picked);
}

/** Every module's recommendations, keyed by module — the roadmap's raw input. */
export function runModules(
  ctx: SeoContext
): { key: SeoModuleKey; label: string; recommendations: Recommendation[] }[] {
  return SEO_MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    recommendations: m.run(ctx),
  }));
}

export function buildRoadmap(ctx: SeoContext): SeoRoadmap {
  const runs = runModules(ctx);

  // De-duplicate by id: two modules may legitimately reach the same page, and the
  // roadmap must name each task once. First writer wins — module order is the
  // precedence, and `SEO_MODULES` orders keywords (ranking) before ctr.
  const seen = new Map<string, Recommendation>();
  const moduleOf = new Map<string, SeoModuleKey>();
  for (const run of runs) {
    for (const rec of run.recommendations) {
      if (seen.has(rec.id)) continue;
      seen.set(rec.id, rec);
      moduleOf.set(rec.id, run.key);
    }
  }

  const ranked = rankRecommendations([...seen.values()]);
  const tasks = ranked.slice(0, MAX_TASKS);

  const criticalIssues = tasks.filter((t) => t.priority === "critical");
  const quickWins = tasks.filter((t) => t.effort === "S" && t.score >= QUICK_WIN_MIN_SCORE);
  const longTermWork = tasks.filter((t) => t.effort === "L");
  const topOpportunities = pickTopByModule(tasks, moduleOf, TOP_OPPORTUNITIES, MAX_PER_MODULE);

  const totalClickUpside = tasks.reduce((s, t) => s + (t.impactClicks ?? 0), 0);

  const byEffort: Record<Effort, number> = { S: 0, M: 0, L: 0 };
  for (const t of tasks) byEffort[t.effort] += 1;

  const taskIds = new Set(tasks.map((t) => t.id));
  const byModule = runs.map((r) => ({
    key: r.key,
    label: r.label,
    count: r.recommendations.filter((rec) => taskIds.has(rec.id) && moduleOf.get(rec.id) === r.key)
      .length,
  }));

  return {
    tasks,
    quickWins,
    criticalIssues,
    longTermWork,
    topOpportunities,
    totalClickUpside,
    byModule,
    byEffort,
  };
}

/**
 * Marketing Agent — the engine.
 *
 * One call assembles the context (Growth Dashboard providers + registry + Learn
 * Center), runs every registered agent, ranks the combined recommendations by
 * opportunity score, and builds the daily + weekly founder reports.
 *
 * Pure and deterministic given (`growth`, `now`): the same inputs always produce
 * the same ranked output, so the whole engine is unit-testable without a network.
 */

import { buildContext } from "./context";
import { agents } from "./agents";
import { rankRecommendations } from "./scoring";
import { buildDailyReport } from "./reports/daily";
import { buildWeeklyReport } from "./reports/weekly";
import type { AgentContext, AgentRun, MarketingAgentResult, Recommendation } from "./types";

/**
 * Run every agent against a prepared context. Exported separately so tests can
 * drive the engine with synthetic data and no I/O.
 */
export function runAgents(ctx: AgentContext): { runs: AgentRun[]; ranked: Recommendation[] } {
  const runs: AgentRun[] = agents.map((agent) => ({
    key: agent.key,
    label: agent.label,
    status: agent.status,
    watches: agent.watches,
    recommendations: rankRecommendations(agent.run(ctx)),
  }));

  const ranked = rankRecommendations(runs.flatMap((r) => r.recommendations));
  return { runs, ranked };
}

/** Build the full result (agents + ranked recommendations + both reports). */
export function analyse(ctx: AgentContext): MarketingAgentResult {
  const { runs, ranked } = runAgents(ctx);
  return {
    generatedAt: ctx.now.toISOString(),
    noneLive: ctx.growth.noneLive,
    agents: runs,
    recommendations: ranked,
    daily: buildDailyReport(ctx, runs, ranked),
    weekly: buildWeeklyReport(ctx, ranked),
  };
}

/**
 * The single entry point for the dashboard: gather all data, then analyse.
 * Providers degrade to sample data when unconfigured (Growth Dashboard behaviour),
 * so this never throws for missing credentials.
 */
export async function getMarketingReport(now: Date = new Date()): Promise<MarketingAgentResult> {
  return analyse(await buildContext(now));
}

export { buildContext } from "./context";
export { agents } from "./agents";
export * from "./types";
export {
  opportunityScore,
  priorityFromScore,
  rankRecommendations,
  expectedCtr,
  ctrUpsideClicks,
  businessValueForPage,
  isFinanceTool,
  trafficPotentialFromClicks,
  easeOfFix,
} from "./scoring";

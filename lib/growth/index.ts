/**
 * Growth Dashboard aggregator. Runs every provider in parallel (each returns an
 * honest empty dataset when unconfigured — never fabricated numbers), then derives
 * cross-provider insights. A single `getGrowthData()` call powers /admin/growth.
 */

import {
  fetchSearchConsole,
  fetchAnalytics,
  fetchClarity,
  fetchGitHub,
  fetchVercel,
} from "./providers";
import { computeInsights } from "./insights";
import type { GrowthData } from "./types";

export async function getGrowthData(now: Date = new Date()): Promise<GrowthData> {
  const [searchConsole, analytics, clarity, github, vercel] = await Promise.all([
    fetchSearchConsole(now),
    fetchAnalytics(now),
    fetchClarity(now),
    fetchGitHub(now),
    fetchVercel(now),
  ]);

  const insights = computeInsights(searchConsole.data, analytics.data, clarity.data);

  const noneLive = [searchConsole, analytics, clarity, github, vercel].every(
    (p) => p.status !== "live"
  );

  return {
    searchConsole,
    analytics,
    clarity,
    github,
    vercel,
    insights,
    generatedAt: now.toISOString(),
    noneLive,
  };
}

export type { GrowthData } from "./types";
export { providerRegistry } from "./providers";

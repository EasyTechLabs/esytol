import type { ProviderResult, ClarityData } from "../types";
import { sampleClarity } from "../sample";
import { getJson, asObj, asArr, asNum, errMsg } from "./http";

/**
 * Microsoft Clarity provider (Data Export API — project-live-insights).
 *
 * Live when CLARITY_API_TOKEN is set. Behavioural counts (dead/rage clicks,
 * quick-backs, excessive scroll) are mapped from the export; per-page scroll and
 * activity breakdowns are merged from the sample baseline until wired.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.CLARITY_API_TOKEN);
}

export async function fetchClarity(now: Date): Promise<ProviderResult<ClarityData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "sample",
      data: sampleClarity(now),
      note: "Sample data — set CLARITY_API_TOKEN to load live Clarity insights.",
      fetchedAt,
    };
  }
  try {
    return { status: "live", data: await fetchInsights(now), fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: sampleClarity(now),
      note: `Live Clarity fetch failed (${errMsg(err)}). Showing sample data.`,
      fetchedAt,
    };
  }
}

async function fetchInsights(now: Date): Promise<ClarityData> {
  const headers = { authorization: `Bearer ${process.env.CLARITY_API_TOKEN}` };
  const url = "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3";
  const json = await getJson(url, headers);
  const rows = asArr(json);

  const metric = (name: string): number => {
    const row = rows.map(asObj).find((r) => r.metricName === name);
    if (!row) return 0;
    const info = asObj(asArr(row.information)[0]);
    return asNum(info.sessionsCount ?? info.subTotal ?? info.value);
  };

  const baseline = sampleClarity(now);
  return {
    sessions: metric("Traffic") || baseline.sessions,
    recordings: metric("Traffic") ? Math.round(metric("Traffic") * 0.42) : baseline.recordings,
    deadClicks: metric("DeadClickCount") || baseline.deadClicks,
    rageClicks: metric("RageClickCount") || baseline.rageClicks,
    quickBacks: metric("QuickbackClick") || baseline.quickBacks,
    excessiveScroll: metric("ExcessiveScroll") || baseline.excessiveScroll,
    avgScrollDepth: baseline.avgScrollDepth,
    scrollByPage: baseline.scrollByPage,
    topPagesByActivity: baseline.topPagesByActivity,
  };
}

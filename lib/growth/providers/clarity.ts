import type { ProviderResult, ClarityData } from "../types";
import { emptyClarity } from "../empty";
import { getJson, asObj, asArr, asNum, errMsg } from "./http";

/**
 * Microsoft Clarity provider (Data Export API — project-live-insights).
 *
 * Live when CLARITY_API_TOKEN is set. Behavioural counts (sessions, dead/rage
 * clicks, quick-backs, excessive scroll) are mapped from the export. Recording
 * counts, scroll depth and per-page breakdowns are NOT in this API and stay
 * zero/empty with a note (P0-3) — view them in the Clarity dashboard.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.CLARITY_API_TOKEN);
}

export async function fetchClarity(now: Date): Promise<ProviderResult<ClarityData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "unconfigured",
      data: emptyClarity(),
      note: "Clarity not configured — generate an API token in Clarity → Settings → Data Export and set CLARITY_API_TOKEN.",
      fetchedAt,
    };
  }
  try {
    return {
      status: "live",
      data: await fetchInsights(),
      note: "Recordings, scroll depth and per-page activity are not exposed by the Clarity export API — see the Clarity dashboard.",
      fetchedAt,
    };
  } catch (err) {
    return {
      status: "error",
      data: emptyClarity(),
      note: `Live Clarity fetch failed (${errMsg(err)}).`,
      fetchedAt,
    };
  }
}

async function fetchInsights(): Promise<ClarityData> {
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

  return {
    sessions: metric("Traffic"),
    // Not exposed by the export API — zeros are the truth we have, not placeholders.
    recordings: 0,
    deadClicks: metric("DeadClickCount"),
    rageClicks: metric("RageClickCount"),
    quickBacks: metric("QuickbackClick"),
    excessiveScroll: metric("ExcessiveScroll"),
    avgScrollDepth: 0,
    scrollByPage: [],
    topPagesByActivity: [],
  };
}

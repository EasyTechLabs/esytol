import type { ProviderResult, SearchConsoleData, QueryRow, PageRow } from "../types";
import { sampleSearchConsole } from "../sample";
import { postJson, asObj, asArr, asNum, asStr, errMsg } from "./http";

/**
 * Google Search Console provider (Search Analytics API).
 *
 * Live when GSC_SITE_URL and GOOGLE_ACCESS_TOKEN are set. The Search Analytics
 * endpoint returns totals + top queries/pages; index coverage and sitemap status
 * come from separate APIs and are merged from the sample baseline until wired.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.GSC_SITE_URL && process.env.GOOGLE_ACCESS_TOKEN);
}

export async function fetchSearchConsole(now: Date): Promise<ProviderResult<SearchConsoleData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "sample",
      data: sampleSearchConsole(now),
      note: "Sample data — set GSC_SITE_URL and GOOGLE_ACCESS_TOKEN to load live Search Console data.",
      fetchedAt,
    };
  }
  try {
    const data = await queryGsc(now);
    return { status: "live", data, fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: sampleSearchConsole(now),
      note: `Live Search Console fetch failed (${errMsg(err)}). Showing sample data.`,
      fetchedAt,
    };
  }
}

async function queryGsc(now: Date): Promise<SearchConsoleData> {
  const site = encodeURIComponent(process.env.GSC_SITE_URL as string);
  const headers = { authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}` };
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`;
  const range = { startDate: isoDate(now, 28), endDate: isoDate(now, 1) };

  const [byQuery, byPage] = await Promise.all([
    postJson(url, { ...range, dimensions: ["query"], rowLimit: 14 }, headers),
    postJson(url, { ...range, dimensions: ["page"], rowLimit: 12 }, headers),
  ]);

  const topQueries: QueryRow[] = asArr(asObj(byQuery).rows).map((r) => {
    const row = asObj(r);
    return {
      query: asStr(asArr(row.keys)[0]),
      clicks: asNum(row.clicks),
      impressions: asNum(row.impressions),
      ctr: asNum(row.ctr),
      position: Math.round(asNum(row.position) * 10) / 10,
      positionDelta: 0, // requires a second-period query; sample baseline covers this
    };
  });

  const topPages: PageRow[] = asArr(asObj(byPage).rows).map((r) => {
    const row = asObj(r);
    return {
      page: asStr(asArr(row.keys)[0]),
      clicks: asNum(row.clicks),
      impressions: asNum(row.impressions),
      ctr: asNum(row.ctr),
      position: Math.round(asNum(row.position) * 10) / 10,
      positionDelta: 0, // requires a second period query; sample baseline covers this
    };
  });

  const clicks = topPages.reduce((s, p) => s + p.clicks, 0);
  const impressions = topPages.reduce((s, p) => s + p.impressions, 0);
  const position =
    topPages.length > 0
      ? Math.round((topPages.reduce((s, p) => s + p.position, 0) / topPages.length) * 10) / 10
      : 0;

  const baseline = sampleSearchConsole(now);
  return {
    totals: { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position },
    clicksTrend: baseline.clicksTrend,
    impressionsTrend: baseline.impressionsTrend,
    topQueries: topQueries.length ? topQueries : baseline.topQueries,
    topPages: topPages.length ? topPages : baseline.topPages,
    indexCoverage: baseline.indexCoverage,
    sitemap: baseline.sitemap,
  };
}

function isoDate(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

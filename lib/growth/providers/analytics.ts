import type { ProviderResult, AnalyticsData, GaPageRow, BarDatum } from "../types";
import { emptyAnalytics } from "../empty";
import { postJson, asObj, asArr, asNum, asStr, errMsg } from "./http";
import { getGoogleAccessToken, hasGoogleAuth, GA_SCOPE } from "./googleAuth";

/**
 * Google Analytics (GA4 Data API — runReport) provider.
 *
 * Live when GA4_PROPERTY_ID is set together with Google credentials — either a
 * Service Account (GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS)
 * or a pre-minted GOOGLE_ACCESS_TOKEN. Everything shown is fetched (P0-3): totals,
 * the 28-day users trend, returning users, top pages, sources, countries and
 * devices. Conversions stay empty until conversion tracking exists — an honest
 * blank, not a placeholder.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID) && hasGoogleAuth();
}

export async function fetchAnalytics(now: Date): Promise<ProviderResult<AnalyticsData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "unconfigured",
      data: emptyAnalytics(),
      note: "Analytics not configured — set GA4_PROPERTY_ID and grant the service account Viewer access to the GA4 property.",
      fetchedAt,
    };
  }
  try {
    return { status: "live", data: await runReports(now), fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: emptyAnalytics(),
      note: `Live Analytics fetch failed (${errMsg(err)}).`,
      fetchedAt,
    };
  }
}

async function runReports(now: Date): Promise<AnalyticsData> {
  const prop = process.env.GA4_PROPERTY_ID as string;
  const token = await getGoogleAccessToken(GA_SCOPE, now);
  if (!token) throw new Error("No Google credentials available for Analytics");
  const headers = { authorization: `Bearer ${token}` };
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`;
  const dateRanges = [{ startDate: "28daysAgo", endDate: "yesterday" }];

  const barReport = async (
    dimension: string,
    metric = "sessions",
    limit = 8
  ): Promise<BarDatum[]> => {
    const json = await postJson(
      url,
      { dateRanges, dimensions: [{ name: dimension }], metrics: [{ name: metric }], limit },
      headers
    );
    return asArr(asObj(json).rows).map((r) => {
      const row = asObj(r);
      return {
        label: asStr(asObj(asArr(row.dimensionValues)[0]).value),
        value: asNum(asObj(asArr(row.metricValues)[0]).value),
      };
    });
  };

  const pagesJson = await postJson(
    url,
    {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "userEngagementDuration" },
        { name: "bounceRate" },
      ],
      limit: 12,
    },
    headers
  );

  const topPages: GaPageRow[] = asArr(asObj(pagesJson).rows).map((r) => {
    const row = asObj(r);
    const m = asArr(row.metricValues);
    const views = asNum(asObj(m[0]).value);
    return {
      page: asStr(asObj(asArr(row.dimensionValues)[0]).value),
      views,
      users: asNum(asObj(m[1]).value),
      avgEngagementSec: views ? Math.round(asNum(asObj(m[2]).value) / views) : 0,
      bounceRate: Math.round(asNum(asObj(m[3]).value) * 100) / 100,
    };
  });

  // Property-level totals in one report — no summing of top-N rows, no ratios
  // invented from other metrics.
  const totalsReport = postJson(
    url,
    {
      dateRanges,
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "engagementRate" },
        { name: "userEngagementDuration" },
      ],
    },
    headers
  );

  const [sources, countries, devices, totalsJson, trend, returning, events] = await Promise.all([
    barReport("sessionDefaultChannelGroup"),
    barReport("country", "totalUsers"),
    barReport("deviceCategory", "totalUsers"),
    totalsReport,
    barReport("date", "totalUsers", 28),
    barReport("newVsReturning", "totalUsers"),
    barReport("eventName", "eventCount", 20),
  ]);

  const totalsRow = asArr(asObj(asArr(asObj(totalsJson).rows)[0]).metricValues).map((v) =>
    asNum(asObj(v).value)
  );
  const [users = 0, sessions = 0, engagementRate = 0, engagementDuration = 0] = totalsRow;

  return {
    totals: {
      users,
      sessions,
      engagementRate: Math.round(engagementRate * 100) / 100,
      returningUsers: returning.find((r) => r.label === "returning")?.value ?? 0,
      avgEngagementSec: sessions ? Math.round(engagementDuration / sessions) : 0,
    },
    usersTrend: [...trend].sort((a, b) => a.label.localeCompare(b.label)).map((r) => r.value),
    topPages,
    sources,
    countries,
    devices,
    conversions: [],
    events,
  };
}

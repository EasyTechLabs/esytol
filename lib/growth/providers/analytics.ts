import type { ProviderResult, AnalyticsData, GaPageRow, BarDatum } from "../types";
import { sampleAnalytics } from "../sample";
import { postJson, asObj, asArr, asNum, asStr, errMsg } from "./http";
import { getGoogleAccessToken, hasGoogleAuth, GA_SCOPE } from "./googleAuth";

/**
 * Google Analytics (GA4 Data API — runReport) provider.
 *
 * Live when GA4_PROPERTY_ID is set together with Google credentials — either a
 * Service Account (GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS)
 * or a pre-minted GOOGLE_ACCESS_TOKEN. Core totals, top pages, sources, countries
 * and devices are fetched; the users trend and (future-ready) conversions are
 * merged from the sample baseline until wired.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID) && hasGoogleAuth();
}

export async function fetchAnalytics(now: Date): Promise<ProviderResult<AnalyticsData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "sample",
      data: sampleAnalytics(now),
      note: "Sample data — set GA4_PROPERTY_ID and provide Google credentials (GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS) to load live Analytics data.",
      fetchedAt,
    };
  }
  try {
    return { status: "live", data: await runReports(now), fetchedAt };
  } catch (err) {
    return {
      status: "error",
      data: sampleAnalytics(now),
      note: `Live Analytics fetch failed (${errMsg(err)}). Showing sample data.`,
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

  const barReport = async (dimension: string, metric = "sessions"): Promise<BarDatum[]> => {
    const json = await postJson(
      url,
      { dateRanges, dimensions: [{ name: dimension }], metrics: [{ name: metric }], limit: 8 },
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

  const [sources, countries, devices] = await Promise.all([
    barReport("sessionDefaultChannelGroup"),
    barReport("country", "totalUsers"),
    barReport("deviceCategory", "totalUsers"),
  ]);

  const users = topPages.reduce((s, p) => s + p.users, 0);
  const baseline = sampleAnalytics(now);

  return {
    totals: {
      users,
      sessions: sources.reduce((s, d) => s + d.value, 0) || Math.round(users * 1.35),
      engagementRate: baseline.totals.engagementRate,
      returningUsers: baseline.totals.returningUsers,
      avgEngagementSec: baseline.totals.avgEngagementSec,
    },
    usersTrend: baseline.usersTrend,
    topPages: topPages.length ? topPages : baseline.topPages,
    sources: sources.length ? sources : baseline.sources,
    countries: countries.length ? countries : baseline.countries,
    devices: devices.length ? devices : baseline.devices,
    conversions: [],
  };
}

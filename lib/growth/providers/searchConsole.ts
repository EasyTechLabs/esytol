import type { ProviderResult, SearchConsoleData, QueryRow, PageRow } from "../types";
import { emptySearchConsole } from "../empty";
import { postJson, getJson, asObj, asArr, asNum, asStr, errMsg } from "./http";
import { getGoogleAccessToken, hasGoogleAuth, WEBMASTERS_SCOPE } from "./googleAuth";

/**
 * Google Search Console provider (Search Analytics + Sitemaps APIs).
 *
 * Live when GSC_SITE_URL is set and Google credentials exist — the same Service
 * Account as Analytics (grant its client_email access under Search Console →
 * Settings → Users), or a pre-minted GOOGLE_ACCESS_TOKEN.
 *
 * Everything returned is real (P0-3):
 * - totals and the 28-day clicks/impressions trends come from a by-date query;
 * - per-query/per-page position deltas come from a second, previous-28-day query;
 * - sitemap status comes from the Sitemaps API.
 *
 * Index coverage has NO public API — it stays zero with a note, because an honest
 * blank beats a fabricated count.
 */
export function isConfigured(): boolean {
  return Boolean(process.env.GSC_SITE_URL) && hasGoogleAuth();
}

export async function fetchSearchConsole(now: Date): Promise<ProviderResult<SearchConsoleData>> {
  const fetchedAt = now.toISOString();
  if (!isConfigured()) {
    return {
      status: "unconfigured",
      data: emptySearchConsole(),
      note: "Search Console not configured — set GSC_SITE_URL and grant the service account access to the property.",
      fetchedAt,
    };
  }
  try {
    const data = await queryGsc(now);
    return {
      status: "live",
      data,
      note: "Index coverage has no public API and is not shown.",
      fetchedAt,
    };
  } catch (err) {
    return {
      status: "error",
      data: emptySearchConsole(),
      note: `Live Search Console fetch failed (${errMsg(err)}).`,
      fetchedAt,
    };
  }
}

interface DimensionRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function queryGsc(now: Date): Promise<SearchConsoleData> {
  const token = await getGoogleAccessToken(WEBMASTERS_SCOPE, now);
  if (!token) throw new Error("No Google credentials available for Search Console");
  const headers = { authorization: `Bearer ${token}` };
  const site = encodeURIComponent(process.env.GSC_SITE_URL as string);
  const queryUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`;

  // GSC data lags ~2 days; both windows end before the lag so deltas compare
  // like with like.
  const current = { startDate: isoDate(now, 29), endDate: isoDate(now, 2) };
  const previous = { startDate: isoDate(now, 57), endDate: isoDate(now, 30) };

  const rows = async (
    range: { startDate: string; endDate: string },
    dimension: string,
    limit: number
  ) =>
    parseRows(
      await postJson(queryUrl, { ...range, dimensions: [dimension], rowLimit: limit }, headers)
    );

  const [byDate, queriesNow, queriesPrev, pagesNow, pagesPrev, sitemaps] = await Promise.all([
    rows(current, "date", 28),
    rows(current, "query", 14),
    rows(previous, "query", 100),
    rows(current, "page", 12),
    rows(previous, "page", 100),
    getJson(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/sitemaps`,
      headers
    ).catch(() => null),
  ]);

  // Totals from the full by-date series — the whole property, not just top rows.
  const clicks = byDate.reduce((sum, r) => sum + r.clicks, 0);
  const impressions = byDate.reduce((sum, r) => sum + r.impressions, 0);
  const position = weightedPosition(byDate);

  const dates = [...byDate].sort((a, b) => a.key.localeCompare(b.key));

  const prevQueryPos = new Map(queriesPrev.map((r) => [r.key, r.position]));
  const topQueries: QueryRow[] = queriesNow.map((r) => ({
    query: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: round1(r.position),
    positionDelta: delta(r.position, prevQueryPos.get(r.key)),
  }));

  const prevPagePos = new Map(pagesPrev.map((r) => [toPath(r.key), r.position]));
  const topPages: PageRow[] = pagesNow.map((r) => ({
    page: toPath(r.key),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: round1(r.position),
    positionDelta: delta(r.position, prevPagePos.get(toPath(r.key))),
  }));

  return {
    totals: { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position },
    clicksTrend: dates.map((r) => r.clicks),
    impressionsTrend: dates.map((r) => r.impressions),
    topQueries,
    topPages,
    // No public API for the coverage report — honest zeros, flagged in the note.
    indexCoverage: { indexed: 0, discovered: 0, excluded: 0, errors: 0 },
    sitemap: parseSitemap(sitemaps),
  };
}

function parseRows(json: unknown): DimensionRow[] {
  return asArr(asObj(json).rows).map((r) => {
    const row = asObj(r);
    return {
      key: asStr(asArr(row.keys)[0]),
      clicks: asNum(row.clicks),
      impressions: asNum(row.impressions),
      ctr: asNum(row.ctr),
      position: asNum(row.position),
    };
  });
}

function parseSitemap(json: unknown): SearchConsoleData["sitemap"] {
  const first = asObj(asArr(asObj(json ?? {}).sitemap)[0]);
  if (!first.path) return emptySearchConsole().sitemap;
  const contents = asArr(first.contents).map(asObj);
  const submitted = contents.reduce((sum, c) => sum + asNum(c.submitted), 0);
  return {
    path: toPath(asStr(first.path)),
    submitted,
    // The Sitemaps API no longer reports per-sitemap indexed counts; 0 is the truth
    // we have, not a placeholder.
    indexed: 0,
    lastRead: asStr(first.lastDownloaded),
    status: first.isPending ? "pending" : asNum(first.errors) > 0 ? "errors" : "processed",
  };
}

function weightedPosition(rows: DimensionRow[]): number {
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  if (!impressions) return 0;
  return round1(rows.reduce((sum, r) => sum + r.position * r.impressions, 0) / impressions);
}

/** + = dropped (worse), − = climbed. 0 when the key wasn't seen last period. */
function delta(current: number, previous: number | undefined): number {
  if (previous === undefined) return 0;
  return round1(current - previous);
}

function toPath(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isoDate(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

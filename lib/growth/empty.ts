/**
 * Honest empty datasets — what a provider returns when it has nothing real to say.
 *
 * Replaced `sample.ts` in P0-3. The previous behaviour — deterministic fake metrics
 * whenever credentials were absent — meant every number on the dashboard could be
 * fiction while looking plausible, and for months every one was. An unconfigured
 * provider now returns zeros and empty lists, and the UI says "not configured"
 * instead of charting invented data.
 *
 * These builders are also the error-path payload: a failed live fetch shows the
 * error and an empty dataset, never a fake one.
 */

import type {
  AnalyticsData,
  ClarityData,
  GitHubData,
  SearchConsoleData,
  VercelData,
} from "./types";

export function emptySearchConsole(): SearchConsoleData {
  return {
    totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    clicksTrend: [],
    impressionsTrend: [],
    topQueries: [],
    topPages: [],
    indexCoverage: { indexed: 0, discovered: 0, excluded: 0, errors: 0 },
    sitemap: { path: "", submitted: 0, indexed: 0, lastRead: "", status: "unknown" },
  };
}

export function emptyAnalytics(): AnalyticsData {
  return {
    totals: { users: 0, sessions: 0, engagementRate: 0, returningUsers: 0, avgEngagementSec: 0 },
    usersTrend: [],
    topPages: [],
    sources: [],
    countries: [],
    devices: [],
    conversions: [],
    events: [],
  };
}

export function emptyClarity(): ClarityData {
  return {
    sessions: 0,
    recordings: 0,
    deadClicks: 0,
    rageClicks: 0,
    quickBacks: 0,
    excessiveScroll: 0,
    avgScrollDepth: 0,
    scrollByPage: [],
    topPagesByActivity: [],
  };
}

export function emptyGitHub(): GitHubData {
  return { repo: "", defaultBranch: "", commits: [], releases: [], deployments: [] };
}

export function emptyVercel(): VercelData {
  return {
    project: "",
    productionUrl: "",
    latest: { state: "unknown", target: "", createdAt: "", url: "" },
    builds: [],
    performance: [],
  };
}

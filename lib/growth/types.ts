/**
 * Esytol Growth Dashboard — shared domain types.
 *
 * Provider-agnostic shapes consumed by the reusable dashboard widgets. Each
 * provider returns a `ProviderResult<T>` so the UI can render a live/sample/error
 * status uniformly, and new providers (Bing, AdSense, revenue) can be added
 * without changing the widgets.
 */

export type ProviderStatus = "live" | "sample" | "error";

export interface ProviderResult<T> {
  status: ProviderStatus;
  data: T;
  /** Human-readable note, e.g. how to connect live data. */
  note?: string;
  fetchedAt: string;
}

export interface BarDatum {
  label: string;
  value: number;
}

// ── Google Search Console ─────────────────────────────────────────────────────

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
  /** Change in average position vs the previous period (+ = worse, − = better). */
  positionDelta: number;
}

export interface SearchConsoleData {
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  clicksTrend: number[];
  impressionsTrend: number[];
  topQueries: QueryRow[];
  topPages: PageRow[];
  indexCoverage: { indexed: number; discovered: number; excluded: number; errors: number };
  sitemap: { path: string; submitted: number; indexed: number; lastRead: string; status: string };
}

// ── Google Analytics ──────────────────────────────────────────────────────────

export interface GaPageRow {
  page: string;
  views: number;
  users: number;
  avgEngagementSec: number;
  bounceRate: number; // 0..1
}

export interface AnalyticsData {
  totals: {
    users: number;
    sessions: number;
    engagementRate: number; // 0..1
    returningUsers: number;
    avgEngagementSec: number;
  };
  usersTrend: number[];
  topPages: GaPageRow[];
  sources: BarDatum[];
  countries: BarDatum[];
  devices: BarDatum[];
  /** Future-ready — empty until conversion tracking / revenue is wired. */
  conversions: BarDatum[];
}

// ── Microsoft Clarity ─────────────────────────────────────────────────────────

export interface ClarityData {
  sessions: number;
  recordings: number;
  deadClicks: number;
  rageClicks: number;
  quickBacks: number;
  excessiveScroll: number;
  avgScrollDepth: number; // 0..1
  scrollByPage: { page: string; scrollDepth: number }[];
  topPagesByActivity: { page: string; sessions: number; deadClicks: number; rageClicks: number }[];
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export interface CommitRow {
  sha: string;
  message: string;
  author: string;
  date: string;
}
export interface ReleaseRow {
  tag: string;
  name: string;
  date: string;
}
export interface DeploymentRow {
  id: string;
  environment: string;
  state: string;
  date: string;
  ref: string;
}
export interface GitHubData {
  repo: string;
  defaultBranch: string;
  commits: CommitRow[];
  releases: ReleaseRow[];
  deployments: DeploymentRow[];
}

// ── Vercel ────────────────────────────────────────────────────────────────────

export interface VercelBuildRow {
  id: string;
  state: string;
  target: string;
  createdAt: string;
  commit: string;
  durationSec: number;
}
export interface VercelPerfMetric {
  metric: string;
  value: number;
  unit: string;
  rating: "good" | "needs-improvement" | "poor";
}
export interface VercelData {
  project: string;
  productionUrl: string;
  latest: { state: string; target: string; createdAt: string; url: string };
  builds: VercelBuildRow[];
  performance: VercelPerfMetric[];
}

// ── Insights ──────────────────────────────────────────────────────────────────

export type InsightSeverity = "opportunity" | "warning" | "positive" | "info";

export interface InsightItem {
  label: string;
  detail: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  items: InsightItem[];
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export interface GrowthData {
  searchConsole: ProviderResult<SearchConsoleData>;
  analytics: ProviderResult<AnalyticsData>;
  clarity: ProviderResult<ClarityData>;
  github: ProviderResult<GitHubData>;
  vercel: ProviderResult<VercelData>;
  insights: Insight[];
  generatedAt: string;
  /** True when every provider is serving sample (unconnected) data. */
  allSample: boolean;
}

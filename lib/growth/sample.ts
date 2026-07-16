/**
 * Deterministic sample datasets for the Growth Dashboard.
 *
 * Used whenever a provider has no credentials configured, so the dashboard is
 * fully functional out of the box. Metrics are derived deterministically from
 * the real site (live tools + Learn articles + their target keywords) via a
 * string hash — no Math.random — so the output is stable across builds and
 * testable, while the page paths and queries are genuinely those of the site.
 */

import { getLiveTools } from "@/registry";
import { getAllArticles } from "@/lib/learn";
import { seededInt, seededUnit } from "./format";
import type {
  SearchConsoleData,
  AnalyticsData,
  ClarityData,
  GitHubData,
  VercelData,
  PageRow,
  QueryRow,
  GaPageRow,
} from "./types";

const STATIC_PAGES = ["/", "/tools", "/learn", "/categories", "/new", "/popular"];

function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function allPagePaths(): string[] {
  const tools = getLiveTools().map((t) => t.url);
  const articles = getAllArticles().map((a) => `/learn/${a.slug}`);
  return [...STATIC_PAGES, ...tools, ...articles];
}

function pageWeight(path: string): number {
  // Hub pages carry more impressions than deep pages.
  if (path === "/") return 1;
  if (path === "/tools" || path === "/learn") return 0.85;
  if (path.startsWith("/tools/")) return 0.7;
  if (path.startsWith("/learn/")) return 0.45;
  return 0.35;
}

// ── Google Search Console ─────────────────────────────────────────────────────

export function sampleSearchConsole(now: Date): SearchConsoleData {
  const paths = allPagePaths();

  const pages: PageRow[] = paths.map((page) => {
    const w = pageWeight(page);
    const impressions = seededInt(page, 400, 48000, "impr") * w + 200;
    const ctr = 0.006 + seededUnit(page, "ctr") * 0.085;
    const clicks = Math.round(impressions * ctr);
    const position = 1.6 + seededUnit(page, "pos") * 32;
    const positionDelta = (seededUnit(page, "delta") - 0.5) * 9;
    return {
      page,
      impressions: Math.round(impressions),
      clicks,
      ctr,
      position: Math.round(position * 10) / 10,
      positionDelta: Math.round(positionDelta * 10) / 10,
    };
  });

  const topPages = [...pages].sort((a, b) => b.impressions - a.impressions).slice(0, 12);

  const keywords = Array.from(new Set(getLiveTools().flatMap((t) => t.keywords ?? [])));
  const topQueries: QueryRow[] = keywords
    .map((query): QueryRow => {
      const impressions = seededInt(query, 150, 22000, "qimpr");
      const ctr = 0.008 + seededUnit(query, "qctr") * 0.09;
      return {
        query,
        impressions,
        clicks: Math.round(impressions * ctr),
        ctr,
        position: Math.round((1.5 + seededUnit(query, "qpos") * 30) * 10) / 10,
        positionDelta: Math.round((seededUnit(query, "qdelta") - 0.5) * 9 * 10) / 10,
      };
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 14);

  const impressions = pages.reduce((s, p) => s + p.impressions, 0);
  const clicks = pages.reduce((s, p) => s + p.clicks, 0);
  const position = Math.round((pages.reduce((s, p) => s + p.position, 0) / pages.length) * 10) / 10;

  const indexed = paths.length - 2;

  return {
    totals: {
      clicks,
      impressions,
      ctr: clicks / impressions,
      position,
    },
    clicksTrend: trend(clicks / 28, "clicks", now),
    impressionsTrend: trend(impressions / 28, "impr", now),
    topQueries,
    topPages,
    indexCoverage: {
      indexed,
      discovered: seededInt("discovered", 2, 6, "cov"),
      excluded: seededInt("excluded", 3, 9, "cov"),
      errors: 0,
    },
    sitemap: {
      path: "/sitemap.xml",
      submitted: paths.length,
      indexed,
      lastRead: daysAgoIso(now, 1),
      status: "Success",
    },
  };
}

function trend(base: number, salt: string, _now: Date): number[] {
  // 14 points, gently rising with deterministic wobble.
  return Array.from({ length: 14 }, (_, i) => {
    const growth = 1 + i * 0.02;
    const wobble = 0.85 + seededUnit(`${salt}-${i}`, "trend") * 0.3;
    return Math.max(0, Math.round(base * growth * wobble));
  });
}

// ── Google Analytics ──────────────────────────────────────────────────────────

export function sampleAnalytics(now: Date): AnalyticsData {
  const paths = allPagePaths();

  const topPages: GaPageRow[] = paths
    .map((page): GaPageRow => {
      const w = pageWeight(page);
      const views = Math.round(seededInt(page, 90, 9500, "views") * w + 40);
      return {
        page,
        views,
        users: Math.round(views * (0.62 + seededUnit(page, "uratio") * 0.2)),
        avgEngagementSec: seededInt(page, 18, 235, "eng"),
        bounceRate: Math.round((0.26 + seededUnit(page, "bounce") * 0.55) * 100) / 100,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  const users = topPages.reduce((s, p) => s + p.users, 0);
  const sessions = Math.round(users * 1.35);

  return {
    totals: {
      users,
      sessions,
      engagementRate: Math.round((0.55 + seededUnit("eng", "rate") * 0.2) * 100) / 100,
      returningUsers: Math.round(users * (0.24 + seededUnit("ret", "rate") * 0.14)),
      avgEngagementSec: seededInt("avg", 55, 120, "eng"),
    },
    usersTrend: trend(users / 28, "gausers", now),
    topPages,
    sources: [
      { label: "Organic Search", value: Math.round(sessions * 0.58) },
      { label: "Direct", value: Math.round(sessions * 0.24) },
      { label: "Referral", value: Math.round(sessions * 0.09) },
      { label: "Social", value: Math.round(sessions * 0.06) },
      { label: "Email", value: Math.round(sessions * 0.03) },
    ],
    countries: [
      { label: "India", value: Math.round(users * 0.82) },
      { label: "United States", value: Math.round(users * 0.06) },
      { label: "UAE", value: Math.round(users * 0.04) },
      { label: "United Kingdom", value: Math.round(users * 0.03) },
      { label: "Canada", value: Math.round(users * 0.02) },
      { label: "Others", value: Math.round(users * 0.03) },
    ],
    devices: [
      { label: "Mobile", value: Math.round(users * 0.71) },
      { label: "Desktop", value: Math.round(users * 0.25) },
      { label: "Tablet", value: Math.round(users * 0.04) },
    ],
    conversions: [], // future-ready — populated when conversion/revenue tracking is wired
  };
}

// ── Microsoft Clarity ─────────────────────────────────────────────────────────

export function sampleClarity(now: Date): ClarityData {
  void now;
  const tools = getLiveTools().slice(0, 6);
  const sessions = tools.reduce((s, t) => s + seededInt(t.slug, 120, 2200, "csess"), 800);

  return {
    sessions,
    recordings: Math.round(sessions * 0.42),
    deadClicks: seededInt("dead", 40, 320, "clarity"),
    rageClicks: seededInt("rage", 8, 90, "clarity"),
    quickBacks: seededInt("quick", 60, 500, "clarity"),
    excessiveScroll: seededInt("scroll", 30, 260, "clarity"),
    avgScrollDepth: Math.round((0.52 + seededUnit("depth", "clarity") * 0.28) * 100) / 100,
    scrollByPage: tools.map((t) => ({
      page: t.url,
      scrollDepth: Math.round((0.4 + seededUnit(t.slug, "sdepth") * 0.5) * 100) / 100,
    })),
    topPagesByActivity: tools.map((t) => ({
      page: t.url,
      sessions: seededInt(t.slug, 120, 2200, "csess"),
      deadClicks: seededInt(t.slug, 2, 40, "cdead"),
      rageClicks: seededInt(t.slug, 0, 14, "crage"),
    })),
  };
}

// ── GitHub ────────────────────────────────────────────────────────────────────

const SAMPLE_COMMITS: { message: string; author: string }[] = [
  { message: "feat(growth): Growth Dashboard (GROWTH-009)", author: "esytol-bot" },
  {
    message: "feat(learn): Esytol Learn Center — indexable article pages (GROWTH-008A)",
    author: "manish",
  },
  {
    message: "feat(growth): NPS Calculator — National Pension System (GROWTH-007)",
    author: "manish",
  },
  {
    message: "feat(growth): Gratuity Calculator — Payment of Gratuity Act (GROWTH-006)",
    author: "manish",
  },
  {
    message: "feat(growth): EPF Calculator — provident fund projection (GROWTH-005)",
    author: "manish",
  },
  {
    message: "feat(growth): HRA Calculator — Section 10(13A) / Rule 2A (GROWTH-004)",
    author: "manish",
  },
  {
    message: "feat(growth): Income Tax Calculator — Old vs New regime (GROWTH-003)",
    author: "manish",
  },
  { message: "chore: tighten SEO metadata + dynamic OG images (GROWTH-002)", author: "esytol-bot" },
];

export function sampleGitHub(now: Date): GitHubData {
  return {
    repo: process.env.GITHUB_REPO ?? "EasyTechLabs/esytol",
    defaultBranch: "main",
    commits: SAMPLE_COMMITS.map((c, i) => ({
      sha: `${hashSha(c.message)}`,
      message: c.message,
      author: c.author,
      date: daysAgoIso(now, i * 1.5),
    })),
    releases: [
      { tag: "v1.6.0", name: "Learn Center", date: daysAgoIso(now, 3) },
      { tag: "v1.5.0", name: "NPS Calculator", date: daysAgoIso(now, 9) },
      { tag: "v1.4.0", name: "Gratuity Calculator", date: daysAgoIso(now, 16) },
    ],
    deployments: [
      {
        id: "dpl_1",
        environment: "Production",
        state: "success",
        date: daysAgoIso(now, 0.05),
        ref: "main",
      },
      {
        id: "dpl_2",
        environment: "Production",
        state: "success",
        date: daysAgoIso(now, 3),
        ref: "main",
      },
      {
        id: "dpl_3",
        environment: "Preview",
        state: "success",
        date: daysAgoIso(now, 3.1),
        ref: "growth-009",
      },
    ],
  };
}

function hashSha(s: string): string {
  return (hash32(s) >>> 0).toString(16).padStart(7, "0").slice(0, 7);
}
function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Vercel ────────────────────────────────────────────────────────────────────

export function sampleVercel(now: Date): VercelData {
  return {
    project: process.env.VERCEL_PROJECT_ID ?? "esytol",
    productionUrl: "https://www.esytol.com",
    latest: {
      state: "READY",
      target: "production",
      createdAt: daysAgoIso(now, 0.05),
      url: "https://www.esytol.com",
    },
    builds: [
      {
        id: "bld_1",
        state: "READY",
        target: "production",
        createdAt: daysAgoIso(now, 0.05),
        commit: "GROWTH-009",
        durationSec: 47,
      },
      {
        id: "bld_2",
        state: "READY",
        target: "production",
        createdAt: daysAgoIso(now, 3),
        commit: "GROWTH-008A",
        durationSec: 52,
      },
      {
        id: "bld_3",
        state: "READY",
        target: "preview",
        createdAt: daysAgoIso(now, 3.1),
        commit: "GROWTH-008A",
        durationSec: 49,
      },
      {
        id: "bld_4",
        state: "READY",
        target: "production",
        createdAt: daysAgoIso(now, 9),
        commit: "GROWTH-007",
        durationSec: 44,
      },
    ],
    performance: [
      { metric: "LCP", value: 1.4, unit: "s", rating: "good" },
      { metric: "CLS", value: 0.02, unit: "", rating: "good" },
      { metric: "INP", value: 120, unit: "ms", rating: "good" },
      { metric: "TTFB", value: 0.28, unit: "s", rating: "good" },
    ],
  };
}

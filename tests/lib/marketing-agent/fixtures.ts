/**
 * Shared test fixtures for the Marketing Agent.
 *
 * `makeContext()` returns a context where **nothing triggers** — every threshold is
 * deliberately satisfied. Each test then overrides exactly one signal, so a passing
 * assertion proves that rule fired (and nothing else did).
 */

import type { AgentContext } from "@/lib/marketing-agent/types";
import type {
  PageRow,
  QueryRow,
  GaPageRow,
  BarDatum,
  VercelBuildRow,
  VercelPerfMetric,
  GrowthData,
  ProviderResult,
} from "@/lib/growth/types";
import type { Article } from "@/lib/learn";
import type { Tool } from "@/types/tool";

export const page = (over: Partial<PageRow> = {}): PageRow => ({
  page: "/tools/x",
  clicks: 10,
  impressions: 100,
  ctr: 0.1,
  position: 5,
  positionDelta: 0,
  ...over,
});

export const query = (over: Partial<QueryRow> = {}): QueryRow => ({
  query: "q",
  clicks: 10,
  impressions: 100,
  ctr: 0.1,
  position: 5,
  positionDelta: 0,
  ...over,
});

export const gaPage = (over: Partial<GaPageRow> = {}): GaPageRow => ({
  page: "/tools/x",
  views: 10,
  users: 8,
  avgEngagementSec: 90,
  bounceRate: 0.2,
  ...over,
});

export const financeTool = (over: Partial<Tool> = {}): Tool =>
  ({
    id: "income-tax-calculator",
    name: "Income Tax Calculator",
    slug: "income-tax-calculator",
    description: "",
    category: "calculator",
    tags: ["tax", "finance"],
    icon: "🧾",
    url: "/tools/income-tax-calculator",
    ...over,
  }) as Tool;

/**
 * A fully-formed article that triggers no content rule: it has an FAQ, links to a
 * tool, and cross-links a sibling. Override one field to test one rule.
 */
export const article = (over: Partial<Article> = {}): Article => {
  const frontmatter = {
    title: "How to calculate income tax",
    metaDescription: "A short guide.",
    category: "income-tax",
    tags: ["tax"],
    lastUpdated: "2026-07-01",
    reviewedBy: "Reviewer",
    ...over.frontmatter,
  };
  return {
    slug: "how-to-calculate-income-tax",
    readingTime: 5,
    body: "See /tools/income-tax-calculator and /learn/other-article.",
    faqs: [{ question: "Q?", answer: "A." }],
    relatedToolSlugs: ["income-tax-calculator"],
    ...over,
    frontmatter,
  };
};

function wrap<T>(data: T): ProviderResult<T> {
  return { status: "sample", data, fetchedAt: "2026-07-16T08:00:00.000Z" };
}

export interface ContextOverrides {
  now: Date;
  pages?: PageRow[];
  queries?: QueryRow[];
  gaPages?: GaPageRow[];
  sources?: BarDatum[];
  devices?: BarDatum[];
  users?: number;
  returningUsers?: number;
  claritySessions?: number;
  quickBacks?: number;
  deadClicks?: number;
  rageClicks?: number;
  scrollByPage?: { page: string; scrollDepth: number }[];
  clarityActivity?: { page: string; sessions: number; deadClicks: number; rageClicks: number }[];
  latestState?: string;
  builds?: VercelBuildRow[];
  performance?: VercelPerfMetric[];
  tools?: Tool[];
  articles?: Article[];
}

export function makeContext(o: ContextOverrides): AgentContext {
  const growth: GrowthData = {
    searchConsole: wrap({
      totals: { clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
      clicksTrend: [10, 12],
      impressionsTrend: [100, 120],
      topQueries: o.queries ?? [],
      topPages: o.pages ?? [],
      indexCoverage: { indexed: 10, discovered: 0, excluded: 0, errors: 0 },
      sitemap: {
        path: "/sitemap.xml",
        submitted: 10,
        indexed: 10,
        lastRead: "2026-07-15T00:00:00.000Z",
        status: "Success",
      },
    }),
    analytics: wrap({
      totals: {
        users: o.users ?? 1000,
        sessions: 1350,
        engagementRate: 0.65,
        // Default is a healthy 50% so the retention rule stays quiet unless tested.
        returningUsers: o.returningUsers ?? 500,
        avgEngagementSec: 90,
      },
      usersTrend: [100, 110],
      topPages: o.gaPages ?? [],
      sources: o.sources ?? [],
      countries: [],
      devices: o.devices ?? [],
      conversions: [],
    }),
    clarity: wrap({
      sessions: o.claritySessions ?? 100,
      recordings: 40,
      deadClicks: o.deadClicks ?? 0,
      rageClicks: o.rageClicks ?? 0,
      quickBacks: o.quickBacks ?? 0,
      excessiveScroll: 0,
      avgScrollDepth: 0.7,
      scrollByPage: o.scrollByPage ?? [],
      topPagesByActivity: o.clarityActivity ?? [],
    }),
    github: wrap({
      repo: "EasyTechLabs/esytol",
      defaultBranch: "main",
      commits: [],
      releases: [],
      deployments: [],
    }),
    vercel: wrap({
      project: "esytol",
      productionUrl: "https://www.esytol.com",
      latest: {
        state: o.latestState ?? "READY",
        target: "production",
        createdAt: o.now.toISOString(),
        url: "https://www.esytol.com",
      },
      builds: o.builds ?? [],
      performance: o.performance ?? [],
    }),
    insights: [],
    generatedAt: o.now.toISOString(),
    allSample: true,
  };

  return {
    growth,
    tools: o.tools ?? [],
    articles: o.articles ?? [],
    now: o.now,
  };
}

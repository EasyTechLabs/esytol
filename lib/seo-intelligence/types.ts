/**
 * SEO Intelligence Engine — shared types.
 *
 * The SEO brain of EasyTechLabs. Where the Marketing Agent is the **breadth** layer
 * (7 agents across SEO/traffic/UX/engineering/content → one daily briefing), this is
 * the **depth** layer for organic search: seven analysis modules that produce a
 * complete, ranked SEO roadmap.
 *
 * ## No duplicated logic
 * This engine is the *single implementation* of every SEO and content-gap rule.
 * `marketing-agent/agents/seo.ts` and `agents/content.ts` are thin adapters that
 * surface a slice of this engine into the daily briefing — they own no rules.
 *
 * ## Reuse, not re-invention
 * Scoring (`opportunityScore`, `expectedCtr`, `buildRecommendation`, ranking) is
 * imported from `marketing-agent/scoring` — the documented org-wide standard. That
 * module is a leaf (it imports no agents), so there is no cycle. This engine must
 * import from `marketing-agent/scoring` and `marketing-agent/types` **directly**,
 * never from the `marketing-agent` barrel, which would close a cycle.
 *
 * Every module is a pure function of `SeoContext` — deterministic and unit-testable.
 */

import type { AgentContext, Recommendation, Effort, Priority } from "@/lib/marketing-agent/types";

/** The engine reads exactly what the Marketing Agent reads. Same context, deeper analysis. */
export type SeoContext = AgentContext;

export type SeoModuleKey =
  "keywords" | "content-gap" | "internal-links" | "serp" | "clusters" | "ctr";

export interface SeoModule {
  key: SeoModuleKey;
  label: string;
  /** What this module is responsible for — used in reports. */
  purpose: string;
  /** Pure: same context in, same recommendations out. */
  run: (ctx: SeoContext) => Recommendation[];
}

// ── Module data outputs ───────────────────────────────────────────────────────

/** Keyword Opportunity Engine row. */
export interface KeywordOpportunity {
  query: string;
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
  /** Monthly clicks available if the suggested action lands. */
  potentialClickGain: number;
  opportunityScore: number;
  suggestedAction: string;
  /** Which lever applies at this rank. */
  lever: "ctr" | "ranking" | "content" | "defend" | "compound";
}

/** Internal Linking Engine suggestion. */
export interface InternalLinkSuggestion {
  from: string;
  to: string;
  reason: string;
  cluster: string;
  /** Inbound internal links the target has today. */
  currentInbound: number;
}

/** Cluster Health Engine row. */
export interface ClusterHealth {
  key: string;
  label: string;
  tools: number;
  articles: number;
  /** 0..1 — share of the cluster's expected topics that exist. */
  coverage: number;
  /** 0..1 — search authority, derived from rank + clicks of the cluster's pages. */
  authority: number;
  missingTopics: string[];
  priority: Priority;
  /** Business weight of the cluster (finance ≫ everyday). */
  businessValue: number;
}

/** SERP Opportunity Engine classification. */
export type SerpOpportunityKind =
  "featured-snippet" | "people-also-ask" | "faq" | "comparison" | "definition" | "long-tail";

export interface SerpOpportunity {
  kind: SerpOpportunityKind;
  query: string;
  position: number;
  impressions: number;
  action: string;
}

/** CTR Optimizer suggestion — actual copy, not just "rewrite the title". */
export interface CtrSuggestion {
  page: string;
  position: number;
  ctr: number;
  expectedCtr: number;
  impressions: number;
  potentialClickGain: number;
  suggestedTitle: string;
  suggestedDescription: string;
  schemaAdvice: string;
}

// ── Roadmap ───────────────────────────────────────────────────────────────────

export interface SeoRoadmap {
  /** Up to 100 ranked SEO tasks. */
  tasks: Recommendation[];
  /** Cheap + high value: effort S, meaningful score. */
  quickWins: Recommendation[];
  criticalIssues: Recommendation[];
  longTermWork: Recommendation[];
  topOpportunities: Recommendation[];
  /** Total quantified monthly click upside across the roadmap. */
  totalClickUpside: number;
  byModule: { key: SeoModuleKey; label: string; count: number }[];
  byEffort: Record<Effort, number>;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface SeoMetric {
  label: string;
  value: string;
  deltaPct?: number;
  lowerIsBetter?: boolean;
  trend?: number[];
}

export interface DailySeoReport {
  date: string;
  headline: string;
  kpis: SeoMetric[];
  topOpportunities: Recommendation[];
  criticalIssues: Recommendation[];
  quickWins: Recommendation[];
  keywordMovement: { gaining: KeywordOpportunity[]; losing: KeywordOpportunity[] };
}

export interface WeeklySeoReport {
  period: string;
  kpis: SeoMetric[];
  clusterHealth: ClusterHealth[];
  serpOpportunities: SerpOpportunity[];
  internalLinks: InternalLinkSuggestion[];
  ctrSuggestions: CtrSuggestion[];
  insights: string[];
}

export interface MonthlySeoReport {
  period: string;
  /** Strategic coverage/authority picture per cluster. */
  clusterHealth: ClusterHealth[];
  longTermWork: Recommendation[];
  roadmapSummary: string[];
  strategicNotes: string[];
  biggestGaps: string[];
}

export interface SeoIntelligenceResult {
  generatedAt: string;
  allSample: boolean;
  /** Every SEO recommendation, ranked. */
  recommendations: Recommendation[];
  roadmap: SeoRoadmap;
  keywords: KeywordOpportunity[];
  clusters: ClusterHealth[];
  serp: SerpOpportunity[];
  internalLinks: InternalLinkSuggestion[];
  ctr: CtrSuggestion[];
  daily: DailySeoReport;
  weekly: WeeklySeoReport;
  monthly: MonthlySeoReport;
}

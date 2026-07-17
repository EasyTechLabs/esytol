/**
 * Marketing Agent — shared domain types.
 *
 * The Marketing Agent is EasyTechLabs' first AI employee: it reads the Growth
 * Dashboard providers (Search Console, GA4, Clarity, GitHub, Vercel) plus the
 * product's own registry and Learn Center, then produces **ranked, actionable
 * recommendations** and a daily/weekly founder report.
 *
 * Architecture: every agent implements the same `Agent` contract and returns
 * `Recommendation[]`. Scoring, ranking and reporting are shared, so a new agent
 * (competitor, revenue, social, …) plugs in without touching the engine or the UI.
 */

import type { GrowthData } from "@/lib/growth/types";
import type { Article } from "@/lib/learn";
import type { Tool } from "@/types/tool";

// ── Agents ────────────────────────────────────────────────────────────────────

export type AgentKey =
  "seo" | "traffic" | "ux" | "engineering" | "content" | "competitor" | "revenue";

/** "active" agents analyse real signals; "planned" agents are wired but not yet implemented. */
export type AgentStatus = "active" | "planned";

/** Everything an agent may read. Agents are pure functions of this context. */
export interface AgentContext {
  growth: GrowthData;
  tools: Tool[];
  articles: Article[];
  now: Date;
}

export interface Agent {
  key: AgentKey;
  label: string;
  status: AgentStatus;
  /** One-line description of what this agent watches. */
  watches: string;
  /** Pure + deterministic: same context in, same recommendations out. */
  run: (ctx: AgentContext) => Recommendation[];
}

// ── Recommendations ───────────────────────────────────────────────────────────

export type Priority = "critical" | "high" | "medium" | "low";

/** T-shirt effort. Maps to `easeOfFix` in the opportunity score. */
export type Effort = "S" | "M" | "L";

export type Owner = "SEO" | "Content" | "Engineering" | "UX" | "Growth" | "Founder";

export interface Evidence {
  label: string;
  value: string;
}

export interface Recommendation {
  /** Stable, deterministic id — used for de-duplication and tracking. */
  id: string;
  agent: AgentKey;
  category: AgentKey;
  priority: Priority;
  title: string;
  /** Why this surfaced — the evidence, in one sentence. */
  reason: string;
  /** What we expect to gain, in words. */
  expectedImpact: string;
  /** Quantified monthly click upside where derivable. */
  impactClicks?: number;
  effort: Effort;
  /** 0..1 — how sure the agent is that acting will help. */
  confidence: number;
  owner: Owner;
  /** Suggested deadline (ISO date). */
  deadline: string;
  /** 0..100 opportunity score. Higher ranks first. */
  score: number;
  /** The raw numbers behind the call. */
  evidence: Evidence[];
  /** The page/query this concerns, when applicable. */
  page?: string;
  query?: string;
}

// ── Scoring inputs ────────────────────────────────────────────────────────────

/** The four factors of the opportunity score. Each is 0..1. */
export interface ScoreInput {
  /** How much traffic is realistically on the table. */
  trafficPotential: number;
  /** How valuable that traffic is to the business (finance ≫ everyday). */
  businessValue: number;
  /** How cheap the fix is. Derived from `Effort`. */
  easeOfFix: number;
  /** How sure we are. */
  confidence: number;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface TrendPoint {
  label: string;
  value: number;
}

export interface Metric {
  label: string;
  value: string;
  /** Period-over-period change in %, when derivable. */
  deltaPct?: number;
  /** For metrics like position where lower is better. */
  lowerIsBetter?: boolean;
  trend?: number[];
}

export interface ReportSection {
  key: AgentKey | "summary";
  label: string;
  metrics: Metric[];
  /** Top recommendations for this section. */
  recommendations: Recommendation[];
}

export interface DailyReport {
  date: string;
  generatedAt: string;
  /** True when every provider is unconfigured (sample data). */
  /** True when no analytics provider is live — recommendations rest on registry/content data only. */
  noneLive: boolean;
  headline: string;
  yesterday: Metric[];
  wins: string[];
  problems: string[];
  sections: ReportSection[];
  /** The ranked "do these first" list. */
  topPriorities: Recommendation[];
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  futureWork: string[];
}

export interface WeeklyReport {
  period: string;
  generatedAt: string;
  noneLive: boolean;
  kpis: Metric[];
  /** Series for the report graphs. */
  graphs: { label: string; series: number[]; unit?: string }[];
  insights: string[];
  recommendations: Recommendation[];
  progress: string[];
  biggestRisks: string[];
  biggestOpportunities: string[];
}

// ── Agent run output ──────────────────────────────────────────────────────────

export interface AgentRun {
  key: AgentKey;
  label: string;
  status: AgentStatus;
  watches: string;
  recommendations: Recommendation[];
}

export interface MarketingAgentResult {
  generatedAt: string;
  noneLive: boolean;
  agents: AgentRun[];
  /** Every recommendation, ranked by opportunity score. */
  recommendations: Recommendation[];
  daily: DailyReport;
  weekly: WeeklyReport;
}

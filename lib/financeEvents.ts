/**
 * Unified finance event model — PLATFORM-002.
 *
 * Every calculator describes its last stable result as one typed event. This
 * module is the single place that knows what an event means for the rest of
 * the platform: which figures go into calculation history, which single
 * profile field it may update (explicitly, on a user tap — never silently),
 * which deterministic insights it yields, and where the user should go next.
 *
 * It contains NO scoring rules of its own. Every judgement (ratios, targets,
 * pillar states, score deltas) comes from lib/financialRoadmap — one engine —
 * and every read/write goes through lib/localFinance — one store.
 */

import {
  buildRoadmap,
  formatINR,
  EMERGENCY_MONTHS_TARGET,
  EMI_RATIO_CEILING,
  SAVINGS_RATE_TARGET,
  type RoadmapInput,
  type RoadmapResult,
} from "./financialRoadmap";
import {
  readStore,
  recordCalculation,
  applyProfileFields,
  type CalculationFigure,
  type FinanceStore,
} from "./localFinance";

// ── Event types ──────────────────────────────────────────────────────────────

interface EventBase {
  /** Tool slug, e.g. "emi-calculator". */
  slug: string;
  /** Tool display name for history, e.g. "EMI Calculator". */
  name: string;
}

export interface LoanCalculated extends EventBase {
  type: "LoanCalculated";
  emi: number;
  principal: number;
  annualRate: number;
  months: number;
}

export interface InvestmentCalculated extends EventBase {
  type: "InvestmentCalculated";
  monthlyInvestment: number;
  maturityValue: number;
  months: number;
}

export interface TaxCompared extends EventBase {
  type: "TaxCompared";
  annualIncome: number;
  recommended: string;
  totalTax: number;
  taxSaved: number;
}

export interface RetirementPlanned extends EventBase {
  type: "RetirementPlanned";
  projectedCorpus: number;
  monthlyPension?: number;
  /** Override for the corpus figure's label (e.g. "Gratuity payable"). */
  corpusLabel?: string;
}

export interface GrowthProjected extends EventBase {
  type: "GrowthProjected";
  invested: number;
  maturityValue: number;
  months: number;
}

export interface SalaryCalculated extends EventBase {
  type: "SalaryCalculated";
  exemptAmount: number;
  taxableAmount: number;
}

export type FinanceEvent =
  | LoanCalculated
  | InvestmentCalculated
  | TaxCompared
  | RetirementPlanned
  | GrowthProjected
  | SalaryCalculated;

// ── History figures ──────────────────────────────────────────────────────────

function fmtMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
}

/** Headline figures for calculation history — pure re-statement, no judgement. */
export function describeEvent(event: FinanceEvent): CalculationFigure[] {
  switch (event.type) {
    case "LoanCalculated":
      return [
        { label: "EMI", value: `${formatINR(event.emi)}/mo` },
        { label: "Loan", value: formatINR(event.principal) },
        { label: "Tenure", value: fmtMonths(event.months) },
      ];
    case "InvestmentCalculated":
      return [
        { label: "Investing", value: `${formatINR(event.monthlyInvestment)}/mo` },
        { label: "Maturity", value: formatINR(event.maturityValue) },
        { label: "Period", value: fmtMonths(event.months) },
      ];
    case "TaxCompared":
      return [
        { label: "Income", value: `${formatINR(event.annualIncome)}/yr` },
        { label: "Tax", value: formatINR(event.totalTax) },
        { label: "Best", value: `${event.recommended} regime` },
      ];
    case "RetirementPlanned":
      return [
        { label: event.corpusLabel ?? "Projected corpus", value: formatINR(event.projectedCorpus) },
        ...(event.monthlyPension !== undefined
          ? [{ label: "Pension", value: `${formatINR(event.monthlyPension)}/mo` }]
          : []),
      ];
    case "GrowthProjected":
      return [
        { label: "Invested", value: formatINR(event.invested) },
        { label: "Maturity", value: formatINR(event.maturityValue) },
        { label: "Period", value: fmtMonths(event.months) },
      ];
    case "SalaryCalculated":
      return [
        { label: "HRA exempt", value: formatINR(event.exemptAmount) },
        { label: "HRA taxable", value: formatINR(event.taxableAmount) },
      ];
  }
}

/** Record the event's figures into calculation history (auto, debounced by callers). */
export function recordEvent(event: FinanceEvent, now: Date = new Date()): boolean {
  return recordCalculation(event.slug, event.name, describeEvent(event), now);
}

// ── Profile deltas (explicit) ────────────────────────────────────────────────

export interface ProfileDelta {
  /** The single profile field this event may update. */
  field: keyof RoadmapInput;
  label: string;
  value: number;
  /** Current value in the saved profile. */
  currentValue: number;
  /** Plain-language statement of exactly what the tap will do. */
  explanation: string;
}

/**
 * The one profile change this event is allowed to propose. Null when the
 * event carries no current fact (projections never write) or when the value
 * already matches the profile.
 */
export function proposeDelta(event: FinanceEvent, profile: RoadmapInput): ProfileDelta | null {
  let delta: Omit<ProfileDelta, "explanation" | "currentValue"> | null = null;
  switch (event.type) {
    case "LoanCalculated":
      delta = { field: "monthlyEmi", label: "Monthly EMI", value: Math.round(event.emi) };
      break;
    case "InvestmentCalculated":
      delta = {
        field: "monthlyInvesting",
        label: "Monthly investing",
        value: Math.round(event.monthlyInvestment),
      };
      break;
    case "TaxCompared":
      delta = {
        field: "monthlyIncome",
        label: "Monthly income",
        value: Math.round(event.annualIncome / 12),
      };
      break;
    default:
      return null; // projections and salary components never write
  }
  const currentValue = profile[delta.field];
  if (typeof currentValue !== "number" || currentValue === delta.value) return null;
  return {
    ...delta,
    currentValue,
    explanation: `Sets ${delta.label.toLowerCase()} in your plan to ${formatINR(
      delta.value
    )} (currently ${formatINR(currentValue)}). Nothing else changes.`,
  };
}

// ── Applying a delta ─────────────────────────────────────────────────────────

export interface SyncNotification {
  text: string;
  kind: "info" | "improved" | "worsened";
}

export interface SyncOutcome {
  before: RoadmapResult;
  after: RoadmapResult;
  notifications: SyncNotification[];
}

const PILLAR_OF_FIELD: Partial<Record<keyof RoadmapInput, string>> = {
  monthlyEmi: "Debt",
  monthlyInvesting: "Savings & retirement",
  monthlyIncome: "Every income-based",
};

/**
 * Merge one field into the saved profile and report the engine's before/after —
 * the same buildRoadmap() the dashboard and roadmap render, so the numbers in
 * the notification are exactly what the user will see there.
 */
export function applyEventDelta(event: FinanceEvent, now: Date = new Date()): SyncOutcome | null {
  const store = readStore();
  if (!store.profile) return null;
  const delta = proposeDelta(event, store.profile);
  if (!delta) return null;

  const before = buildRoadmap(store.profile);
  const ok = applyProfileFields({ [delta.field]: delta.value }, now);
  if (!ok) return null;
  const after = buildRoadmap({ ...store.profile, [delta.field]: delta.value });

  const notifications: SyncNotification[] = [{ text: "Dashboard updated", kind: "info" }];
  if (after.healthScore !== before.healthScore) {
    notifications.push({
      text: `Health Score ${before.healthScore} → ${after.healthScore}`,
      kind: after.healthScore > before.healthScore ? "improved" : "worsened",
    });
  } else {
    notifications.push({ text: "Health Score unchanged", kind: "info" });
  }
  notifications.push({
    text: `${PILLAR_OF_FIELD[delta.field] ?? "Affected"} pillar recalculated`,
    kind: "info",
  });
  if (after.completedCount > before.completedCount) {
    notifications.push({ text: "Roadmap milestone completed", kind: "improved" });
  } else if (after.completedCount < before.completedCount) {
    notifications.push({ text: "A roadmap milestone reopened", kind: "worsened" });
  }
  return { before, after, notifications };
}

// ── Contextual insights (deterministic) ──────────────────────────────────────

export interface EventInsight {
  text: string;
  tone: "good" | "warn" | "bad" | "neutral";
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Deterministic insights: the event's numbers held against the saved profile
 * using the engine's own published constants. Empty without a profile — we
 * never judge against assumptions the user didn't give us.
 */
export function eventInsights(event: FinanceEvent, store: FinanceStore): EventInsight[] {
  const profile = store.profile;
  if (!profile) return [];
  const insights: EventInsight[] = [];
  const income = profile.monthlyIncome;

  switch (event.type) {
    case "LoanCalculated": {
      if (income > 0) {
        const ratio = event.emi / income;
        const ceiling = EMI_RATIO_CEILING;
        insights.push(
          ratio > ceiling
            ? {
                text: `This EMI alone is ${pct(ratio)} of your monthly income — above the ${pct(ceiling)} ceiling.`,
                tone: "bad",
              }
            : {
                text: `This EMI is ${pct(ratio)} of your monthly income (ceiling ${pct(ceiling)}).`,
                tone: ratio > ceiling * 0.75 ? "warn" : "good",
              }
        );
      }
      if (profile.highInterestDebt > 0) {
        insights.push({
          text: `You have ${formatINR(profile.highInterestDebt)} of high-interest debt — your roadmap clears that before new EMIs.`,
          tone: "warn",
        });
      }
      break;
    }
    case "InvestmentCalculated": {
      if (income > 0) {
        const rate = event.monthlyInvestment / income;
        insights.push(
          rate >= SAVINGS_RATE_TARGET
            ? {
                text: `Investing ${formatINR(event.monthlyInvestment)}/mo is ${pct(rate)} of your income — at or above the ${pct(SAVINGS_RATE_TARGET)} target.`,
                tone: "good",
              }
            : {
                text: `Investing ${formatINR(event.monthlyInvestment)}/mo is ${pct(rate)} of your income (target ${pct(SAVINGS_RATE_TARGET)}).`,
                tone: "warn",
              }
        );
      }
      const retirement = buildRoadmap(profile).pillars.find((p) => p.key === "retirement");
      if (retirement && retirement.score < 1) {
        insights.push({
          text: "Retirement savings are behind your age target — regular investing is how the gap closes.",
          tone: "neutral",
        });
      }
      break;
    }
    case "TaxCompared": {
      const monthly = Math.round(event.annualIncome / 12);
      if (income > 0 && monthly !== income) {
        insights.push({
          text: `This income (${formatINR(monthly)}/mo) differs from your saved profile (${formatINR(income)}/mo).`,
          tone: "neutral",
        });
      }
      if (event.taxSaved > 0) {
        insights.push({
          text: `The ${event.recommended} regime saves you ${formatINR(event.taxSaved)} on these numbers.`,
          tone: "good",
        });
      }
      break;
    }
    case "RetirementPlanned": {
      const retirement = buildRoadmap(profile).pillars.find((p) => p.key === "retirement");
      if (retirement) {
        insights.push({
          text:
            retirement.score >= 1
              ? "Your current retirement corpus is on target for your age."
              : "Retirement savings are behind your age target — this projection shows what steady contributions build.",
          tone: retirement.score >= 1 ? "good" : "warn",
        });
      }
      break;
    }
    case "GrowthProjected": {
      if (profile.monthlyExpenses > 0) {
        const months = event.maturityValue / profile.monthlyExpenses;
        insights.push({
          text: `This maturity equals ${months.toFixed(1)} months of your expenses (emergency target: ${EMERGENCY_MONTHS_TARGET} months).`,
          tone: "neutral",
        });
      }
      break;
    }
    case "SalaryCalculated":
      break;
  }

  const emergencyMonths =
    profile.monthlyExpenses > 0 ? profile.emergencyFund / profile.monthlyExpenses : 0;
  if (emergencyMonths < EMERGENCY_MONTHS_TARGET && event.type !== "SalaryCalculated") {
    insights.push({
      text: `Emergency fund covers ${emergencyMonths.toFixed(1)} months of expenses (target ${EMERGENCY_MONTHS_TARGET}).`,
      tone: emergencyMonths < 3 ? "bad" : "warn",
    });
  }
  return insights;
}

// ── Next steps ───────────────────────────────────────────────────────────────

export interface NextStep {
  label: string;
  href: string;
}

/**
 * Where to go next: the roadmap engine's own links for the user's current
 * milestone, then the dashboard. Without a profile, the roadmap itself is the
 * next step. Never links back to the page the user is on.
 */
export function nextSteps(store: FinanceStore, currentSlug: string): NextStep[] {
  const steps: NextStep[] = [];
  if (store.profile) {
    const result = buildRoadmap(store.profile);
    const current = result.actions.find((a) => a.id === result.currentActionId);
    if (current) {
      steps.push({ label: `Next milestone: ${current.title}`, href: "/tools/financial-roadmap" });
      steps.push(...current.links);
    }
    steps.push({ label: "View your dashboard", href: "/tools/financial-dashboard" });
  } else {
    steps.push({ label: "Build your Financial Roadmap", href: "/tools/financial-roadmap" });
    steps.push({ label: "See the dashboard", href: "/tools/financial-dashboard" });
  }
  const self = `/tools/${currentSlug}`;
  const seen = new Set<string>();
  return steps.filter((s) => {
    if (s.href === self || seen.has(s.href)) return false;
    seen.add(s.href);
    return true;
  });
}

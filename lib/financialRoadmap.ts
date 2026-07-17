/**
 * Financial Roadmap engine — PROJECT-002.
 *
 * Converts a household's financial inputs into (1) a Financial Health Score and
 * (2) a strictly ordered, gated action plan. Pure and deterministic: the same
 * inputs always produce the same plan, every number derives from the user's own
 * inputs, and nothing here predicts markets, recommends products, or names funds.
 *
 * ## The order is the method
 * Actions follow the canonical personal-finance sequence — each step protects the
 * ones after it:
 *
 *   emergency fund → health insurance → life insurance → high-interest debt
 *   → tax optimisation → investing → retirement → wealth building
 *
 * A step is DONE when the inputs already satisfy it, NOT-APPLICABLE when the
 * user's situation genuinely doesn't need it (e.g. term life with no dependants),
 * and otherwise PENDING. The first pending step is the CURRENT one.
 *
 * ## Honesty rules (enforced by construction)
 * - Benefits are stated structurally or computed from the user's own figures
 *   ("6 months of your ₹40,000 expenses = ₹2,40,000"), never from assumed returns.
 * - Timelines estimate *effort to complete the step*, not market outcomes.
 * - All thresholds are standard planning heuristics, declared in
 *   `content/methodology.ts` as assumptions — visible on the page, not buried here.
 */

// ── Inputs ────────────────────────────────────────────────────────────────────

export type PrimaryGoal =
  "stability" | "buy-house" | "children-education" | "early-retirement" | "wealth";

export interface RoadmapInput {
  age: number;
  /** Take-home per month, ₹. */
  monthlyIncome: number;
  hasPartner: boolean;
  /** People who depend on this income (children, parents). */
  dependants: number;
  /** Liquid savings reachable within days, ₹. */
  emergencyFund: number;
  /** Total monthly household spend, ₹. */
  monthlyExpenses: number;
  /** Total EMIs per month, ₹. */
  monthlyEmi: number;
  /** Outstanding balances on loans charging >12% (cards, personal loans), ₹. */
  highInterestDebt: number;
  hasHealthInsurance: boolean;
  /** Health cover, ₹ lakh. */
  healthCoverLakh: number;
  hasTermInsurance: boolean;
  /** Term life cover, ₹ lakh. */
  termCoverLakh: number;
  /** Monthly investing (SIPs, PPF/NPS contributions…), ₹. */
  monthlyInvesting: number;
  /** Retirement corpus so far (EPF + PPF + NPS…), ₹. */
  retirementCorpus: number;
  primaryGoal: PrimaryGoal;
}

// ── Planning heuristics (assumptions — surfaced in the methodology) ──────────

export const EMERGENCY_MONTHS_TARGET = 6;
export const EMERGENCY_MONTHS_MINIMUM = 3;
/** Term cover heuristic: ≈10× annual income (plus loans, noted in copy). */
export const TERM_COVER_MULTIPLE = 10;
/** Health cover floor for a household, ₹ lakh. */
export const HEALTH_COVER_MIN_LAKH = 5;
/** Healthy savings rate benchmark. */
export const SAVINGS_RATE_TARGET = 0.2;
/** EMIs above this share of income signal over-leverage. */
export const EMI_RATIO_CEILING = 0.4;
/** Retirement-corpus ladder: multiples of ANNUAL income by age band. */
export const RETIREMENT_LADDER: ReadonlyArray<readonly [ageUpTo: number, multiple: number]> = [
  [30, 1],
  [40, 3],
  [50, 6],
  [60, 8],
  [200, 10],
];

// ── Output shapes ─────────────────────────────────────────────────────────────

export type ActionStatus = "done" | "pending" | "not-applicable";
export type RiskLevel = "low" | "medium" | "high";
export type Effort = "S" | "M" | "L";

export type ActionId =
  | "emergency-fund"
  | "health-insurance"
  | "life-insurance"
  | "high-interest-debt"
  | "tax-optimisation"
  | "investing"
  | "retirement"
  | "wealth-building";

export interface RoadmapAction {
  id: ActionId;
  step: number;
  title: string;
  status: ActionStatus;
  /** Why this step exists, for this user. */
  whyItMatters: string;
  /** Structural or user-arithmetic benefit — never a return projection. */
  expectedBenefit: string;
  effort: Effort;
  /** Human planning window for the effort ("1–2 weeks"), not a market forecast. */
  effortWindow: string;
  /** Ids of steps that should be completed first. */
  dependencies: ActionId[];
  /** ₹ gap to close where computable from inputs (e.g. emergency-fund top-up). */
  gapAmount?: number;
  /** Deep links into the platform's calculators and guides. */
  links: { label: string; href: string }[];
  /** Present when status === "not-applicable". */
  notApplicableReason?: string;
}

export interface PillarScore {
  key: "emergency" | "protection" | "debt" | "savings" | "retirement";
  label: string;
  /** 0..1 */
  score: number;
  weight: number;
  detail: string;
}

export interface RoadmapResult {
  healthScore: number; // 0..100
  riskLevel: RiskLevel;
  pillars: PillarScore[];
  actions: RoadmapAction[];
  /** Id of the first pending action — where the user should start. */
  currentActionId: ActionId | null;
  completedCount: number;
  applicableCount: number;
  /** completed / applicable, 0..100. */
  completionPct: number;
  /** Sum of pending effort windows, as a human range ("3–9 months"). */
  estimatedTimeline: string;
}

export interface RoadmapValidation {
  [field: string]: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateRoadmapInputs(input: RoadmapInput): RoadmapValidation {
  const errors: RoadmapValidation = {};
  if (!Number.isFinite(input.age) || input.age < 18 || input.age > 100)
    errors.age = "Enter an age between 18 and 100.";
  if (!Number.isFinite(input.monthlyIncome) || input.monthlyIncome <= 0)
    errors.monthlyIncome = "Enter your monthly take-home income.";
  if (!Number.isFinite(input.monthlyExpenses) || input.monthlyExpenses <= 0)
    errors.monthlyExpenses = "Enter your monthly expenses.";
  if (input.monthlyExpenses > input.monthlyIncome * 5)
    errors.monthlyExpenses = "Expenses look implausibly high vs income — please check.";
  for (const key of [
    "emergencyFund",
    "monthlyEmi",
    "highInterestDebt",
    "monthlyInvesting",
    "retirementCorpus",
    "healthCoverLakh",
    "termCoverLakh",
    "dependants",
  ] as const) {
    const v = input[key];
    if (!Number.isFinite(v) || v < 0) errors[key] = "Cannot be negative.";
  }
  return errors;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function retirementTargetMultiple(age: number): number {
  for (const [upTo, multiple] of RETIREMENT_LADDER) if (age <= upTo) return multiple;
  return RETIREMENT_LADDER[RETIREMENT_LADDER.length - 1][1];
}

/** True when this household needs life cover: someone depends on the income. */
function needsTermCover(input: RoadmapInput): boolean {
  return input.dependants > 0 || input.hasPartner;
}

export function scorePillars(input: RoadmapInput): PillarScore[] {
  const emergencyMonths =
    input.monthlyExpenses > 0 ? input.emergencyFund / input.monthlyExpenses : 0;
  const emergency = clamp01(emergencyMonths / EMERGENCY_MONTHS_TARGET);

  const annualIncome = input.monthlyIncome * 12;
  const healthScore = input.hasHealthInsurance
    ? clamp01(input.healthCoverLakh / HEALTH_COVER_MIN_LAKH)
    : 0;
  const termNeeded = needsTermCover(input);
  const termTargetLakh = (annualIncome * TERM_COVER_MULTIPLE) / 100_000;
  const termScore = !termNeeded
    ? 1
    : input.hasTermInsurance
      ? clamp01(input.termCoverLakh / termTargetLakh)
      : 0;
  const protection = (healthScore + termScore) / 2;

  const emiRatio = input.monthlyEmi / input.monthlyIncome;
  const emiScore = emiRatio <= 0 ? 1 : clamp01((EMI_RATIO_CEILING - emiRatio) / EMI_RATIO_CEILING);
  const highInterestScore = input.highInterestDebt <= 0 ? 1 : 0;
  const debt = (emiScore + highInterestScore) / 2;

  const savingsRate = input.monthlyInvesting / input.monthlyIncome;
  const savings = clamp01(savingsRate / SAVINGS_RATE_TARGET);

  const retirementTarget = annualIncome * retirementTargetMultiple(input.age);
  const retirement = retirementTarget > 0 ? clamp01(input.retirementCorpus / retirementTarget) : 0;

  return [
    {
      key: "emergency",
      label: "Emergency fund",
      score: emergency,
      weight: 25,
      detail: `${emergencyMonths.toFixed(1)} months of expenses saved (target ${EMERGENCY_MONTHS_TARGET})`,
    },
    {
      key: "protection",
      label: "Insurance protection",
      score: protection,
      weight: 25,
      detail: termNeeded
        ? `health ${input.hasHealthInsurance ? `₹${input.healthCoverLakh}L` : "none"} · term ${input.hasTermInsurance ? `₹${input.termCoverLakh}L` : "none"} (target ≈₹${Math.round(termTargetLakh)}L)`
        : `health ${input.hasHealthInsurance ? `₹${input.healthCoverLakh}L` : "none"} · term not needed (no dependants)`,
    },
    {
      key: "debt",
      label: "Debt health",
      score: debt,
      weight: 20,
      detail:
        input.highInterestDebt > 0
          ? `₹${fmt(input.highInterestDebt)} high-interest debt outstanding`
          : `EMIs are ${(emiRatio * 100).toFixed(0)}% of income (ceiling ${EMI_RATIO_CEILING * 100}%)`,
    },
    {
      key: "savings",
      label: "Savings rate",
      score: savings,
      weight: 15,
      detail: `investing ${(savingsRate * 100).toFixed(0)}% of income (target ${SAVINGS_RATE_TARGET * 100}%)`,
    },
    {
      key: "retirement",
      label: "Retirement readiness",
      score: retirement,
      weight: 15,
      detail: `corpus ₹${fmt(input.retirementCorpus)} vs ≈₹${fmt(retirementTarget)} typical for age ${input.age}`,
    },
  ];
}

export function healthScoreFrom(pillars: PillarScore[]): number {
  const total = pillars.reduce((sum, p) => sum + p.score * p.weight, 0);
  return Math.round(total);
}

export function riskLevelFor(input: RoadmapInput, pillars: PillarScore[]): RiskLevel {
  const emergencyMonths =
    input.monthlyExpenses > 0 ? input.emergencyFund / input.monthlyExpenses : 0;
  const unprotectedDependants =
    needsTermCover(input) && (!input.hasTermInsurance || input.termCoverLakh <= 0);
  if (
    emergencyMonths < 1 ||
    input.highInterestDebt > 0 ||
    unprotectedDependants ||
    !input.hasHealthInsurance
  ) {
    return "high";
  }
  const score = healthScoreFrom(pillars);
  if (score >= 75) return "low";
  return "medium";
}

// ── The action engine ────────────────────────────────────────────────────────

const EFFORT_WINDOWS: Record<Effort, string> = {
  S: "1–2 weeks",
  M: "1–3 months",
  L: "3–12 months",
};

export function buildActions(input: RoadmapInput): RoadmapAction[] {
  const annualIncome = input.monthlyIncome * 12;
  const emergencyTarget = input.monthlyExpenses * EMERGENCY_MONTHS_TARGET;
  const emergencyGap = Math.max(0, emergencyTarget - input.emergencyFund);
  const emergencyMonths =
    input.monthlyExpenses > 0 ? input.emergencyFund / input.monthlyExpenses : 0;
  const termNeeded = needsTermCover(input);
  const termTargetLakh = Math.round((annualIncome * TERM_COVER_MULTIPLE) / 100_000);
  const savingsRate = input.monthlyIncome > 0 ? input.monthlyInvesting / input.monthlyIncome : 0;
  const retirementTarget = annualIncome * retirementTargetMultiple(input.age);
  const retirementGap = Math.max(0, retirementTarget - input.retirementCorpus);
  const goalLabel: Record<PrimaryGoal, string> = {
    stability: "financial stability",
    "buy-house": "buying a home",
    "children-education": "your children's education",
    "early-retirement": "early retirement",
    wealth: "long-term wealth",
  };

  const actions: RoadmapAction[] = [
    {
      id: "emergency-fund",
      step: 1,
      title: `Build a ${EMERGENCY_MONTHS_TARGET}-month emergency fund`,
      status: emergencyMonths >= EMERGENCY_MONTHS_TARGET ? "done" : "pending",
      whyItMatters:
        "Every later step assumes a shock absorber. Without one, a job loss or medical bill forces you to sell investments at the worst time or borrow at the worst rates.",
      expectedBenefit: `${EMERGENCY_MONTHS_TARGET} months of your ₹${fmt(input.monthlyExpenses)} expenses = ₹${fmt(emergencyTarget)} of protection${emergencyGap > 0 ? ` — you are ₹${fmt(emergencyGap)} away` : " — fully funded"}.`,
      effort: emergencyMonths >= EMERGENCY_MONTHS_MINIMUM ? "M" : "L",
      effortWindow:
        emergencyMonths >= EMERGENCY_MONTHS_MINIMUM ? EFFORT_WINDOWS.M : EFFORT_WINDOWS.L,
      dependencies: [],
      gapAmount: emergencyGap > 0 ? emergencyGap : undefined,
      links: [
        { label: "FD Calculator", href: "/tools/fd-calculator" },
        { label: "Where safe money belongs", href: "/learn/fd-vs-rd-vs-ppf" },
      ],
    },
    {
      id: "health-insurance",
      step: 2,
      title: `Get health cover of at least ₹${HEALTH_COVER_MIN_LAKH} lakh`,
      status:
        input.hasHealthInsurance && input.healthCoverLakh >= HEALTH_COVER_MIN_LAKH
          ? "done"
          : "pending",
      whyItMatters:
        "A single hospitalisation can erase years of savings. Health insurance protects the emergency fund you just built — and the earlier you buy, the cheaper and cleaner the cover.",
      expectedBenefit: input.hasHealthInsurance
        ? `Raising cover from ₹${input.healthCoverLakh}L toward ₹${HEALTH_COVER_MIN_LAKH}L+ keeps one illness from cascading into debt.`
        : "Caps the single largest financial shock an Indian household faces.",
      effort: "S",
      effortWindow: EFFORT_WINDOWS.S,
      dependencies: [],
      links: [
        { label: "Order of operations", href: "/learn/complete-guide-to-investing-in-india" },
      ],
    },
    {
      id: "life-insurance",
      step: 3,
      title: termNeeded ? `Get term life cover of ≈₹${termTargetLakh} lakh` : "Term life insurance",
      status: !termNeeded
        ? "not-applicable"
        : input.hasTermInsurance && input.termCoverLakh >= termTargetLakh * 0.8
          ? "done"
          : "pending",
      notApplicableReason: termNeeded
        ? undefined
        : "No one currently depends on your income — term cover buys nothing. Revisit when that changes.",
      whyItMatters:
        "If people depend on your income, term insurance replaces it if you die. Plain term cover — never endowment or 'investment' policies, which do both jobs badly.",
      expectedBenefit: `≈${TERM_COVER_MULTIPLE}× your annual income (₹${termTargetLakh}L) means your ${input.dependants > 0 ? "family" : "partner"} could maintain life and clear loans without you.`,
      effort: "S",
      effortWindow: EFFORT_WINDOWS.S,
      dependencies: [],
      links: [{ label: "Why term-only", href: "/learn/complete-guide-to-investing-in-india" }],
    },
    {
      id: "high-interest-debt",
      step: 4,
      title: "Clear high-interest debt",
      status: input.highInterestDebt <= 0 ? "done" : "pending",
      whyItMatters:
        "Nothing you invest in reliably beats what a credit card charges. Until this is gone, every other rupee is working against a stronger current.",
      expectedBenefit:
        input.highInterestDebt > 0
          ? `Clearing ₹${fmt(input.highInterestDebt)} is a guaranteed, tax-free return no investment can match — and it frees the EMI for step 6.`
          : "Already clear — your money works for you, not a lender.",
      effort: input.highInterestDebt > annualIncome * 0.25 ? "L" : "M",
      effortWindow:
        input.highInterestDebt > annualIncome * 0.25 ? EFFORT_WINDOWS.L : EFFORT_WINDOWS.M,
      dependencies: ["emergency-fund"],
      gapAmount: input.highInterestDebt > 0 ? input.highInterestDebt : undefined,
      links: [
        { label: "Prepayment strategy", href: "/learn/loan-prepayment-guide" },
        { label: "EMI Calculator", href: "/tools/emi-calculator" },
      ],
    },
    {
      id: "tax-optimisation",
      step: 5,
      title: "Choose your tax regime deliberately (and use what it offers)",
      status: "pending", // a yearly decision — never auto-done; cheap and always worth verifying
      whyItMatters:
        "The regime choice quietly decides whether 80C, HRA and home-loan deductions are worth anything to you. Most people never actually compute both sides.",
      expectedBenefit:
        "Computing both regimes on your real numbers takes minutes and can be worth tens of thousands a year — from a calculator, not a guess.",
      effort: "S",
      effortWindow: EFFORT_WINDOWS.S,
      dependencies: [],
      links: [
        { label: "Income Tax Calculator", href: "/tools/income-tax-calculator" },
        { label: "Section 80C guide", href: "/learn/section-80c-guide" },
      ],
    },
    {
      id: "investing",
      step: 6,
      title: `Invest ${SAVINGS_RATE_TARGET * 100}% of income monthly`,
      status: savingsRate >= SAVINGS_RATE_TARGET ? "done" : "pending",
      whyItMatters: `With protection in place, growth becomes safe to pursue. A fixed monthly SIP matched to your horizon is the engine for ${goalLabel[input.primaryGoal]}.`,
      expectedBenefit:
        savingsRate >= SAVINGS_RATE_TARGET
          ? `You invest ${(savingsRate * 100).toFixed(0)}% of income — at or above the ${SAVINGS_RATE_TARGET * 100}% benchmark.`
          : `Target ₹${fmt(Math.max(0, input.monthlyIncome * SAVINGS_RATE_TARGET - input.monthlyInvesting))} more per month to reach the ${SAVINGS_RATE_TARGET * 100}% benchmark — model outcomes with your own rate assumptions in the SIP calculator.`,
      effort: "M",
      effortWindow: EFFORT_WINDOWS.M,
      dependencies: ["emergency-fund", "health-insurance", "high-interest-debt"],
      links: [
        { label: "SIP Calculator", href: "/tools/sip-calculator" },
        { label: "SIP vs Lumpsum", href: "/learn/sip-vs-lumpsum-vs-swp" },
        { label: "Complete investing guide", href: "/learn/complete-guide-to-investing-in-india" },
      ],
    },
    {
      id: "retirement",
      step: 7,
      title: "Get retirement on the age-ladder",
      status: retirementGap <= 0 ? "done" : "pending",
      whyItMatters:
        "Retirement is the one goal nobody lends you money for. The EPF/PPF/NPS rails compound quietly for decades — but only at the contribution level you actually set.",
      expectedBenefit:
        retirementGap <= 0
          ? `Corpus ₹${fmt(input.retirementCorpus)} meets the ≈${retirementTargetMultiple(input.age)}× annual income marker for age ${input.age}.`
          : `You are ₹${fmt(retirementGap)} behind the ≈${retirementTargetMultiple(input.age)}× annual-income marker for age ${input.age} — project the catch-up in the calculators.`,
      effort: retirementGap > annualIncome ? "L" : "M",
      effortWindow: retirementGap > annualIncome ? EFFORT_WINDOWS.L : EFFORT_WINDOWS.M,
      dependencies: ["investing"],
      gapAmount: retirementGap > 0 ? retirementGap : undefined,
      links: [
        { label: "EPF vs PPF vs NPS", href: "/learn/epf-vs-ppf-vs-nps" },
        { label: "NPS Calculator", href: "/tools/nps-calculator" },
        { label: "PPF Calculator", href: "/tools/ppf-calculator" },
      ],
    },
    {
      id: "wealth-building",
      step: 8,
      title: "Build wealth beyond the basics",
      status: "pending", // open-ended by nature; becomes current only when everything else is done
      whyItMatters: `With the foundation complete, the question changes from "am I safe?" to "what is the money for?" — asset allocation, goal mapping, and ${goalLabel[input.primaryGoal]}.`,
      expectedBenefit:
        "A deliberate allocation across equity, fixed income and gold — rebalanced on a calendar, not on emotion.",
      effort: "L",
      effortWindow: "ongoing",
      dependencies: ["investing", "retirement"],
      links: [
        { label: "Asset allocation", href: "/learn/complete-guide-to-investing-in-india" },
        { label: "Mutual funds, ELSS & ETFs", href: "/learn/mutual-funds-elss-etf-guide" },
        { label: "Capital gains rules", href: "/learn/capital-gains-tax-guide" },
      ],
    },
  ];

  return actions;
}

// ── The full result ──────────────────────────────────────────────────────────

export function buildRoadmap(input: RoadmapInput): RoadmapResult {
  const pillars = scorePillars(input);
  const healthScore = healthScoreFrom(pillars);
  const actions = buildActions(input);

  const applicable = actions.filter((a) => a.status !== "not-applicable");
  const completed = applicable.filter((a) => a.status === "done");
  const pending = applicable.filter((a) => a.status === "pending");
  const current = pending[0] ?? null;

  return {
    healthScore,
    riskLevel: riskLevelFor(input, pillars),
    pillars,
    actions,
    currentActionId: current ? current.id : null,
    completedCount: completed.length,
    applicableCount: applicable.length,
    completionPct: applicable.length ? Math.round((completed.length / applicable.length) * 100) : 0,
    estimatedTimeline: timelineFor(pending),
  };
}

/** Sum pending efforts into a human range. Effort windows, not market forecasts. */
function timelineFor(pending: RoadmapAction[]): string {
  const finite = pending.filter((a) => a.effortWindow !== "ongoing");
  if (finite.length === 0) return pending.length ? "ongoing" : "complete";
  const ranges: Record<Effort, [number, number]> = { S: [0.25, 0.5], M: [1, 3], L: [3, 12] };
  let lo = 0;
  let hi = 0;
  for (const a of finite) {
    lo += ranges[a.effort][0];
    hi += ranges[a.effort][1];
  }
  const fmtMonths = (m: number) =>
    m < 1 ? `${Math.max(1, Math.round(m * 4))} weeks` : `${Math.round(m)} months`;
  return `${fmtMonths(lo)} – ${fmtMonths(hi)}${pending.some((a) => a.effortWindow === "ongoing") ? ", then ongoing" : ""}`;
}

export function formatINR(value: number): string {
  return `₹${fmt(value)}`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

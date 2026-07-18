/**
 * Income Tax Calculation Engine (India) — v2 (multi-year)
 *
 * Computes Indian personal income tax (Old vs New regime) for a selectable
 * assessment year. Pure and deterministic: identical input + assessment year →
 * identical output. Nothing is stored; nothing leaves the caller.
 *
 * Supported assessment years (each a versioned ruleset, history preserved):
 *   - AY 2026-27 (FY 2025-26) — Finance Act, 2025  [default]
 *   - AY 2025-26 (FY 2024-25) — Finance Act, 2024
 *   - AY 2024-25 (FY 2023-24) — Finance Act, 2023
 *
 * Once published, an assessment year's outputs are immutable except via an
 * explicit, changelogged engine release (see docs/IncomeTaxChangelog.md).
 *
 * Rounding: total income (§288A) and total tax payable (§288B) are rounded to
 * the nearest ₹10, as the statute (and the ITD portal) require. Intermediate
 * cess is 4% of (tax after rebate + surcharge), rounded to the rupee.
 *
 * Official sources: Income Tax Department (incometax.gov.in) · CBDT · the
 * Finance Act of each year · §115BAC (new regime) · §87A (rebate) · §288A/§288B
 * (rounding) · First Schedule Part I (rates & surcharge).
 */

import { formatINR } from "./emi";

export { formatINR };

export type TaxRegime = "old" | "new";

/** Supported assessment years. */
export type AssessmentYear = "2024-25" | "2025-26" | "2026-27";

export const ENGINE_VERSION = "2.0.0";
export const SUPPORTED_ASSESSMENT_YEARS: AssessmentYear[] = ["2024-25", "2025-26", "2026-27"];
export const DEFAULT_ASSESSMENT_YEAR: AssessmentYear = "2026-27";

// Retained for backwards compatibility (default assessment year).
export const CURRENT_FY = "2025-26";
export const CURRENT_AY = "2026-27";

interface Slab {
  upTo: number;
  rate: number;
}

interface DeductionCaps {
  section80C: number;
  section80D: number;
  homeLoanInterest: number;
  professionalTax: number;
}

/** The complete, versioned ruleset for one assessment year. */
interface TaxYearConfig {
  assessmentYear: AssessmentYear;
  financialYear: string;
  /** Ruleset version — bumps if a published year's rules are corrected. */
  rulesetVersion: string;
  financeAct: string;
  newRegimeSlabs: Slab[];
  oldRegimeSlabs: Slab[]; // resident individual < 60
  standardDeduction: Record<TaxRegime, number>;
  deductionCaps: DeductionCaps;
  rebate: Record<TaxRegime, { incomeLimit: number; maxRebate: number }>;
  cessRate: number;
}

const OLD_REGIME_SLABS: Slab[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

const STANDARD_CAPS: DeductionCaps = {
  section80C: 150000,
  section80D: 100000,
  homeLoanInterest: 200000,
  professionalTax: 2500,
};

const OLD_REBATE = { incomeLimit: 500000, maxRebate: 12500 };

/** The versioned rulesets. Each is authoritative for its assessment year. */
const TAX_YEARS: Record<AssessmentYear, TaxYearConfig> = {
  // AY 2026-27 (FY 2025-26) — Finance Act, 2025.
  "2026-27": {
    assessmentYear: "2026-27",
    financialYear: "2025-26",
    rulesetVersion: "AY2026-27.1",
    financeAct: "Finance Act, 2025",
    newRegimeSlabs: [
      { upTo: 400000, rate: 0 },
      { upTo: 800000, rate: 0.05 },
      { upTo: 1200000, rate: 0.1 },
      { upTo: 1600000, rate: 0.15 },
      { upTo: 2000000, rate: 0.2 },
      { upTo: 2400000, rate: 0.25 },
      { upTo: Infinity, rate: 0.3 },
    ],
    oldRegimeSlabs: OLD_REGIME_SLABS,
    standardDeduction: { old: 50000, new: 75000 },
    deductionCaps: STANDARD_CAPS,
    rebate: { old: OLD_REBATE, new: { incomeLimit: 1200000, maxRebate: 60000 } },
    cessRate: 0.04,
  },
  // AY 2025-26 (FY 2024-25) — Finance Act, 2024 (July 2024).
  "2025-26": {
    assessmentYear: "2025-26",
    financialYear: "2024-25",
    rulesetVersion: "AY2025-26.1",
    financeAct: "Finance Act, 2024",
    newRegimeSlabs: [
      { upTo: 300000, rate: 0 },
      { upTo: 700000, rate: 0.05 },
      { upTo: 1000000, rate: 0.1 },
      { upTo: 1200000, rate: 0.15 },
      { upTo: 1500000, rate: 0.2 },
      { upTo: Infinity, rate: 0.3 },
    ],
    oldRegimeSlabs: OLD_REGIME_SLABS,
    standardDeduction: { old: 50000, new: 75000 },
    deductionCaps: STANDARD_CAPS,
    rebate: { old: OLD_REBATE, new: { incomeLimit: 700000, maxRebate: 25000 } },
    cessRate: 0.04,
  },
  // AY 2024-25 (FY 2023-24) — Finance Act, 2023.
  "2024-25": {
    assessmentYear: "2024-25",
    financialYear: "2023-24",
    rulesetVersion: "AY2024-25.1",
    financeAct: "Finance Act, 2023",
    newRegimeSlabs: [
      { upTo: 300000, rate: 0 },
      { upTo: 600000, rate: 0.05 },
      { upTo: 900000, rate: 0.1 },
      { upTo: 1200000, rate: 0.15 },
      { upTo: 1500000, rate: 0.2 },
      { upTo: Infinity, rate: 0.3 },
    ],
    oldRegimeSlabs: OLD_REGIME_SLABS,
    standardDeduction: { old: 50000, new: 50000 },
    deductionCaps: STANDARD_CAPS,
    rebate: { old: OLD_REBATE, new: { incomeLimit: 700000, maxRebate: 25000 } },
    cessRate: 0.04,
  },
};

export function isSupportedAssessmentYear(ay: string): ay is AssessmentYear {
  return ay in TAX_YEARS;
}

function configFor(ay: AssessmentYear): TaxYearConfig {
  return TAX_YEARS[ay];
}

// Backwards-compatible exports mirroring the default assessment year.
export const STANDARD_DEDUCTION: Record<TaxRegime, number> =
  TAX_YEARS[DEFAULT_ASSESSMENT_YEAR].standardDeduction;
export const DEDUCTION_CAPS = TAX_YEARS[DEFAULT_ASSESSMENT_YEAR].deductionCaps;

export interface IncomeTaxInput {
  annualSalary: number;
  otherIncome: number;
  /** Chapter VI-A / exemptions — applied in the OLD regime only. */
  section80C: number;
  section80D: number;
  hraExemption: number;
  homeLoanInterest: number;
  professionalTax: number;
  otherDeductions: number;
}

export interface TaxSlabRow {
  label: string;
  rate: number; // %
  taxableInSlab: number;
  tax: number;
}

/** One cited step of the computation — for explainability, audit, and AI citation. */
export interface TraceStep {
  label: string;
  /** The statutory section/authority for this step, where applicable. */
  section: string | null;
  /** Signed rupee effect of this step (deductions are negative). */
  amount: number;
}

/** Reproducibility stamp — which rules and which software produced this result. */
export interface Attribution {
  engineVersion: string;
  assessmentYear: AssessmentYear;
  financialYear: string;
  rulesetVersion: string;
  financeAct: string;
  /** ISO timestamp — present only when the caller supplies a clock (keeps the core pure). */
  computedAt: string | null;
}

export interface RegimeResult {
  regime: TaxRegime;
  grossIncome: number;
  standardDeduction: number;
  otherDeductions: number; // total non-standard deductions applied
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveRate: number; // % of gross income
  monthlyTax: number;
  slabs: TaxSlabRow[];
  /** Cited, ordered computation trace (§-level provenance). */
  trace: TraceStep[];
}

export interface IncomeTaxResult {
  old: RegimeResult;
  new: RegimeResult;
  recommended: TaxRegime;
  taxSaved: number; // absolute saving of the recommended regime vs the other
  /** Reproducibility stamp (engine + ruleset + optional timestamp). */
  attribution: Attribution;
}

export interface IncomeTaxOptions {
  /** Which year's law to apply. Defaults to the current assessment year. */
  assessmentYear?: AssessmentYear;
  /** Supply a clock to stamp `attribution.computedAt`; omit to keep the call pure. */
  now?: Date;
}

export interface IncomeTaxValidationErrors {
  salary?: string;
  otherIncome?: string;
  deductions?: string;
}

// ── Rounding (§288A total income, §288B tax payable — nearest ₹10) ──────────────
function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}
function round0(n: number): number {
  return Math.round(n);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Slab tax ──────────────────────────────────────────────────────────────────

function computeSlabTax(taxable: number, slabs: Slab[]): { tax: number; rows: TaxSlabRow[] } {
  let tax = 0;
  let lower = 0;
  const rows: TaxSlabRow[] = [];
  for (const s of slabs) {
    if (taxable <= lower) break;
    const amt = Math.min(taxable, s.upTo) - lower;
    const slabTax = amt * s.rate;
    tax += slabTax;
    rows.push({
      label:
        s.upTo === Infinity ? `Above ${fmtLakh(lower)}` : `${fmtLakh(lower)} – ${fmtLakh(s.upTo)}`,
      rate: s.rate * 100,
      taxableInSlab: amt,
      tax: slabTax,
    });
    lower = s.upTo;
  }
  return { tax, rows };
}

function fmtLakh(n: number): string {
  if (n === 0) return "₹0";
  if (n % 100000 === 0) return `₹${n / 100000}L`;
  return `₹${(n / 100000).toFixed(2)}L`;
}

// Tax after Section 87A rebate (with marginal relief in the new regime).
function taxAfterRebate(
  taxable: number,
  regime: TaxRegime,
  cfg: TaxYearConfig
): { base: number; rebate: number; net: number } {
  const slabs = regime === "new" ? cfg.newRegimeSlabs : cfg.oldRegimeSlabs;
  const { tax: base } = computeSlabTax(taxable, slabs);
  const r = cfg.rebate[regime];
  if (taxable <= r.incomeLimit) {
    const rebate = Math.min(base, r.maxRebate);
    return { base, rebate, net: Math.max(0, base - rebate) };
  }
  if (regime === "new") {
    // Marginal relief: tax cannot exceed the income above the rebate limit.
    const relievedNet = Math.min(base, taxable - r.incomeLimit);
    return { base, rebate: base - relievedNet, net: relievedNet };
  }
  return { base, rebate: 0, net: base };
}

// Surcharge with marginal relief. Recurses on the band threshold (terminates at
// ₹50L where the rate is 0). Thresholds/rates are stable across supported years.
function surchargeWithRelief(
  taxable: number,
  taxBeforeSurcharge: number,
  regime: TaxRegime,
  cfg: TaxYearConfig
): number {
  const rate = surchargeRate(taxable, regime);
  if (rate === 0) return 0;

  const threshold =
    taxable <= 10000000
      ? 5000000
      : taxable <= 20000000
        ? 10000000
        : taxable <= 50000000
          ? 20000000
          : 50000000;

  let surcharge = taxBeforeSurcharge * rate;

  const taxAtThreshold = taxAfterRebate(threshold, regime, cfg).net;
  const surchargeAtThreshold = surchargeWithRelief(threshold, taxAtThreshold, regime, cfg);
  const capAtThreshold = taxAtThreshold + surchargeAtThreshold;
  const excess = taxable - threshold;

  if (taxBeforeSurcharge + surcharge > capAtThreshold + excess) {
    surcharge = capAtThreshold + excess - taxBeforeSurcharge;
  }
  return Math.max(0, surcharge);
}

function surchargeRate(taxable: number, regime: TaxRegime): number {
  if (taxable <= 5000000) return 0;
  if (taxable <= 10000000) return 0.1;
  if (taxable <= 20000000) return 0.15;
  if (taxable <= 50000000) return 0.25;
  return regime === "new" ? 0.25 : 0.37; // new regime surcharge capped at 25%
}

// ── Per-regime computation ──────────────────────────────────────────────────

function computeRegime(input: IncomeTaxInput, regime: TaxRegime, cfg: TaxYearConfig): RegimeResult {
  const grossIncome = roundTo10(input.annualSalary + input.otherIncome); // §288A
  const standardDeduction = grossIncome > 0 ? cfg.standardDeduction[regime] : 0;
  const caps = cfg.deductionCaps;

  // Non-standard deductions apply only in the OLD regime.
  let otherDeductions = 0;
  if (regime === "old") {
    otherDeductions =
      Math.min(input.section80C, caps.section80C) +
      Math.min(input.section80D, caps.section80D) +
      Math.max(0, input.hraExemption) +
      Math.min(input.homeLoanInterest, caps.homeLoanInterest) +
      Math.min(input.professionalTax, caps.professionalTax) +
      Math.max(0, input.otherDeductions);
  }

  const totalDeductions = standardDeduction + otherDeductions;
  const taxableIncome = roundTo10(Math.max(0, grossIncome - totalDeductions)); // §288A

  const { base, rebate, net } = taxAfterRebate(taxableIncome, regime, cfg);
  const surcharge = surchargeWithRelief(taxableIncome, net, regime, cfg);
  const cess = (net + surcharge) * cfg.cessRate;

  const netR = round0(net);
  const surchargeR = round0(surcharge);
  const cessR = round0(cess);
  const totalTax = roundTo10(netR + surchargeR + cessR); // §288B — exact identity with stored parts

  const { rows } = computeSlabTax(
    taxableIncome,
    regime === "new" ? cfg.newRegimeSlabs : cfg.oldRegimeSlabs
  );

  const trace = buildTrace(regime, cfg, {
    grossIncome,
    standardDeduction,
    otherDeductions,
    taxableIncome,
    base: round0(base),
    rebate: round0(rebate),
    net: netR,
    surcharge: surchargeR,
    cess: cessR,
    totalTax,
  });

  return {
    regime,
    grossIncome,
    standardDeduction,
    otherDeductions,
    totalDeductions,
    taxableIncome,
    taxBeforeRebate: round0(base),
    rebate: round0(rebate),
    taxAfterRebate: netR,
    surcharge: surchargeR,
    cess: cessR,
    totalTax,
    effectiveRate: grossIncome > 0 ? round2((totalTax / grossIncome) * 100) : 0,
    monthlyTax: round0(totalTax / 12),
    slabs: rows,
    trace,
  };
}

// Cited computation trace (§-level provenance) — derived from the same figures.
function buildTrace(
  regime: TaxRegime,
  cfg: TaxYearConfig,
  v: {
    grossIncome: number;
    standardDeduction: number;
    otherDeductions: number;
    taxableIncome: number;
    base: number;
    rebate: number;
    net: number;
    surcharge: number;
    cess: number;
    totalTax: number;
  }
): TraceStep[] {
  const slabAuthority =
    regime === "new" ? "§115BAC & Finance Act First Schedule" : "Finance Act First Schedule";
  const steps: TraceStep[] = [
    { label: "Gross total income", section: null, amount: v.grossIncome },
    { label: "Standard deduction", section: "§16(ia)", amount: -v.standardDeduction },
  ];
  if (regime === "old" && v.otherDeductions > 0) {
    steps.push({
      label: "Chapter VI-A & other deductions",
      section: "Chapter VI-A / §24(b)",
      amount: -v.otherDeductions,
    });
  }
  steps.push(
    { label: "Taxable income (rounded to ₹10)", section: "§288A", amount: v.taxableIncome },
    { label: "Tax on slabs", section: slabAuthority, amount: v.base }
  );
  if (v.rebate > 0) steps.push({ label: "Rebate", section: "§87A", amount: -v.rebate });
  if (v.surcharge > 0)
    steps.push({
      label: "Surcharge",
      section: "Finance Act First Schedule Part I",
      amount: v.surcharge,
    });
  steps.push(
    {
      label: `Health & Education Cess (${cfg.cessRate * 100}%)`,
      section: cfg.financeAct,
      amount: v.cess,
    },
    { label: "Total tax payable (rounded to ₹10)", section: "§288B", amount: v.totalTax }
  );
  return steps;
}

export function calculateIncomeTax(
  input: IncomeTaxInput,
  options: IncomeTaxOptions = {}
): IncomeTaxResult {
  const assessmentYear = options.assessmentYear ?? DEFAULT_ASSESSMENT_YEAR;
  const cfg = configFor(assessmentYear);
  const oldR = computeRegime(input, "old", cfg);
  const newR = computeRegime(input, "new", cfg);
  const recommended: TaxRegime = newR.totalTax <= oldR.totalTax ? "new" : "old";
  const taxSaved = Math.abs(roundTo10(oldR.totalTax - newR.totalTax));
  return {
    old: oldR,
    new: newR,
    recommended,
    taxSaved,
    attribution: {
      engineVersion: ENGINE_VERSION,
      assessmentYear: cfg.assessmentYear,
      financialYear: cfg.financialYear,
      rulesetVersion: cfg.rulesetVersion,
      financeAct: cfg.financeAct,
      computedAt: options.now ? options.now.toISOString() : null,
    },
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateIncomeTaxInputs(
  salary: number,
  otherIncome: number,
  totalDeductions: number
): IncomeTaxValidationErrors {
  const errors: IncomeTaxValidationErrors = {};

  if (isNaN(salary) || salary < 0) {
    errors.salary = "Annual salary cannot be negative";
  } else if (salary > 100_000_000_000) {
    errors.salary = "Annual salary is unrealistically high";
  }

  if (isNaN(otherIncome) || otherIncome < 0) {
    errors.otherIncome = "Other income cannot be negative";
  }

  if (!isNaN(salary) && !isNaN(otherIncome) && salary + otherIncome <= 0) {
    errors.salary = "Enter your annual income to calculate tax";
  }

  if (totalDeductions < 0) {
    errors.deductions = "Deductions cannot be negative";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function resultToCSV(result: IncomeTaxResult): string {
  const rows: (string | number)[][] = [
    ["Item", "Old Regime (₹)", "New Regime (₹)"],
    ["Gross Income", result.old.grossIncome, result.new.grossIncome],
    ["Total Deductions", result.old.totalDeductions, result.new.totalDeductions],
    ["Taxable Income", result.old.taxableIncome, result.new.taxableIncome],
    ["Tax before Rebate", result.old.taxBeforeRebate, result.new.taxBeforeRebate],
    ["Rebate (87A)", result.old.rebate, result.new.rebate],
    ["Tax after Rebate", result.old.taxAfterRebate, result.new.taxAfterRebate],
    ["Surcharge", result.old.surcharge, result.new.surcharge],
    ["Health & Education Cess", result.old.cess, result.new.cess],
    ["Total Tax", result.old.totalTax, result.new.totalTax],
    ["Effective Tax Rate (%)", result.old.effectiveRate, result.new.effectiveRate],
    ["Monthly Tax", result.old.monthlyTax, result.new.monthlyTax],
  ];
  return rows.map((r) => r.join(",")).join("\n");
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

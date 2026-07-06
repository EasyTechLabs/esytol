/**
 * NPS (National Pension System) Projection Engine — India
 *
 * Projects the retirement corpus, lump-sum, and monthly pension for an NPS
 * subscriber contributing monthly until retirement.
 *
 * Official Sources:
 *   - Pension Fund Regulatory and Development Authority (PFRDA)
 *     https://www.pfrda.org.in
 *   - National Pension System Trust — https://npstrust.org.in
 *   - Income Tax Department (Sections 80CCD(1), 80CCD(1B), 80CCD(2), 10(12A))
 *   - Finance Act / Ministry of Finance, Government of India
 *
 * ACCUMULATION (until retirement):
 *   Future value of a monthly annuity due — each contribution is invested at the
 *   start of the month and compounds at the expected monthly return. This mirrors
 *   the AMFI/SIP convention used across Esytol.
 *     FV = P × [((1 + i)^m − 1) ÷ i] × (1 + i)
 *     iterative: balance[k] = (balance[k−1] + P) × (1 + i)
 *   where P = monthly contribution, i = annualReturn/12/100, m = months.
 *
 * AT RETIREMENT (PFRDA rules):
 *   - Up to 60% of the corpus may be withdrawn as a tax-free lump sum.
 *   - At least 40% must be used to purchase an annuity (pension).
 *   - Monthly pension = annuity corpus × annuity rate ÷ 12.
 *
 * Rounding Policy: computations use full IEEE 754 precision; rupee amounts are
 * rounded to the nearest rupee for display and rates to two decimals.
 */

import { formatINR } from "./emi";

export { formatINR };

export const DEFAULT_RETIREMENT_AGE = 60;
export const NPS_MAX_AGE = 75;
export const NPS_MIN_ENTRY_AGE = 18;
export const NPS_MAX_LUMPSUM_PCT = 60; // max tax-free lump sum
export const NPS_MIN_ANNUITY_PCT = 40; // min corpus to annuity

export interface NPSInput {
  currentAge: number;
  retirementAge: number;
  monthlyContribution: number;
  /** Expected annual return during accumulation (%). */
  expectedReturn: number;
  /** Expected annual annuity rate at retirement (%). */
  annuityReturn: number;
  /** Percentage of corpus withdrawn as lump sum (0–60). */
  lumpSumPct: number;
}

export interface NPSYearRow {
  year: number;
  age: number;
  openingBalance: number;
  contribution: number;
  returns: number;
  closingBalance: number;
}

export interface NPSResult {
  months: number;
  years: number;
  totalContributions: number;
  corpus: number;
  estimatedReturns: number;
  lumpSumPct: number;
  annuityPct: number;
  lumpSumAmount: number;
  annuityCorpus: number;
  monthlyPension: number;
  yearWise: NPSYearRow[];
}

export interface NPSValidationErrors {
  currentAge?: string;
  retirementAge?: string;
  monthlyContribution?: string;
  expectedReturn?: string;
  annuityReturn?: string;
  lumpSumPct?: string;
}

// ── Core computation ────────────────────────────────────────────────────────

export function calculateNPS(input: NPSInput): NPSResult {
  const currentAge = Math.max(0, Math.floor(input.currentAge));
  const retirementAge = Math.max(currentAge, Math.floor(input.retirementAge));
  const years = Math.max(0, retirementAge - currentAge);
  const months = years * 12;

  const P = Math.max(0, input.monthlyContribution);
  const i = Math.max(0, input.expectedReturn) / 12 / 100;
  const lumpSumPct = clamp(input.lumpSumPct, 0, NPS_MAX_LUMPSUM_PCT);
  const annuityPct = 100 - lumpSumPct;

  // Annuity-due monthly accumulation, aggregated into year rows.
  let balance = 0;
  const yearWise: NPSYearRow[] = [];
  for (let y = 0; y < years; y++) {
    const opening = balance;
    let yearContribution = 0;
    let yearReturns = 0;
    for (let m = 0; m < 12; m++) {
      const monthReturn = (balance + P) * i;
      balance = balance + P + monthReturn;
      yearContribution += P;
      yearReturns += monthReturn;
    }
    yearWise.push({
      year: y + 1,
      age: currentAge + y + 1,
      openingBalance: round0(opening),
      contribution: round0(yearContribution),
      returns: round0(yearReturns),
      closingBalance: round0(balance),
    });
  }

  const corpus = balance;
  const totalContributions = P * months;
  const estimatedReturns = corpus - totalContributions;

  const lumpSumAmount = corpus * (lumpSumPct / 100);
  const annuityCorpus = corpus - lumpSumAmount;
  const monthlyPension = (annuityCorpus * (Math.max(0, input.annuityReturn) / 100)) / 12;

  return {
    months,
    years,
    totalContributions: round0(totalContributions),
    corpus: round0(corpus),
    estimatedReturns: round0(estimatedReturns),
    lumpSumPct,
    annuityPct,
    lumpSumAmount: round0(lumpSumAmount),
    annuityCorpus: round0(annuityCorpus),
    monthlyPension: round0(monthlyPension),
    yearWise,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateNPSInputs(input: NPSInput): NPSValidationErrors {
  const errors: NPSValidationErrors = {};
  const {
    currentAge,
    retirementAge,
    monthlyContribution,
    expectedReturn,
    annuityReturn,
    lumpSumPct,
  } = input;

  if (isNaN(currentAge) || currentAge < NPS_MIN_ENTRY_AGE) {
    errors.currentAge = `Current age must be at least ${NPS_MIN_ENTRY_AGE}`;
  } else if (currentAge >= NPS_MAX_AGE) {
    errors.currentAge = "Current age is too high for NPS entry";
  }

  if (isNaN(retirementAge) || retirementAge <= currentAge) {
    errors.retirementAge = "Retirement age must be greater than current age";
  } else if (retirementAge > NPS_MAX_AGE) {
    errors.retirementAge = `Retirement age cannot exceed ${NPS_MAX_AGE}`;
  }

  if (isNaN(monthlyContribution) || monthlyContribution <= 0) {
    errors.monthlyContribution = "Monthly contribution must be greater than ₹0";
  } else if (monthlyContribution > 10_000_000) {
    errors.monthlyContribution = "Monthly contribution is unrealistically high";
  }

  if (isNaN(expectedReturn) || expectedReturn < 0) {
    errors.expectedReturn = "Expected return cannot be negative";
  } else if (expectedReturn > 30) {
    errors.expectedReturn = "Expected return is unrealistically high";
  }

  if (isNaN(annuityReturn) || annuityReturn < 0) {
    errors.annuityReturn = "Annuity rate cannot be negative";
  } else if (annuityReturn > 20) {
    errors.annuityReturn = "Annuity rate is unrealistically high";
  }

  if (isNaN(lumpSumPct) || lumpSumPct < 0) {
    errors.lumpSumPct = "Lump sum percentage cannot be negative";
  } else if (lumpSumPct > NPS_MAX_LUMPSUM_PCT) {
    errors.lumpSumPct = `Lump sum cannot exceed ${NPS_MAX_LUMPSUM_PCT}% (min 40% must be annuitised)`;
  }

  return errors;
}

// ── CSV export ──────────────────────────────────────────────────────────────

export function resultToCSV(result: NPSResult): string {
  const header = [
    "Year",
    "Age",
    "Opening Balance (₹)",
    "Contribution (₹)",
    "Returns (₹)",
    "Closing Balance (₹)",
  ];
  const rows = result.yearWise.map((r) => [
    r.year,
    r.age,
    r.openingBalance,
    r.contribution,
    r.returns,
    r.closingBalance,
  ]);
  const summary = [
    [],
    ["Total Contributions", result.totalContributions],
    ["Estimated Returns", result.estimatedReturns],
    ["Corpus at Retirement", result.corpus],
    [`Lump Sum (${result.lumpSumPct}%)`, result.lumpSumAmount],
    [`Annuity Corpus (${result.annuityPct}%)`, result.annuityCorpus],
    ["Monthly Pension", result.monthlyPension],
  ];
  return [header, ...rows, ...summary].map((r) => r.join(",")).join("\n");
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

// ── Internal ────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  if (isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
function round0(n: number): number {
  return Math.round(n);
}

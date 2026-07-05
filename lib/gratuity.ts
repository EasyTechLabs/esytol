/**
 * Gratuity Calculation Engine — India
 *
 * Computes the gratuity payable under the Payment of Gratuity Act, 1972, for
 * both employees covered by the Act and those not covered.
 *
 * Official Sources:
 *   - Payment of Gratuity Act, 1972
 *   - Ministry of Labour & Employment, Government of India
 *   - Office of the Labour Commissioner (guidance)
 *   - Income Tax Department (Section 10(10) — taxability of gratuity)
 *
 * FORMULA (covered under the Act):
 *   Gratuity = (15 × last drawn salary × years of service) ÷ 26
 *   - "salary" = last drawn Basic + Dearness Allowance (monthly)
 *   - 15 = 15 days' wages for each completed year; 26 = working days/month
 *   - Years of service round UP when the trailing months exceed 6
 *     (e.g., 5y 7m → 6 years; 5y 6m → 5 years)
 *
 * FORMULA (not covered under the Act):
 *   Gratuity = (15 × last drawn salary × years of service) ÷ 30
 *   - Only fully COMPLETED years count (trailing months are ignored)
 *
 * ELIGIBILITY: a minimum of 5 years of continuous service is required (except
 *   on death or disablement, which this calculator does not model).
 *
 * MAXIMUM: gratuity is capped at ₹20,00,000 under the Act (2018 amendment).
 *   The same ₹20 lakh is the lifetime tax-exemption ceiling under Section 10(10).
 *
 * Rounding Policy: computations use full IEEE 754 precision; rupee amounts are
 * rounded to the nearest rupee for display.
 */

import { formatINR } from "./emi";

export { formatINR };

export const GRATUITY_CAP = 2000000; // ₹20,00,000
export const MIN_ELIGIBLE_YEARS = 5;
export const DAYS_PER_YEAR = 15;
export const DIVISOR_COVERED = 26;
export const DIVISOR_NOT_COVERED = 30;

export interface GratuityInput {
  /** Last drawn monthly salary = Basic + Dearness Allowance. */
  monthlyBasic: number;
  /** Completed years of service. */
  years: number;
  /** Additional months of service (0–11). */
  months: number;
  /** Whether the employer is covered under the Payment of Gratuity Act, 1972. */
  coveredUnderAct: boolean;
}

export interface GratuityResult {
  lastDrawnSalary: number;
  coveredUnderAct: boolean;
  /** Raw service in years (years + months/12). */
  totalServiceYears: number;
  /** Years used in the formula after applying the rounding rule. */
  eligibleYears: number;
  isEligible: boolean;
  divisor: number;
  daysPerYear: number;
  /** 15 × salary × eligibleYears ÷ divisor, before the cap. */
  formulaGratuity: number;
  /** Formula amount after applying the ₹20 lakh cap. */
  cappedGratuity: number;
  /** Payable gratuity (0 if not eligible). */
  gratuityAmount: number;
  cap: number;
  exemptionLimit: number;
  taxExemptAmount: number;
  taxableAmount: number;
}

export interface GratuityValidationErrors {
  monthlyBasic?: string;
  years?: string;
  months?: string;
}

// ── Core computation ────────────────────────────────────────────────────────

/** Raw (uncapped) gratuity for a given salary, formula-years and coverage. */
function rawGratuity(salary: number, formulaYears: number, coveredUnderAct: boolean): number {
  const divisor = coveredUnderAct ? DIVISOR_COVERED : DIVISOR_NOT_COVERED;
  return (DAYS_PER_YEAR * salary * formulaYears) / divisor;
}

/**
 * Capped gratuity for a whole number of completed years — used for the
 * "gratuity by years of service" projection. Assumes months = 0.
 */
export function gratuityAtService(
  salary: number,
  completedYears: number,
  coveredUnderAct: boolean
): number {
  const years = Math.max(0, completedYears);
  return round0(Math.min(rawGratuity(Math.max(0, salary), years, coveredUnderAct), GRATUITY_CAP));
}

export function calculateGratuity(input: GratuityInput): GratuityResult {
  const salary = Math.max(0, input.monthlyBasic);
  const years = Math.max(0, Math.floor(input.years));
  const months = Math.min(11, Math.max(0, Math.floor(input.months)));
  const covered = input.coveredUnderAct;

  const totalServiceYears = years + months / 12;
  const isEligible = totalServiceYears >= MIN_ELIGIBLE_YEARS;

  // Formula-years: covered rounds up when months > 6; not-covered counts whole years.
  const eligibleYears = covered ? years + (months > 6 ? 1 : 0) : years;
  const divisor = covered ? DIVISOR_COVERED : DIVISOR_NOT_COVERED;

  const formula = rawGratuity(salary, eligibleYears, covered);
  const capped = Math.min(formula, GRATUITY_CAP);
  const gratuityAmount = isEligible ? capped : 0;

  const taxExemptAmount = Math.min(gratuityAmount, GRATUITY_CAP);
  const taxableAmount = Math.max(0, gratuityAmount - GRATUITY_CAP);

  return {
    lastDrawnSalary: round0(salary),
    coveredUnderAct: covered,
    totalServiceYears: round2(totalServiceYears),
    eligibleYears,
    isEligible,
    divisor,
    daysPerYear: DAYS_PER_YEAR,
    formulaGratuity: round0(formula),
    cappedGratuity: round0(capped),
    gratuityAmount: round0(gratuityAmount),
    cap: GRATUITY_CAP,
    exemptionLimit: GRATUITY_CAP,
    taxExemptAmount: round0(taxExemptAmount),
    taxableAmount: round0(taxableAmount),
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateGratuityInputs(input: {
  monthlyBasic: number;
  years: number;
  months: number;
}): GratuityValidationErrors {
  const errors: GratuityValidationErrors = {};
  const { monthlyBasic, years, months } = input;

  if (isNaN(monthlyBasic) || monthlyBasic < 0) {
    errors.monthlyBasic = "Monthly Basic + DA cannot be negative";
  } else if (monthlyBasic === 0) {
    errors.monthlyBasic = "Enter your monthly Basic + DA to calculate gratuity";
  } else if (monthlyBasic > 100_000_000) {
    errors.monthlyBasic = "Monthly salary is unrealistically high";
  }

  if (isNaN(years) || years < 0) {
    errors.years = "Years of service cannot be negative";
  } else if (years > 60) {
    errors.years = "Years of service is unrealistically high";
  }

  if (isNaN(months) || months < 0 || months > 11) {
    errors.months = "Months must be between 0 and 11";
  }

  return errors;
}

// ── CSV export ──────────────────────────────────────────────────────────────

export function resultToCSV(input: GratuityInput, result: GratuityResult): string {
  const rows: (string | number)[][] = [
    ["Item", "Value"],
    ["Last Drawn Salary (Basic + DA)", result.lastDrawnSalary],
    ["Years of Service", Math.floor(input.years)],
    ["Months of Service", Math.min(11, Math.max(0, Math.floor(input.months)))],
    ["Covered under Gratuity Act", result.coveredUnderAct ? "Yes" : "No"],
    ["Eligible (min 5 years)", result.isEligible ? "Yes" : "No"],
    ["Formula Years Used", result.eligibleYears],
    ["Divisor", result.divisor],
    ["Formula Gratuity", result.formulaGratuity],
    ["Cap (₹20 lakh) Applied", result.formulaGratuity > result.cap ? "Yes" : "No"],
    ["Gratuity Amount Payable", result.gratuityAmount],
    ["Tax-Exempt Amount", result.taxExemptAmount],
    ["Taxable Amount", result.taxableAmount],
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

// ── Internal ────────────────────────────────────────────────────────────────

function round0(n: number): number {
  return Math.round(n);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

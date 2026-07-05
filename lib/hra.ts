/**
 * HRA (House Rent Allowance) Exemption Engine — India
 *
 * Computes the tax-exempt portion of House Rent Allowance under Section 10(13A)
 * of the Income-tax Act, 1961, read with Rule 2A of the Income-tax Rules, 1962.
 *
 * Official Sources:
 *   - Income Tax Department, Government of India — https://www.incometax.gov.in
 *   - Section 10(13A), Income-tax Act, 1961
 *   - Rule 2A, Income-tax Rules, 1962
 *   - Central Board of Direct Taxes (CBDT)
 *
 * RULE 2A — the HRA exemption is the LEAST of the following three amounts:
 *   1. Actual HRA received from the employer.
 *   2. Rent paid in excess of 10% of salary  (Rent − 10% × Salary).
 *   3. 50% of salary if the residence is in a metro city
 *      (Delhi, Mumbai, Kolkata, Chennai), otherwise 40% of salary.
 *
 * "Salary" for Rule 2A means Basic Salary + Dearness Allowance (to the extent it
 * forms part of retirement benefits) + commission at a fixed percentage of
 * turnover. This engine takes that figure as the "Basic Salary" input.
 *
 * The HRA exemption is only available in the OLD tax regime; it is not available
 * under the default New Regime (Section 115BAC).
 *
 * Rounding Policy: computations use full IEEE 754 precision; rupee amounts are
 * rounded to the nearest rupee for display, and rates to two decimals.
 */

import { formatINR } from "./emi";

export { formatINR };

export const METRO_CITIES = ["Delhi", "Mumbai", "Kolkata", "Chennai"] as const;
export const METRO_RATE = 0.5;
export const NON_METRO_RATE = 0.4;
export const RENT_SALARY_THRESHOLD = 0.1; // 10% of salary

export interface HRAInput {
  /** Gross annual salary (CTC salary component). */
  annualSalary: number;
  /** Annual Basic Salary (+ DA forming part of retirement benefits). */
  basicSalary: number;
  /** Annual HRA actually received from the employer. */
  hraReceived: number;
  /** Annual rent paid. */
  rentPaid: number;
  /** True if the rented residence is in a metro city. */
  isMetro: boolean;
}

export interface HRARuleRow {
  key: "actual" | "rentExcess" | "percentBasic";
  label: string;
  description: string;
  value: number;
  isWinner: boolean;
}

export interface HRAResult {
  /** Rule 1 — actual HRA received. */
  actualHRA: number;
  /** Rule 2 — rent paid in excess of 10% of basic salary (floored at 0). */
  rentExcess: number;
  /** Rule 3 — 50% (metro) / 40% (non-metro) of basic salary. */
  percentOfBasic: number;
  /** The three rules, with the winning (least) row flagged. */
  rules: HRARuleRow[];
  /** The exemption = least of the three rules (floored at 0). */
  hraExemption: number;
  /** HRA received that remains taxable. */
  taxableHRA: number;
  /** Annual salary that remains taxable after removing the HRA exemption. */
  remainingTaxableSalary: number;
  monthlyExemption: number;
  annualExemption: number;
  /** 0.5 for metro, 0.4 for non-metro. */
  metroRate: number;
  isMetro: boolean;
  /** Exemption as a percentage of HRA received. */
  exemptPercentOfHRA: number;
}

export interface HRAValidationErrors {
  annualSalary?: string;
  basicSalary?: string;
  hraReceived?: string;
  rentPaid?: string;
}

// ── Core computation ────────────────────────────────────────────────────────

export function calculateHRA(input: HRAInput): HRAResult {
  const annualSalary = Math.max(0, input.annualSalary);
  const basicSalary = Math.max(0, input.basicSalary);
  const hraReceived = Math.max(0, input.hraReceived);
  const rentPaid = Math.max(0, input.rentPaid);

  const metroRate = input.isMetro ? METRO_RATE : NON_METRO_RATE;

  // The three Rule 2A amounts.
  const actualHRA = hraReceived;
  const rentExcess = Math.max(0, rentPaid - RENT_SALARY_THRESHOLD * basicSalary);
  const percentOfBasic = metroRate * basicSalary;

  const hraExemption = round0(Math.max(0, Math.min(actualHRA, rentExcess, percentOfBasic)));

  // Which rule "wins" (is the least). Compare on the pre-rounded values.
  const winner: HRARuleRow["key"] =
    rentExcess <= actualHRA && rentExcess <= percentOfBasic
      ? "rentExcess"
      : actualHRA <= percentOfBasic
        ? "actual"
        : "percentBasic";

  const rules: HRARuleRow[] = [
    {
      key: "actual",
      label: "Actual HRA received",
      description: "HRA component paid by your employer",
      value: round0(actualHRA),
      isWinner: winner === "actual",
    },
    {
      key: "rentExcess",
      label: "Rent paid − 10% of Basic",
      description: "Annual rent minus 10% of basic salary",
      value: round0(rentExcess),
      isWinner: winner === "rentExcess",
    },
    {
      key: "percentBasic",
      label: `${Math.round(metroRate * 100)}% of Basic salary`,
      description: input.isMetro ? "Metro city (50%)" : "Non-metro city (40%)",
      value: round0(percentOfBasic),
      isWinner: winner === "percentBasic",
    },
  ];

  const taxableHRA = round0(Math.max(0, hraReceived - hraExemption));
  const remainingTaxableSalary = round0(Math.max(0, annualSalary - hraExemption));

  return {
    actualHRA: round0(actualHRA),
    rentExcess: round0(rentExcess),
    percentOfBasic: round0(percentOfBasic),
    rules,
    hraExemption,
    taxableHRA,
    remainingTaxableSalary,
    monthlyExemption: round0(hraExemption / 12),
    annualExemption: hraExemption,
    metroRate,
    isMetro: input.isMetro,
    exemptPercentOfHRA: hraReceived > 0 ? round2((hraExemption / hraReceived) * 100) : 0,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateHRAInputs(input: {
  annualSalary: number;
  basicSalary: number;
  hraReceived: number;
  rentPaid: number;
}): HRAValidationErrors {
  const errors: HRAValidationErrors = {};
  const { annualSalary, basicSalary, hraReceived, rentPaid } = input;

  if (isNaN(annualSalary) || annualSalary < 0) {
    errors.annualSalary = "Annual salary cannot be negative";
  } else if (annualSalary === 0) {
    errors.annualSalary = "Enter your annual salary to calculate HRA";
  } else if (annualSalary > 100_000_000_000) {
    errors.annualSalary = "Annual salary is unrealistically high";
  }

  if (isNaN(basicSalary) || basicSalary < 0) {
    errors.basicSalary = "Basic salary cannot be negative";
  } else if (basicSalary > annualSalary && annualSalary >= 0) {
    errors.basicSalary = "Basic salary cannot exceed annual salary";
  }

  if (isNaN(hraReceived) || hraReceived < 0) {
    errors.hraReceived = "HRA received cannot be negative";
  } else if (hraReceived > annualSalary && annualSalary >= 0) {
    errors.hraReceived = "HRA received cannot exceed annual salary";
  }

  if (isNaN(rentPaid) || rentPaid < 0) {
    errors.rentPaid = "Rent paid cannot be negative";
  }

  return errors;
}

// ── CSV export ──────────────────────────────────────────────────────────────

export function resultToCSV(input: HRAInput, result: HRAResult): string {
  const rows: (string | number)[][] = [
    ["Item", "Amount (₹)"],
    ["Annual Salary", round0(input.annualSalary)],
    ["Basic Salary", round0(input.basicSalary)],
    ["HRA Received", round0(input.hraReceived)],
    ["Rent Paid", round0(input.rentPaid)],
    ["City Type", input.isMetro ? "Metro" : "Non-Metro"],
    ["Rule 1 — Actual HRA received", result.actualHRA],
    ["Rule 2 — Rent − 10% of Basic", result.rentExcess],
    [`Rule 3 — ${Math.round(result.metroRate * 100)}% of Basic`, result.percentOfBasic],
    ["HRA Exemption (least of the three)", result.hraExemption],
    ["Taxable HRA", result.taxableHRA],
    ["Remaining Taxable Salary", result.remainingTaxableSalary],
    ["Monthly HRA Exemption", result.monthlyExemption],
    ["Annual HRA Exemption", result.annualExemption],
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

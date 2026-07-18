/**
 * Income Tax API contract — v2.
 *
 * The stable, versioned boundary between untrusted callers (a future HTTP route,
 * an SDK, an MCP tool) and the pure engine. It owns input validation and a
 * consistent response envelope; the engine owns the math. Decoupled from the UI
 * input model so the API can evolve independently.
 *
 * Not an HTTP server — this is the contract a server would call. No I/O, no PII
 * stored, deterministic (a timestamp appears only when a clock is supplied).
 */

import {
  calculateIncomeTax,
  isSupportedAssessmentYear,
  SUPPORTED_ASSESSMENT_YEARS,
  type AssessmentYear,
  type IncomeTaxInput,
  type IncomeTaxResult,
} from "./incomeTax";

export const API_VERSION = "1";

/** The public request shape — clean, optional-by-default, decoupled from the UI. */
export interface TaxApiRequest {
  /** Assessment year, e.g. "2026-27". Defaults to the current AY when omitted. */
  assessmentYear?: string;
  income: {
    salary: number;
    other?: number;
  };
  /** Old-regime deductions; ignored by the new regime. All optional. */
  deductions?: {
    section80C?: number;
    section80D?: number;
    hraExemption?: number;
    homeLoanInterest?: number;
    professionalTax?: number;
    other?: number;
  };
}

export interface TaxApiError {
  code: string;
  message: string;
  field?: string;
}

export interface TaxApiResponse {
  ok: boolean;
  apiVersion: string;
  /** Present on success. The full engine result (regimes, trace, attribution). */
  result?: IncomeTaxResult;
  /** Present on failure. */
  errors?: TaxApiError[];
}

interface ApiOptions {
  now?: Date;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Validate an untrusted request and, if valid, compute the tax. Never throws —
 * malformed input returns a typed error envelope, not an exception.
 */
export function computeIncomeTax(request: TaxApiRequest, options: ApiOptions = {}): TaxApiResponse {
  const errors: TaxApiError[] = [];

  // Assessment year
  let assessmentYear: AssessmentYear | undefined;
  if (request.assessmentYear !== undefined) {
    if (!isSupportedAssessmentYear(request.assessmentYear)) {
      errors.push({
        code: "unsupported_assessment_year",
        message: `assessmentYear must be one of: ${SUPPORTED_ASSESSMENT_YEARS.join(", ")}`,
        field: "assessmentYear",
      });
    } else {
      assessmentYear = request.assessmentYear;
    }
  }

  // Income
  const salary = num(request.income?.salary);
  if (salary === null) {
    errors.push({
      code: "invalid_number",
      message: "income.salary must be a finite number",
      field: "income.salary",
    });
  } else if (salary < 0) {
    errors.push({
      code: "negative_value",
      message: "income.salary cannot be negative",
      field: "income.salary",
    });
  }

  const other = request.income?.other ?? 0;
  if (num(other) === null) {
    errors.push({
      code: "invalid_number",
      message: "income.other must be a finite number",
      field: "income.other",
    });
  } else if (other < 0) {
    errors.push({
      code: "negative_value",
      message: "income.other cannot be negative",
      field: "income.other",
    });
  }

  // Deductions (all optional, non-negative, finite)
  const d = request.deductions ?? {};
  const deductionFields: [keyof NonNullable<TaxApiRequest["deductions"]>, number][] = [
    ["section80C", d.section80C ?? 0],
    ["section80D", d.section80D ?? 0],
    ["hraExemption", d.hraExemption ?? 0],
    ["homeLoanInterest", d.homeLoanInterest ?? 0],
    ["professionalTax", d.professionalTax ?? 0],
    ["other", d.other ?? 0],
  ];
  for (const [field, value] of deductionFields) {
    if (num(value) === null) {
      errors.push({
        code: "invalid_number",
        message: `deductions.${field} must be a finite number`,
        field: `deductions.${field}`,
      });
    } else if (value < 0) {
      errors.push({
        code: "negative_value",
        message: `deductions.${field} cannot be negative`,
        field: `deductions.${field}`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, apiVersion: API_VERSION, errors };
  }

  const input: IncomeTaxInput = {
    annualSalary: salary as number,
    otherIncome: other,
    section80C: d.section80C ?? 0,
    section80D: d.section80D ?? 0,
    hraExemption: d.hraExemption ?? 0,
    homeLoanInterest: d.homeLoanInterest ?? 0,
    professionalTax: d.professionalTax ?? 0,
    otherDeductions: d.other ?? 0,
  };

  const result = calculateIncomeTax(input, { assessmentYear, now: options.now });
  return { ok: true, apiVersion: API_VERSION, result };
}

/**
 * Personal Loan Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - Reserve Bank of India (RBI) — retail loans are on a monthly reducing-
 *     balance basis; lenders must disclose the all-in cost of the loan.
 *   - SBI / HDFC / ICICI / Axis Bank / Bank of Baroda / PNB personal-loan
 *     documentation — EMI = P·r·(1+r)^n / ((1+r)^n − 1); a personal loan is
 *     UNSECURED (no collateral, no LTV); a one-time processing fee is levied as
 *     a percentage of the sanctioned loan amount (typically 1%–3%).
 *
 * Reuse:
 *   The amortization core is the bank-grade, two-value-stream EMI engine in
 *   lib/emi.ts (generateEMISchedule / calculateEMIExact). This module does NOT
 *   re-implement amortization; it only derives personal-loan cost quantities
 *   (processing fee, total borrowing cost, effective cost). The schedule shares
 *   the EMI tool's audited accounting guarantees:
 *     row.emi = row.principal + row.interest        (exact, every row)
 *     |Σ principal − loanAmount| ≤ ₹0.01           (final-row correction)
 *     last row balance = 0
 *
 * Formula (EMI, monthly reducing balance):
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 *   where P = loan amount, r = annualRate / 12 / 100, n = tenure in months.
 *   Zero-rate limit: EMI = P / n (equal principal each month).
 *
 * Personal-loan quantities:
 *   Processing Fee        = Loan Amount × feePct / 100        (one-time, upfront)
 *   Total Payment         = Σ EMI = Loan Amount + Total Interest (from schedule)
 *   Total Borrowing Cost  = Total Interest + Processing Fee    (cost of borrowing)
 *
 * Insights:
 *   Interest as % of Principal    = Total Interest / Loan Amount × 100
 *   Effective Cost %              = (Total Interest + Processing Fee) / Loan × 100
 *     — the total rupee cost of borrowing (interest + one-time fee) as a
 *       percentage of the principal. This is a total-cost premium, NOT an
 *       annualised APR/IRR.
 *   Total Years                   = months / 12
 *
 * Rounding Policy:
 *   Amounts follow the EMI engine's 2-decimal (paise) display rounding via the
 *   shared schedule. Personal-loan-specific amounts and percentages are rounded
 *   to 2 decimals. Currency is displayed in whole rupees (formatINR from emi.ts),
 *   consistent with the EMI / Home Loan tools; CSV export retains paise.
 */

import { generateEMISchedule, calculateEMIExact, formatINR, type AmortizationRow } from "./emi";

export { formatINR, calculateEMIExact };
export type { AmortizationRow };

export interface PersonalLoanInput {
  loanAmount: number;
  annualRate: number;
  months: number;
  processingFeePct?: number;
}

export interface PersonalLoanSummary {
  loanAmount: number; // principal
  monthlyEMI: number;
  totalInterest: number;
  totalPayment: number; // Σ EMI = principal + interest
  processingFee: number;
  totalBorrowingCost: number; // interest + processing fee
  effectiveCostPct: number; // %
  interestToPrincipalPct: number; // %
  totalYears: number;
}

export interface PersonalLoanResult {
  summary: PersonalLoanSummary;
  schedule: AmortizationRow[];
}

export interface PersonalLoanValidationErrors {
  amount?: string;
  rate?: string;
  tenure?: string;
  fee?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculatePersonalLoan(input: PersonalLoanInput): PersonalLoanResult {
  const { loanAmount, annualRate, months } = input;
  const feePct = input.processingFeePct ?? 0;

  // Reuse the audited EMI amortization engine (single source of truth).
  const { displaySchedule, summary: emiSummary } = generateEMISchedule({
    principal: loanAmount,
    annualRate,
    months,
  });

  const loanDisplay = round2(loanAmount);
  const processingFee = round2((loanAmount * feePct) / 100);
  const totalBorrowingCost = round2(emiSummary.totalInterest + processingFee);
  const effectiveCostPct = loanDisplay > 0 ? round2((totalBorrowingCost / loanDisplay) * 100) : 0;
  const interestToPrincipalPct =
    loanDisplay > 0 ? round2((emiSummary.totalInterest / loanDisplay) * 100) : 0;

  return {
    summary: {
      loanAmount: loanDisplay,
      monthlyEMI: emiSummary.monthlyEMI,
      totalInterest: emiSummary.totalInterest,
      totalPayment: emiSummary.totalPayment,
      processingFee,
      totalBorrowingCost,
      effectiveCostPct,
      interestToPrincipalPct,
      totalYears: round2(months / 12),
    },
    schedule: displaySchedule,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validatePersonalLoanInputs(
  amount: number,
  rate: number,
  tenure: number,
  tenureUnit: "months" | "years",
  feePct: number
): PersonalLoanValidationErrors {
  const errors: PersonalLoanValidationErrors = {};

  if (isNaN(amount) || amount <= 0) {
    errors.amount = "Loan amount must be greater than ₹0";
  } else if (amount > 1_000_000_000) {
    errors.amount = "Loan amount cannot exceed ₹100 crore";
  }

  if (isNaN(rate) || rate < 0) {
    errors.rate = "Interest rate cannot be negative";
  } else if (rate > 100) {
    errors.rate = "Interest rate cannot exceed 100%";
  }

  // Personal loans typically run up to 7 years (84 months).
  const maxTenure = tenureUnit === "years" ? 7 : 84;
  if (isNaN(tenure) || tenure < 1) {
    errors.tenure = `Minimum tenure is 1 ${tenureUnit === "years" ? "year" : "month"}`;
  } else if (tenure > maxTenure) {
    errors.tenure = `Maximum tenure is ${maxTenure} ${tenureUnit === "years" ? "years" : "months"}`;
  }

  // Processing fee is optional; when present it must be a sane percentage.
  if (!isNaN(feePct)) {
    if (feePct < 0) {
      errors.fee = "Processing fee cannot be negative";
    } else if (feePct > 5) {
      errors.fee = "Processing fee cannot exceed 5%";
    }
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

/**
 * Personal-loan schedule CSV including the Opening Balance column (derived: the
 * opening balance of month k is the closing balance of month k−1, with the
 * first month's opening equal to the loan amount).
 */
export function scheduleToCSV(rows: AmortizationRow[], loanAmount: number): string {
  const header = "Month,Opening Balance,EMI,Principal,Interest,Closing Balance";
  let opening = loanAmount;
  const body = rows
    .map((r) => {
      const line = `${r.month},${opening.toFixed(2)},${r.emi.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`;
      opening = r.balance;
      return line;
    })
    .join("\n");
  return `${header}\n${body}`;
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

// ── Internal ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

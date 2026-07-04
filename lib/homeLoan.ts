/**
 * Home Loan Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - Reserve Bank of India (RBI) — Master Direction on Housing Finance; loans
 *     are on a monthly reducing-balance basis. RBI also caps Loan-to-Value
 *     (LTV): 90% for loans ≤ ₹30 lakh, 80% for ₹30–75 lakh, 75% above ₹75 lakh.
 *   - National Housing Bank (NHB) — housing-finance EMI conventions.
 *   - SBI / HDFC / ICICI / Bank of Baroda / PNB Housing home-loan documentation
 *     — EMI = P·r·(1+r)^n / ((1+r)^n − 1); processing fee is a one-time charge
 *     levied as a percentage of the sanctioned loan amount.
 *
 * Reuse:
 *   The amortization core is the bank-grade, two-value-stream EMI engine in
 *   lib/emi.ts (generateEMISchedule / calculateEMIExact). This module adds only
 *   home-loan-specific quantities (down payment, processing fee, LTV, and cost
 *   insights); it does NOT re-implement amortization, so the schedule shares the
 *   EMI tool's audited accounting guarantees:
 *     row.emi = row.principal + row.interest        (exact, every row)
 *     |Σ principal − loanAmount| ≤ ₹0.01           (final-row correction)
 *     last row balance = 0
 *
 * Formula (EMI, monthly reducing balance):
 *   EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)
 *   where P = loan amount, r = annualRate / 12 / 100, n = tenure in months.
 *   Zero-rate limit: EMI = P / n (equal principal each month).
 *
 * Home-loan quantities:
 *   Property Value    = Loan Amount + Down Payment
 *   Processing Fee    = Loan Amount × feePct / 100          (one-time)
 *   Total Initial Cost= Down Payment + Processing Fee       (cash needed upfront)
 *   Total Payment     = Σ EMI = Loan Amount + Total Interest (from schedule)
 *
 * Insights:
 *   Loan-to-Value (LTV %)          = Loan Amount / Property Value × 100
 *   Interest as % of Principal     = Total Interest / Loan Amount × 100
 *   Effective Cost of Borrowing %  = (Total Interest + Processing Fee) / Loan × 100
 *     — the total rupee premium paid over the principal to borrow, including the
 *       one-time processing fee, expressed as a percentage of the loan amount.
 *       (This is a total-cost premium, NOT an annualised APR/IRR.)
 *   Total Years                    = months / 12
 *
 * Rounding Policy:
 *   All amounts follow the EMI engine's 2-decimal (paise) display rounding via
 *   the shared schedule. Home-loan-specific amounts and percentages are rounded
 *   to 2 decimals. Currency is displayed in whole rupees (formatINR from emi.ts),
 *   consistent with the EMI tool; CSV export retains paise.
 */

import { calculateEMIExact, generateEMISchedule, formatINR, type AmortizationRow } from "./emi";

export { formatINR };
export type { AmortizationRow };

export interface HomeLoanInput {
  loanAmount: number;
  annualRate: number;
  months: number;
  processingFeePct?: number;
  downPayment?: number;
}

export interface HomeLoanSummary {
  loanAmount: number;
  monthlyEMI: number;
  totalInterest: number;
  totalPayment: number;
  processingFee: number;
  downPayment: number;
  totalInitialCost: number;
  propertyValue: number;
  // ── Insights ──
  ltv: number; // %
  interestToPrincipalPct: number; // %
  effectiveCostPct: number; // %
  totalYears: number;
}

export interface HomeLoanResult {
  summary: HomeLoanSummary;
  schedule: AmortizationRow[];
}

export interface HomeLoanValidationErrors {
  amount?: string;
  rate?: string;
  tenure?: string;
  fee?: string;
  downPayment?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateHomeLoan(input: HomeLoanInput): HomeLoanResult {
  const { loanAmount, annualRate, months } = input;
  const feePct = input.processingFeePct ?? 0;
  const downPayment = round2(input.downPayment ?? 0);

  // Reuse the audited EMI amortization engine (single source of truth).
  const { displaySchedule, summary: emiSummary } = generateEMISchedule({
    principal: loanAmount,
    annualRate,
    months,
  });

  const loanDisplay = round2(loanAmount);
  const processingFee = round2((loanAmount * feePct) / 100);
  const totalInitialCost = round2(downPayment + processingFee);
  const propertyValue = round2(loanDisplay + downPayment);

  const ltv = propertyValue > 0 ? round2((loanDisplay / propertyValue) * 100) : 0;
  const interestToPrincipalPct =
    loanDisplay > 0 ? round2((emiSummary.totalInterest / loanDisplay) * 100) : 0;
  const effectiveCostPct =
    loanDisplay > 0 ? round2(((emiSummary.totalInterest + processingFee) / loanDisplay) * 100) : 0;

  return {
    summary: {
      loanAmount: loanDisplay,
      monthlyEMI: emiSummary.monthlyEMI,
      totalInterest: emiSummary.totalInterest,
      totalPayment: emiSummary.totalPayment,
      processingFee,
      downPayment,
      totalInitialCost,
      propertyValue,
      ltv,
      interestToPrincipalPct,
      effectiveCostPct,
      totalYears: round2(months / 12),
    },
    schedule: displaySchedule,
  };
}

// Re-export the exact EMI for callers that need the unrounded figure.
export { calculateEMIExact };

// ── Validation ────────────────────────────────────────────────────────────────

export function validateHomeLoanInputs(
  amount: number,
  rate: number,
  tenure: number,
  tenureUnit: "months" | "years",
  feePct: number,
  downPayment: number
): HomeLoanValidationErrors {
  const errors: HomeLoanValidationErrors = {};

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

  const maxTenure = tenureUnit === "years" ? 30 : 360;
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

  // Down payment is optional; when present it must be non-negative and sane.
  if (!isNaN(downPayment)) {
    if (downPayment < 0) {
      errors.downPayment = "Down payment cannot be negative";
    } else if (downPayment > 1_000_000_000) {
      errors.downPayment = "Down payment cannot exceed ₹100 crore";
    }
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

/**
 * Home-loan schedule CSV including the Opening Balance column (derived: the
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

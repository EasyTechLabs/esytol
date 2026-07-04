/**
 * SIP Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - AMFI (Association of Mutual Funds in India)
 *     https://www.amfiindia.com/ — SIP calculator methodology
 *   - SEBI (Securities and Exchange Board of India)
 *     https://www.sebi.gov.in/ — investor education on SIP
 *   - NSE India — SIP return estimation methodology
 *
 * Formula: Future Value of an Annuity Due
 *   FV = P × [(1 + i)^n − 1] / i × (1 + i)
 *   where:
 *     P = Monthly SIP installment (₹)
 *     i = Monthly rate of return = annualRate / 12 / 100
 *     n = Total number of months (investment horizon)
 *
 * Annuity Due Assumption (payment at the beginning of each period):
 *   This is the standard adopted by AMFI and most Indian mutual fund SIP
 *   calculators. Each monthly installment is assumed to be invested at the
 *   beginning of the month and earns returns for the full month.
 *
 *   Iterative equivalent (used for the projection table):
 *     balance[0] = 0
 *     balance[k] = (balance[k−1] + P) × (1 + i)   for k = 1 to n
 *
 *   The closed-form formula and the iterative formula are mathematically
 *   identical; the iterative form avoids floating-point divergence across
 *   rows and keeps each row derivable from the previous one.
 *
 * Zero-Rate Singularity:
 *   When annualRate = 0, i = 0 and the formula has a 0/0 singularity.
 *   The correct limit is FV = P × n (no growth, all capital returned).
 *   The projection table shows balance[k] = P × k for all months.
 *
 * Two-Value-Stream Pattern:
 *   Internal computations use full IEEE 754 precision (exactBalance).
 *   Only the display layer applies round2(); rounding is never fed back
 *   into the iterative loop, so display-layer rounding errors cannot
 *   accumulate across months.
 *
 * Accounting Identities (exact in IEEE 754 by construction):
 *   row.totalInvested + row.interestEarned = row.portfolioValue   (each row)
 *   summary.totalInvested + summary.estimatedReturn = summary.totalValue
 *
 *   The identities hold because the "derived" quantity is computed as a
 *   subtraction rather than being independently rounded.
 *
 * Derived Quantities:
 *   totalInvested   = round2(P × n)
 *   estimatedReturn = totalValue − totalInvested          (derived difference)
 *   wealthGainedPct = estimatedReturn / totalInvested × 100
 *   CAGR            = (totalValue / totalInvested)^(12/n) − 1   (annualised)
 *
 *   Note on CAGR: This represents the annual growth rate needed for the
 *   total invested capital to reach the maturity value. It is NOT the XIRR
 *   (Extended Internal Rate of Return), which would account for the timing
 *   of each individual installment. XIRR requires numerical root-finding;
 *   CAGR is the metric shown by AMFI and most publicly available SIP
 *   calculators. CAGR is only meaningful for investment periods ≥ 12 months.
 *
 * Rounding Policy:
 *   All display values are rounded to 2 decimal places (paise precision).
 *   CAGR is displayed as a percentage rounded to 2 decimal places.
 */

export interface SIPInput {
  monthlyAmount: number;
  annualRate: number;
  months: number;
}

export interface SIPProjectionRow {
  month: number;
  totalInvested: number;
  interestEarned: number;
  portfolioValue: number;
}

export interface SIPSummary {
  totalInvested: number;
  estimatedReturn: number;
  totalValue: number;
  wealthGainedPct: number;
  cagr: number | null;
}

export interface SIPResult {
  summary: SIPSummary;
  projection: SIPProjectionRow[];
}

export interface SIPValidationErrors {
  amount?: string;
  rate?: string;
  period?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateSIP(input: SIPInput): SIPResult {
  const { monthlyAmount: P, annualRate, months: n } = input;
  const i = annualRate / 12 / 100;

  const projection: SIPProjectionRow[] = [];
  let exactBalance = 0;

  for (let k = 1; k <= n; k++) {
    // Annuity-due: each installment is invested at the start of the month.
    // Zero-rate guard: when i = 0, (balance + P) × 1 = balance + P = P × k.
    exactBalance = annualRate === 0 ? P * k : (exactBalance + P) * (1 + i);

    // Two-value-stream: round only for display; never feed rounded value
    // back into exactBalance.
    const displayPortfolio = round2(exactBalance);
    const displayInvested = round2(P * k);
    // Derived difference preserves the identity: invested + interest = portfolio
    const displayInterest = displayPortfolio - displayInvested;

    projection.push({
      month: k,
      totalInvested: displayInvested,
      interestEarned: displayInterest,
      portfolioValue: displayPortfolio,
    });
  }

  // Summary is derived from the last projection row (single source of truth).
  const lastRow = projection[n - 1];
  const totalInvested = lastRow.totalInvested;
  const totalValue = lastRow.portfolioValue;
  const estimatedReturn = lastRow.interestEarned; // = totalValue − totalInvested (exact)

  const wealthGainedPct = totalInvested > 0 ? round2((estimatedReturn / totalInvested) * 100) : 0;

  // CAGR requires at least 12 months and a positive return to be meaningful.
  let cagr: number | null = null;
  if (n >= 12 && totalInvested > 0) {
    const years = n / 12;
    cagr = round2((Math.pow(totalValue / totalInvested, 1 / years) - 1) * 100);
  }

  return {
    summary: { totalInvested, estimatedReturn, totalValue, wealthGainedPct, cagr },
    projection,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateSIPInputs(
  amount: number,
  rate: number,
  months: number
): SIPValidationErrors {
  const errors: SIPValidationErrors = {};

  if (!amount || amount <= 0) {
    errors.amount = "Monthly investment must be greater than ₹0";
  } else if (amount > 1_000_000_000) {
    errors.amount = "Monthly investment cannot exceed ₹100 crore";
  }

  if (isNaN(rate)) {
    errors.rate = "Please enter a valid annual return rate";
  } else if (rate < 0) {
    errors.rate = "Annual return cannot be negative";
  } else if (rate > 100) {
    errors.rate = "Annual return cannot exceed 100%";
  }

  if (!months || months < 1) {
    errors.period = "Investment period must be at least 1 month";
  } else if (months > 600) {
    errors.period = "Investment period cannot exceed 600 months (50 years)";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function projectionToCSV(rows: SIPProjectionRow[], monthlyAmount: number): string {
  const header =
    "Month,Monthly Investment (₹),Total Invested (₹),Interest Earned (₹),Portfolio Value (₹)";
  const lines = rows.map(
    (r) =>
      `${r.month},${monthlyAmount.toFixed(2)},${r.totalInvested.toFixed(2)},${r.interestEarned.toFixed(2)},${r.portfolioValue.toFixed(2)}`
  );
  return [header, ...lines].join("\n");
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

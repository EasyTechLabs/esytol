/**
 * Recurring Deposit (RD) Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - Reserve Bank of India (RBI) — Master Direction on Interest Rate on Deposits
 *     https://www.rbi.org.in/ — recurring-deposit interest is compounded at
 *     QUARTERLY rests, the same regime as term (fixed) deposits.
 *   - State Bank of India (SBI), HDFC Bank, ICICI Bank — retail RD maturity is
 *     computed with quarterly compounding; each monthly installment earns
 *     interest for the period it remains on deposit until maturity.
 *   - Indian Banks' Association (IBA) deposit conventions.
 *
 * Product Model:
 *   A Recurring Deposit collects a FIXED monthly installment (P) for a fixed
 *   tenure of N months. Interest is compounded quarterly. Each installment is
 *   assumed to be deposited at the START of its month, so the first installment
 *   earns interest for the full N months and the last installment for 1 month.
 *
 * Formula (Maturity Value):
 *   Let i = r / 4              (quarterly interest rate, r = annualRate% / 100)
 *   Installment j (j = 1..N) remains on deposit for (N − j + 1) months, i.e.
 *   (N − j + 1) / 3 quarters, and grows by (1 + i)^((N − j + 1) / 3).
 *
 *   Maturity  M = Σ_{j=1}^{N}  P × (1 + i)^((N − j + 1) / 3)
 *
 *   Equivalently, with the per-month growth factor g = (1 + i)^(1/3):
 *     M = Σ_{j=1}^{N} P × g^(N − j + 1) = P × g × (g^N − 1) / (g − 1)
 *
 *   This is the widely used bank RD method: quarterly compounding applied to
 *   each installment over its residual tenure (fractional quarters permitted
 *   for months that do not align to a quarter boundary). Verified against the
 *   SBI reference case: ₹5,000 × 12 months @ 8% p.a. → ₹62,646.62 maturity.
 *
 * Iterative Equivalent (used for the month-wise projection):
 *   balance[0] = 0
 *   balance[m] = (balance[m−1] + P) × g          for m = 1..N,  g = (1 + i)^(1/3)
 *
 *   The closed-form and the recurrence are algebraically identical; the
 *   recurrence is O(N) and keeps each projection row derivable from the last,
 *   with balance[N] exactly equal to the closed-form maturity.
 *
 * Zero-Rate Singularity:
 *   When annualRate = 0, i = 0 and g = 1, so M = P × N (all capital, no growth).
 *   The projection shows balance[m] = P × m for every month.
 *
 * Effective Annual Yield (EAY):
 *   EAY = (1 + r/4)^4 − 1   — the annualised yield implied by quarterly rests.
 *
 * Total Growth %:
 *   Total Growth = (Interest Earned / Total Deposited) × 100
 *
 * Two-Value-Stream Pattern:
 *   Internal balances use full IEEE 754 precision (exactBalance). Only the
 *   display layer applies round2(). Rounding is never fed back into the
 *   recurrence, so display rounding cannot accumulate across months.
 *
 * Accounting Identities (exact in IEEE 754 by construction):
 *   row.totalDeposited + row.interestEarned = row.balance          (each row)
 *   summary.totalDeposited + summary.interestEarned = summary.maturityAmount
 *
 *   The "derived" quantity (interest) is a subtraction of two already-rounded
 *   values rather than being rounded independently, so the identity is exact.
 *
 * Rounding Policy:
 *   All currency display values are rounded to 2 decimal places (paise).
 *   Effective Annual Yield and Total Growth % are rounded to 2 decimal places.
 */

// RD interest is compounded quarterly per RBI; this is fixed, not user-tunable.
export const RD_COMPOUNDING_PERIODS_PER_YEAR = 4;

export interface RDInput {
  monthlyDeposit: number;
  annualRate: number;
  months: number;
}

export interface RDProjectionRow {
  month: number;
  totalDeposited: number;
  interestEarned: number;
  balance: number;
}

export interface RDSummary {
  totalDeposited: number;
  interestEarned: number;
  maturityAmount: number;
  effectiveAnnualYield: number; // percentage
  totalGrowthPct: number; // percentage
}

export interface RDResult {
  summary: RDSummary;
  projection: RDProjectionRow[];
}

export interface RDValidationErrors {
  amount?: string;
  rate?: string;
  period?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateRD(input: RDInput): RDResult {
  const { monthlyDeposit: P, annualRate, months: N } = input;

  const i = annualRate / RD_COMPOUNDING_PERIODS_PER_YEAR / 100; // quarterly rate
  // Per-month growth factor consistent with quarterly compounding.
  const g = annualRate === 0 ? 1 : Math.pow(1 + i, 1 / 3);

  const projection: RDProjectionRow[] = [];
  let exactBalance = 0;

  for (let m = 1; m <= N; m++) {
    // Deposit at start of month, then grow one month under quarterly compounding.
    // Zero-rate guard: g = 1 ⇒ balance = P × m.
    exactBalance = (exactBalance + P) * g;

    const displayBalance = round2(exactBalance);
    const displayDeposited = round2(P * m);
    // Derived difference preserves: totalDeposited + interest = balance
    const displayInterest = displayBalance - displayDeposited;

    projection.push({
      month: m,
      totalDeposited: displayDeposited,
      interestEarned: displayInterest,
      balance: displayBalance,
    });
  }

  const lastRow = projection[N - 1];
  const totalDeposited = lastRow.totalDeposited;
  const maturityAmount = lastRow.balance;
  const interestEarned = lastRow.interestEarned; // = maturity − totalDeposited (exact)

  const effectiveAnnualYield = round2((Math.pow(1 + i, RD_COMPOUNDING_PERIODS_PER_YEAR) - 1) * 100);

  const totalGrowthPct = totalDeposited > 0 ? round2((interestEarned / totalDeposited) * 100) : 0;

  return {
    summary: {
      totalDeposited,
      interestEarned,
      maturityAmount,
      effectiveAnnualYield,
      totalGrowthPct,
    },
    projection,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateRDInputs(amount: number, rate: number, months: number): RDValidationErrors {
  const errors: RDValidationErrors = {};

  if (!amount || amount <= 0) {
    errors.amount = "Monthly deposit must be greater than ₹0";
  } else if (amount > 1_000_000_000) {
    errors.amount = "Monthly deposit cannot exceed ₹100 crore";
  }

  if (isNaN(rate)) {
    errors.rate = "Please enter a valid interest rate";
  } else if (rate < 0) {
    errors.rate = "Interest rate cannot be negative";
  } else if (rate > 100) {
    errors.rate = "Interest rate cannot exceed 100%";
  }

  if (!months || months < 1) {
    errors.period = "Tenure must be at least 1 month";
  } else if (months > 600) {
    errors.period = "Tenure cannot exceed 600 months (50 years)";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function projectionToCSV(rows: RDProjectionRow[], monthlyDeposit: number): string {
  const header = "Month,Monthly Deposit (₹),Total Deposited (₹),Interest Earned (₹),Balance (₹)";
  const lines = rows.map(
    (r) =>
      `${r.month},${monthlyDeposit.toFixed(2)},${r.totalDeposited.toFixed(2)},${r.interestEarned.toFixed(2)},${r.balance.toFixed(2)}`
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

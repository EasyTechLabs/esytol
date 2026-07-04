/**
 * Fixed Deposit (FD) Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - Reserve Bank of India (RBI) — Master Direction on Interest Rate on Deposits
 *     https://www.rbi.org.in/ — banks compound term-deposit interest at
 *     quarterly rests unless otherwise specified.
 *   - State Bank of India (SBI), HDFC Bank, ICICI Bank, Punjab National Bank —
 *     retail FD maturity value is computed with quarterly compounding by
 *     default (compound interest, quarterly rests).
 *   - Ministry of Finance / IBA deposit conventions.
 *
 * Formula: Compound Interest (Maturity Value)
 *   A = P × (1 + r/n)^(n × t)
 *   where:
 *     P = Principal (deposit amount, ₹)
 *     r = Annual interest rate (as a decimal = rate% / 100)
 *     n = Number of compounding periods per year
 *         (Yearly = 1, Half-Yearly = 2, Quarterly = 4, Monthly = 12)
 *     t = Tenure in years
 *
 *   Interest Earned = A − P
 *
 * Compounding Frequency (n):
 *   Yearly       → 1   (annual rest)
 *   Half-Yearly  → 2   (semi-annual rest)
 *   Quarterly    → 4   (RBI default for bank FDs — quarterly rest)
 *   Monthly      → 12  (monthly rest)
 *
 * Effective Annual Yield (EAY):
 *   EAY = (1 + r/n)^n − 1
 *   The annualised return once intra-year compounding is accounted for.
 *   For quarterly compounding at 7% nominal, EAY ≈ 7.19%.
 *
 * Total Growth %:
 *   Total Growth = (Interest Earned / Principal) × 100
 *
 * Fractional Final Period:
 *   When the tenure does not divide evenly into compounding periods
 *   (e.g. 5 months with quarterly compounding = 1 full quarter + a partial
 *   period), the residual is compounded with a fractional exponent:
 *     balance ×= (1 + r/n)^fraction
 *   This makes the closing balance of the final projection row exactly equal
 *   the closed-form maturity A = P × (1 + r/n)^(n·t), so the table and the
 *   headline maturity figure never disagree. (Some banks apply simple interest
 *   to a broken period; we document that we use the smooth compound extension
 *   for internal consistency between the summary and the schedule.)
 *
 * Two-Value-Stream Pattern:
 *   Internal balances use full IEEE 754 precision (exactBalance). Only the
 *   display layer applies round2(). Rounding is never fed back into the
 *   iterative loop, so display-layer rounding cannot accumulate across periods.
 *
 * Accounting Identities (exact in IEEE 754 by construction):
 *   row.openingBalance + row.interestEarned = row.closingBalance   (each row)
 *   row[k].closingBalance = row[k+1].openingBalance                (chained)
 *   summary.principal + summary.interestEarned = summary.maturityAmount
 *
 *   The identities hold because the "derived" quantity (interest) is computed
 *   as a subtraction of two already-rounded values rather than being rounded
 *   independently.
 *
 * Rounding Policy:
 *   All currency display values are rounded to 2 decimal places (paise).
 *   Effective Annual Yield and Total Growth % are rounded to 2 decimal places.
 *   Bank passbooks typically round the final maturity to the nearest rupee;
 *   we retain paise precision to keep the schedule auditable.
 */

export type CompoundingFrequency = "yearly" | "half-yearly" | "quarterly" | "monthly";

export const COMPOUNDING_OPTIONS: {
  value: CompoundingFrequency;
  label: string;
  periodsPerYear: number;
}[] = [
  { value: "yearly", label: "Yearly", periodsPerYear: 1 },
  { value: "half-yearly", label: "Half-Yearly", periodsPerYear: 2 },
  { value: "quarterly", label: "Quarterly", periodsPerYear: 4 },
  { value: "monthly", label: "Monthly", periodsPerYear: 12 },
];

export function periodsPerYear(freq: CompoundingFrequency): number {
  switch (freq) {
    case "yearly":
      return 1;
    case "half-yearly":
      return 2;
    case "quarterly":
      return 4;
    case "monthly":
      return 12;
  }
}

// Label for a single compounding period (used in the projection table).
export function periodLabel(freq: CompoundingFrequency): string {
  switch (freq) {
    case "yearly":
      return "Year";
    case "half-yearly":
      return "Half-Year";
    case "quarterly":
      return "Quarter";
    case "monthly":
      return "Month";
  }
}

export interface FDInput {
  principal: number;
  annualRate: number;
  months: number;
  frequency: CompoundingFrequency;
}

export interface FDProjectionRow {
  period: number;
  openingBalance: number;
  interestEarned: number;
  closingBalance: number;
}

export interface FDSummary {
  principal: number;
  interestEarned: number;
  maturityAmount: number;
  effectiveAnnualYield: number; // percentage
  totalGrowthPct: number; // percentage
}

export interface FDResult {
  summary: FDSummary;
  projection: FDProjectionRow[];
}

export interface FDValidationErrors {
  principal?: string;
  rate?: string;
  period?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateFD(input: FDInput): FDResult {
  const { principal: P, annualRate, months, frequency } = input;

  const n = periodsPerYear(frequency);
  const t = months / 12; // tenure in years
  const r = annualRate / 100; // annual rate as decimal
  const perPeriodFactor = 1 + r / n; // growth factor for one full period

  const totalPeriods = n * t; // may be fractional
  const fullPeriods = Math.floor(totalPeriods + 1e-9); // guard FP edge on exact boundaries
  const fraction = totalPeriods - fullPeriods;

  const projection: FDProjectionRow[] = [];
  let exactBalance = P;
  let prevDisplay = round2(P);

  // Full compounding periods.
  for (let k = 1; k <= fullPeriods; k++) {
    exactBalance = exactBalance * perPeriodFactor;
    const closing = round2(exactBalance);
    projection.push({
      period: k,
      openingBalance: prevDisplay,
      interestEarned: closing - prevDisplay, // derived difference — identity holds
      closingBalance: closing,
    });
    prevDisplay = closing;
  }

  // Final partial period (broken period), if any.
  if (fraction > 1e-9) {
    exactBalance = exactBalance * Math.pow(perPeriodFactor, fraction);
    const closing = round2(exactBalance);
    projection.push({
      period: fullPeriods + 1,
      openingBalance: prevDisplay,
      interestEarned: closing - prevDisplay,
      closingBalance: closing,
    });
    prevDisplay = closing;
  }

  const principalDisplay = round2(P);
  const maturityAmount = prevDisplay; // = closing of last row (or principal if no periods)
  const interestEarned = maturityAmount - principalDisplay; // derived — identity holds

  // Effective Annual Yield = (1 + r/n)^n − 1
  const effectiveAnnualYield = round2((Math.pow(perPeriodFactor, n) - 1) * 100);

  const totalGrowthPct =
    principalDisplay > 0 ? round2((interestEarned / principalDisplay) * 100) : 0;

  return {
    summary: {
      principal: principalDisplay,
      interestEarned,
      maturityAmount,
      effectiveAnnualYield,
      totalGrowthPct,
    },
    projection,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateFDInputs(
  principal: number,
  rate: number,
  months: number
): FDValidationErrors {
  const errors: FDValidationErrors = {};

  if (!principal || principal <= 0) {
    errors.principal = "Principal must be greater than ₹0";
  } else if (principal > 1_000_000_000) {
    errors.principal = "Principal cannot exceed ₹100 crore";
  }

  if (isNaN(rate)) {
    errors.rate = "Please enter a valid interest rate";
  } else if (rate < 0) {
    errors.rate = "Interest rate cannot be negative";
  } else if (rate > 100) {
    errors.rate = "Interest rate cannot exceed 100%";
  }

  if (!months || months < 1) {
    errors.period = "Investment period must be at least 1 month";
  } else if (months > 600) {
    errors.period = "Investment period cannot exceed 600 months (50 years)";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function projectionToCSV(rows: FDProjectionRow[], unitLabel: string): string {
  const header = `${unitLabel},Opening Balance (₹),Interest Earned (₹),Closing Balance (₹)`;
  const lines = rows.map(
    (r) =>
      `${r.period},${r.openingBalance.toFixed(2)},${r.interestEarned.toFixed(2)},${r.closingBalance.toFixed(2)}`
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

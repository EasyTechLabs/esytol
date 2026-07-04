/**
 * Public Provident Fund (PPF) Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - Ministry of Finance, Government of India — Public Provident Fund Scheme,
 *     2019 (notified under the Government Savings Promotion Act, 1873).
 *     https://www.finmin.nic.in/
 *   - National Savings Institute (NSI) — https://www.nsiindia.gov.in/
 *   - India Post (Department of Posts) — Small Savings Schemes / PPF.
 *   - State Bank of India (SBI) PPF documentation.
 *   - Interest rate notified QUARTERLY by the Ministry of Finance; the current
 *     rate is 7.1% p.a. (in force since Q1 FY2020-21).
 *
 * Deposit Rules (PPF Scheme, 2019):
 *   - Minimum contribution: ₹500 per financial year.
 *   - Maximum contribution: ₹1,50,000 per financial year.
 *   - Statutory maturity: 15 financial years.
 *   - Extension: after maturity, in blocks of 5 years, any number of times,
 *     with or without further contributions. This calculator supports periods
 *     from 15 up to 50 years to model extensions.
 *
 * Interest Calculation Method:
 *   Per the PPF Scheme, interest is computed on the LOWEST balance in the
 *   account between the close of the 5th day and the last day of each month,
 *   and is COMPOUNDED ANNUALLY (credited on 31 March each year).
 *
 *   Standard calculator assumption (as used by SBI and bank PPF calculators):
 *   the full yearly contribution is deposited at the START of the financial
 *   year (on or before 5 April), so it earns interest for the entire year.
 *   Under that assumption the year-wise recurrence is:
 *
 *     opening[1]   = openingBalance
 *     opening[k]   = closing[k−1]
 *     interest[k]  = (opening[k] + contribution) × r          (r = rate% / 100)
 *     closing[k]   = opening[k] + contribution + interest[k]
 *                  = (opening[k] + contribution) × (1 + r)
 *
 *   Closed form (annuity-due future value, with an optional opening balance):
 *     Maturity = openingBalance × (1 + r)^N
 *              + C × [((1 + r)^N − 1) / r] × (1 + r)
 *
 * Outputs:
 *   Total Contribution = C × N              (new contributions over the period)
 *   Total Interest     = Maturity − openingBalance − Total Contribution
 *   Wealth Gain %      = Total Interest / (openingBalance + Total Contribution) × 100
 *
 * Zero-Rate Singularity:
 *   When rate = 0, interest is 0 every year and Maturity = openingBalance + C×N.
 *
 * Two-Value-Stream Pattern:
 *   Internal balances use full IEEE 754 precision (exactBalance). Only the
 *   display layer applies round2(). Rounding is never fed back into the
 *   recurrence, so display rounding cannot accumulate across years.
 *
 * Accounting Identities (exact in IEEE 754 by construction):
 *   row.opening + row.contribution + row.interest = row.closing   (each row)
 *   row[k].closing = row[k+1].opening                             (chained)
 *   openingBalance + totalContribution + totalInterest = maturity (summary)
 *
 *   Interest is a derived subtraction of already-rounded values, so the
 *   identities are exact rather than approximate.
 *
 * Rounding Policy:
 *   All currency display values are rounded to 2 decimal places (paise).
 *   Wealth Gain % is rounded to 2 decimal places. NOTE: an actual PPF account
 *   credits interest rounded to the nearest rupee each year; this calculator
 *   retains paise precision for an auditable schedule, so real passbook figures
 *   may differ by a few rupees over the full term.
 */

// Statutory PPF limits (PPF Scheme, 2019).
export const PPF_MIN_CONTRIBUTION = 500;
export const PPF_MAX_CONTRIBUTION = 150000;
export const PPF_MIN_YEARS = 15;
export const PPF_MAX_YEARS = 50;
export const PPF_CURRENT_RATE = 7.1; // % p.a., Ministry of Finance (current)

export interface PPFInput {
  yearlyContribution: number;
  years: number;
  annualRate: number;
  openingBalance?: number;
}

export interface PPFProjectionRow {
  year: number;
  openingBalance: number;
  contribution: number;
  interest: number;
  closingBalance: number;
}

export interface PPFSummary {
  totalContribution: number;
  totalInterest: number;
  maturityValue: number;
  wealthGainPct: number;
  openingBalance: number;
}

export interface PPFResult {
  summary: PPFSummary;
  projection: PPFProjectionRow[];
}

export interface PPFValidationErrors {
  contribution?: string;
  years?: string;
  rate?: string;
  openingBalance?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculatePPF(input: PPFInput): PPFResult {
  const { yearlyContribution: C, years: N, annualRate } = input;
  const opening0 = input.openingBalance ?? 0;
  const r = annualRate / 100;

  const projection: PPFProjectionRow[] = [];
  let exactBalance = opening0;
  let prevClosingDisplay = round2(opening0);
  const contributionDisplay = round2(C);

  for (let k = 1; k <= N; k++) {
    const openingDisplay = prevClosingDisplay;
    // Contribution at start of year, then annual compounding.
    // Zero-rate guard: r = 0 ⇒ closing = opening + contribution.
    exactBalance = (exactBalance + C) * (1 + r);
    const closingDisplay = round2(exactBalance);
    // Derived difference preserves: opening + contribution + interest = closing
    const interestDisplay = closingDisplay - openingDisplay - contributionDisplay;

    projection.push({
      year: k,
      openingBalance: openingDisplay,
      contribution: contributionDisplay,
      interest: interestDisplay,
      closingBalance: closingDisplay,
    });
    prevClosingDisplay = closingDisplay;
  }

  const openingBalanceDisplay = round2(opening0);
  const totalContribution = round2(contributionDisplay * N);
  const maturityValue = prevClosingDisplay; // closing of last year (or opening if N=0)
  // Derived so that opening + contribution + interest = maturity exactly.
  const totalInterest = maturityValue - openingBalanceDisplay - totalContribution;

  const invested = openingBalanceDisplay + totalContribution;
  const wealthGainPct = invested > 0 ? round2((totalInterest / invested) * 100) : 0;

  return {
    summary: {
      totalContribution,
      totalInterest,
      maturityValue,
      wealthGainPct,
      openingBalance: openingBalanceDisplay,
    },
    projection,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validatePPFInputs(
  contribution: number,
  years: number,
  rate: number,
  openingBalance: number
): PPFValidationErrors {
  const errors: PPFValidationErrors = {};

  if (isNaN(contribution) || contribution <= 0) {
    errors.contribution = "Yearly contribution is required";
  } else if (contribution < PPF_MIN_CONTRIBUTION) {
    errors.contribution = `Minimum yearly contribution is ₹${PPF_MIN_CONTRIBUTION}`;
  } else if (contribution > PPF_MAX_CONTRIBUTION) {
    errors.contribution = "Maximum yearly contribution is ₹1,50,000";
  }

  if (isNaN(years) || years < 1) {
    errors.years = "Investment period is required";
  } else if (years < PPF_MIN_YEARS) {
    errors.years = "PPF has a minimum lock-in of 15 years";
  } else if (years > PPF_MAX_YEARS) {
    errors.years = "Investment period cannot exceed 50 years";
  }

  if (isNaN(rate)) {
    errors.rate = "Please enter a valid interest rate";
  } else if (rate < 0) {
    errors.rate = "Interest rate cannot be negative";
  } else if (rate > 15) {
    errors.rate = "Interest rate cannot exceed 15%";
  }

  if (isNaN(openingBalance) || openingBalance < 0) {
    errors.openingBalance = "Opening balance cannot be negative";
  } else if (openingBalance > 1_000_000_000) {
    errors.openingBalance = "Opening balance cannot exceed ₹100 crore";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function projectionToCSV(rows: PPFProjectionRow[]): string {
  const header = "Year,Opening Balance (₹),Contribution (₹),Interest (₹),Closing Balance (₹)";
  const lines = rows.map(
    (r) =>
      `${r.year},${r.openingBalance.toFixed(2)},${r.contribution.toFixed(2)},${r.interest.toFixed(2)},${r.closingBalance.toFixed(2)}`
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

/**
 * Lumpsum Investment Calculation Engine — Accounting Policy
 *
 * Official / Reference Sources:
 *   - AMFI (Association of Mutual Funds in India) — lumpsum return methodology:
 *     a one-time investment growing at a compounded annual rate.
 *   - SEBI Investor Education — point-to-point (CAGR) growth of a single
 *     investment; returns beyond one year are expressed on a compounded basis.
 *   - CFA Institute — future value of a single sum: FV = PV × (1 + r)^t.
 *   - RBI (where applicable) — compounding conventions.
 *
 * Formula (Future Value of a single lump sum):
 *   FV = P × (1 + r)^t
 *   where:
 *     P = Initial investment (₹)
 *     r = Expected annual return as a decimal (= rate% / 100)
 *     t = Investment period in years (months ÷ 12 for month inputs)
 *
 * Derived Outputs:
 *   Estimated Returns   = FV − P                       (may be negative on a loss)
 *   Wealth Gain %       = (FV − P) / P × 100
 *   CAGR                = (FV / P)^(1/t) − 1 = r        (exact — constant growth)
 *   Investment Multiple = FV / P = (1 + r)^t           (e.g. 3.11×)
 *
 *   Because the growth rate is assumed constant, the CAGR equals the expected
 *   annual return exactly; this is surfaced as a distinct output for clarity.
 *
 * Edge Cases:
 *   - Zero return (r = 0): FV = P, returns = 0, multiple = 1.00×.
 *   - Negative return (−100% < r < 0): 0 < (1 + r) < 1 ⇒ FV < P (a loss); valid.
 *   - Total loss (r = −100%): (1 + r) = 0 ⇒ FV = 0 (Math.pow(0, t) = 0), −100%.
 *   - INVALID: P ≤ 0 (nothing invested), r < −100% (cannot lose more than the
 *     whole investment; base would be negative and the root complex) — both
 *     rejected by validation.
 *
 * Yearly Projection:
 *   closing(k) = P × (1 + r)^k for full years 1..floor(t); when t is fractional
 *   a final row at exactly `t` is appended whose closing value equals the
 *   maturity value (P × (1 + r)^t), so the schedule terminates precisely at FV.
 *     opening(1) = P,  opening(k) = closing(k−1),  growth(k) = closing − opening
 *
 * Two-Value-Stream Pattern:
 *   The projection is computed from the exact rate at full IEEE 754 precision;
 *   only the display layer applies round2(). Per-row growth and estimated
 *   returns are derived subtractions of already-rounded values, so the
 *   identities
 *     opening(k) + growth(k) = closing(k)
 *     initialInvestment + estimatedReturns = maturityValue
 *   hold exactly rather than approximately.
 *
 * Rounding Policy:
 *   Currency values and the Investment Multiple are rounded to 2 decimals.
 *   CAGR %, Wealth Gain %, and per-row values are rounded to 2 decimals.
 */

export interface LumpsumInput {
  initialInvestment: number;
  annualRate: number; // percent, may be negative down to −100
  months: number; // total period in months
}

export interface LumpsumProjectionRow {
  year: number; // integer for full years, fractional for a final partial year
  openingValue: number;
  growth: number;
  closingValue: number;
}

export interface LumpsumSummary {
  initialInvestment: number;
  estimatedReturns: number;
  maturityValue: number;
  wealthGainPct: number;
  cagrPct: number;
  investmentMultiple: number;
  years: number;
}

export interface LumpsumResult {
  summary: LumpsumSummary;
  projection: LumpsumProjectionRow[];
}

export interface LumpsumValidationErrors {
  amount?: string;
  rate?: string;
  period?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateLumpsum(input: LumpsumInput): LumpsumResult {
  const { initialInvestment: P, annualRate, months } = input;
  const years = months / 12;
  const r = annualRate / 100;
  const growthFactor = 1 + r; // ≥ 0 for valid inputs (r ≥ −1); Math.pow(0, t) = 0

  const exactFV = P * Math.pow(growthFactor, years);

  const projection: LumpsumProjectionRow[] = [];
  const fullYears = Math.floor(years + 1e-9); // guard FP dust on exact boundaries
  const fraction = years - fullYears;

  const initialDisplay = round2(P);
  const maturityValue = round2(exactFV);

  let prevDisplay = initialDisplay;
  for (let k = 1; k <= fullYears; k++) {
    const closing = round2(P * Math.pow(growthFactor, k));
    projection.push({
      year: k,
      openingValue: prevDisplay,
      growth: closing - prevDisplay, // derived — identity holds
      closingValue: closing,
    });
    prevDisplay = closing;
  }

  // Final fractional year — terminates exactly at the maturity value.
  if (fraction > 1e-9) {
    projection.push({
      year: round2(years),
      openingValue: prevDisplay,
      growth: maturityValue - prevDisplay,
      closingValue: maturityValue,
    });
    prevDisplay = maturityValue;
  }

  // Derived so that initialInvestment + estimatedReturns = maturityValue exactly.
  const estimatedReturns = maturityValue - initialDisplay;
  const wealthGainPct = initialDisplay > 0 ? round2((estimatedReturns / initialDisplay) * 100) : 0;
  const investmentMultiple = P !== 0 ? round2(exactFV / P) : 0;

  return {
    summary: {
      initialInvestment: initialDisplay,
      estimatedReturns,
      maturityValue,
      wealthGainPct,
      cagrPct: round2(annualRate), // CAGR = r for constant-growth lumpsum
      investmentMultiple,
      years,
    },
    projection,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateLumpsumInputs(
  amount: number,
  rate: number,
  months: number
): LumpsumValidationErrors {
  const errors: LumpsumValidationErrors = {};

  if (isNaN(amount) || amount <= 0) {
    errors.amount = "Initial investment must be greater than ₹0";
  } else if (amount > 1_000_000_000) {
    errors.amount = "Initial investment cannot exceed ₹100 crore";
  }

  if (isNaN(rate)) {
    errors.rate = "Please enter a valid return rate";
  } else if (rate < -100) {
    errors.rate = "Return cannot be less than −100%";
  } else if (rate > 100) {
    errors.rate = "Return cannot exceed 100%";
  }

  if (isNaN(months) || months < 1) {
    errors.period = "Investment period must be at least 1 month";
  } else if (months > 600) {
    errors.period = "Investment period cannot exceed 600 months (50 years)";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function projectionToCSV(rows: LumpsumProjectionRow[]): string {
  const header = "Year,Opening Value (₹),Growth (₹),Closing Value (₹)";
  const lines = rows.map(
    (r) =>
      `${r.year},${r.openingValue.toFixed(2)},${r.growth.toFixed(2)},${r.closingValue.toFixed(2)}`
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

/**
 * CAGR (Compound Annual Growth Rate) Calculation Engine — Accounting Policy
 *
 * Official / Reference Sources:
 *   - CFA Institute curriculum — CAGR is the geometric mean annual growth rate
 *     of an investment over a period longer (or shorter) than one year.
 *   - NSE India / BSE India investor education — CAGR smooths a multi-year
 *     return into a single annualised rate.
 *   - SEBI investor education resources — mutual fund returns over periods > 1
 *     year must be shown as CAGR (not absolute or simple-annualised returns).
 *   - Terminology cross-checked against Investopedia.
 *
 * Formula:
 *   CAGR = (Ending / Beginning)^(1 / Years) − 1
 *   where Years = investment period in years (months ÷ 12 for month inputs).
 *
 * Derived Outputs:
 *   Absolute Return %   = (Ending − Beginning) / Beginning × 100
 *   Total Profit/Loss   = Ending − Beginning                    (may be negative)
 *   Annualised Growth   = (Ending − Beginning) / Years          (avg ₹ per year)
 *   Investment Multiple = Ending / Beginning                    (e.g. 2.00×)
 *
 *   Note: "Annualised Growth" here is the arithmetic average rupee gain per
 *   year, a concrete complement to CAGR (which is the geometric annual RATE).
 *   The two are intentionally different measures.
 *
 * Edge Cases:
 *   - Zero growth (Ending = Beginning): CAGR = 0%, multiple = 1.00×.
 *   - Negative return (0 < Ending < Beginning): CAGR is negative and real,
 *     because the base Ending/Beginning is positive. e.g. 100→50 over 2y =
 *     (0.5)^(1/2) − 1 ≈ −29.29%.
 *   - Total loss (Ending = 0): (0)^(1/Years) = 0 ⇒ CAGR = −100%, multiple 0×.
 *   - INVALID: Beginning ≤ 0 (undefined base / division by zero) — rejected
 *     by validation. INVALID: Ending < 0 (a portfolio value cannot be
 *     negative; the root would be complex) — rejected by validation.
 *
 * Yearly Projection:
 *   Using the EXACT (unrounded) CAGR, the projected value after k years is
 *     value(k) = Beginning × (1 + CAGR)^k
 *   Full years 1..floor(Years) are shown; when Years is fractional a final row
 *   at exactly `Years` is appended whose projected value equals the Ending
 *   value (since Beginning × (1 + CAGR)^Years = Ending by construction), so the
 *   schedule always terminates precisely at the Ending value.
 *
 * Two-Value-Stream Pattern:
 *   The projection is computed from the exact CAGR at full IEEE 754 precision;
 *   only the display layer applies round2(). Per-row growth is a derived
 *   subtraction of already-rounded projected values, so the identity
 *     value(k−1) + growth(k) = value(k)
 *   holds exactly rather than approximately.
 *
 * Rounding Policy:
 *   Currency values and the Investment Multiple are rounded to 2 decimals.
 *   CAGR %, Absolute Return %, and per-row Growth % are rounded to 2 decimals.
 */

export interface CAGRInput {
  beginningValue: number;
  endingValue: number;
  months: number; // total period in months
}

export interface CAGRProjectionRow {
  year: number; // integer for full years, fractional for a final partial year
  projectedValue: number;
  growth: number;
  growthPct: number;
}

export interface CAGRSummary {
  cagrPct: number;
  absoluteReturnPct: number;
  totalProfitLoss: number;
  annualizedGrowth: number; // average ₹ gain per year
  investmentMultiple: number;
  years: number;
}

export interface CAGRResult {
  summary: CAGRSummary;
  projection: CAGRProjectionRow[];
}

export interface CAGRValidationErrors {
  beginning?: string;
  ending?: string;
  period?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateCAGR(input: CAGRInput): CAGRResult {
  const { beginningValue: B, endingValue: E, months } = input;
  const years = months / 12;

  // Exact CAGR (full precision) — drives the projection.
  // Math.pow(0, 1/years) = 0 ⇒ Ending = 0 gives CAGR = −1 (−100%), as intended.
  const cagr = Math.pow(E / B, 1 / years) - 1;
  const growthFactor = 1 + cagr;

  const projection: CAGRProjectionRow[] = [];
  const fullYears = Math.floor(years + 1e-9); // guard FP dust on exact boundaries
  const fraction = years - fullYears;

  let prevDisplay = round2(B);
  for (let k = 1; k <= fullYears; k++) {
    const exactValue = B * Math.pow(growthFactor, k);
    const projectedDisplay = round2(exactValue);
    projection.push({
      year: k,
      projectedValue: projectedDisplay,
      growth: projectedDisplay - prevDisplay, // derived — identity holds
      growthPct:
        prevDisplay !== 0 ? round2(((projectedDisplay - prevDisplay) / prevDisplay) * 100) : 0,
    });
    prevDisplay = projectedDisplay;
  }

  // Final fractional year — terminates exactly at the Ending value.
  if (fraction > 1e-9) {
    const projectedDisplay = round2(E);
    projection.push({
      year: round2(years),
      projectedValue: projectedDisplay,
      growth: projectedDisplay - prevDisplay,
      growthPct:
        prevDisplay !== 0 ? round2(((projectedDisplay - prevDisplay) / prevDisplay) * 100) : 0,
    });
    prevDisplay = projectedDisplay;
  }

  const totalProfitLoss = round2(E - B);
  const absoluteReturnPct = round2(((E - B) / B) * 100);
  const annualizedGrowth = round2((E - B) / years);
  const investmentMultiple = round2(E / B);

  return {
    summary: {
      cagrPct: round2(cagr * 100),
      absoluteReturnPct,
      totalProfitLoss,
      annualizedGrowth,
      investmentMultiple,
      years,
    },
    projection,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCAGRInputs(
  beginning: number,
  ending: number,
  months: number
): CAGRValidationErrors {
  const errors: CAGRValidationErrors = {};

  if (isNaN(beginning) || beginning <= 0) {
    errors.beginning = "Beginning value must be greater than ₹0";
  } else if (beginning > 1_000_000_000) {
    errors.beginning = "Beginning value cannot exceed ₹100 crore";
  }

  if (isNaN(ending) || ending < 0) {
    errors.ending = "Ending value cannot be negative";
  } else if (ending > 1_000_000_000) {
    errors.ending = "Ending value cannot exceed ₹100 crore";
  }

  if (isNaN(months) || months < 1) {
    errors.period = "Investment period must be at least 1 month";
  } else if (months > 600) {
    errors.period = "Investment period cannot exceed 600 months (50 years)";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function projectionToCSV(rows: CAGRProjectionRow[]): string {
  const header = "Year,Projected Value (₹),Growth (₹),Growth %";
  const lines = rows.map(
    (r) =>
      `${r.year},${r.projectedValue.toFixed(2)},${r.growth.toFixed(2)},${r.growthPct.toFixed(2)}`
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

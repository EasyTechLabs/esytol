/**
 * GST Calculation Engine — Accounting Policy
 *
 * Official Sources:
 *   - Central Goods and Services Tax Act, 2017 (CGST Act)
 *     Section 15: Value of taxable supply
 *   - Integrated Goods and Services Tax Act, 2017 (IGST Act)
 *     Section 5: Levy and collection (inter-state supplies)
 *   - CGST Rules, 2017
 *     Rule 35: Value of supply inclusive of integrated tax, central tax, etc.
 *       Formula: Tax amount = (Value inclusive of taxes × Rate) / (100 + Rate)
 *     Rule 46: Tax invoice — tax must be indicated separately in rupees
 *   - GST Council rate schedule (as notified by Ministry of Finance)
 *   - CBIC: https://cbic-gst.gov.in/
 *
 * Two Calculation Modes:
 *
 * 1. GST Exclusive — "Add GST" (user enters the pre-tax base price)
 *    gstAmount   = round2(baseAmount × rate / 100)
 *    totalAmount = baseAmount + gstAmount          ← derived sum, not re-rounded
 *
 * 2. GST Inclusive — "Remove GST" (user enters the total inclusive price)
 *    Source: CGST Rules 2017, Rule 35
 *    Formula: Tax = (Total × Rate) / (100 + Rate)
 *    Equivalently:
 *    baseAmount  = round2(totalAmount × 100 / (100 + rate))
 *    gstAmount   = totalAmount − baseAmount        ← derived difference, not re-rounded
 *
 * CGST / SGST (intra-state supply — Section 9 of CGST Act):
 *    CGST = round2(gstAmount / 2)
 *    SGST = gstAmount − CGST                      ← derived, so CGST + SGST = gstAmount exactly
 *    Each is levied at half the applicable GST rate.
 *
 * IGST (inter-state supply — Section 5 of IGST Act, 2017):
 *    IGST = gstAmount  (at the full composite rate)
 *
 * Rounding Policy:
 *    Display values are rounded to 2 decimal places (paise precision) as per
 *    standard GST invoice practice (Rule 46 of CGST Rules, 2017).
 *    Derived sums/differences are NOT re-rounded so that:
 *      baseAmount + gstAmount = totalAmount        (exact in IEEE 754)
 *      CGST + SGST = gstAmount                    (exact in IEEE 754)
 *
 * Standard GST Rates (GST Council, Government of India):
 *    0%  — exempted / nil-rated goods and services
 *    3%  — precious metals (gold, silver, diamond jewellery)
 *    5%  — essential commodities, transport services
 *   12%  — processed foods, computers, medicines
 *   18%  — most goods and services; electronics (standard rate)
 *   28%  — luxury goods, automobiles, tobacco, aerated beverages
 */

export const GST_RATES = [3, 5, 12, 18, 28] as const;
export type StandardGSTRate = (typeof GST_RATES)[number];
export type GSTMode = "exclusive" | "inclusive";

export interface GSTInput {
  amount: number;
  rate: number;
  mode: GSTMode;
}

export interface GSTStep {
  label: string;
  formula: string;
  result: number;
}

export interface GSTResult {
  originalAmount: number;
  gstAmount: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  effectiveRate: number;
  steps: GSTStep[];
}

export interface GSTValidationErrors {
  amount?: string;
  rate?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateGST(input: GSTInput): GSTResult {
  const { amount, rate, mode } = input;

  let originalAmount: number;
  let gstAmount: number;
  let totalAmount: number;

  if (mode === "exclusive") {
    // User provides the pre-tax base price.
    originalAmount = round2(amount);
    gstAmount = round2((originalAmount * rate) / 100);
    totalAmount = originalAmount + gstAmount; // exact sum — not re-rounded
  } else {
    // User provides the GST-inclusive total.
    // CGST Rules 2017, Rule 35: base = total × 100 / (100 + rate)
    totalAmount = round2(amount);
    originalAmount = round2((totalAmount * 100) / (100 + rate));
    gstAmount = totalAmount - originalAmount; // exact difference — not re-rounded
  }

  // Intra-state: CGST and SGST each at half the rate (Section 9, CGST Act).
  const cgst = round2(gstAmount / 2);
  const sgst = gstAmount - cgst; // exact, so cgst + sgst = gstAmount

  return {
    originalAmount,
    gstAmount,
    totalAmount,
    cgst,
    sgst,
    igst: gstAmount,
    effectiveRate: rate,
    steps: buildSteps(mode, originalAmount, gstAmount, totalAmount, rate, cgst, sgst),
  };
}

function buildSteps(
  mode: GSTMode,
  originalAmount: number,
  gstAmount: number,
  totalAmount: number,
  rate: number,
  cgst: number,
  sgst: number
): GSTStep[] {
  const halfRate = rate / 2;

  if (mode === "exclusive") {
    return [
      {
        label: "Base Amount (before GST)",
        formula: "Your input",
        result: originalAmount,
      },
      {
        label: `GST @ ${rate}%`,
        formula: `${formatINR(originalAmount)} × ${rate} ÷ 100`,
        result: gstAmount,
      },
      {
        label: "Total Amount (with GST)",
        formula: `${formatINR(originalAmount)} + ${formatINR(gstAmount)}`,
        result: totalAmount,
      },
      {
        label: `CGST @ ${halfRate}%`,
        formula: `${formatINR(gstAmount)} ÷ 2`,
        result: cgst,
      },
      {
        label: `SGST @ ${halfRate}%`,
        formula: `${formatINR(gstAmount)} − ${formatINR(cgst)}`,
        result: sgst,
      },
    ];
  } else {
    return [
      {
        label: "Amount with GST (your input)",
        formula: "Your input",
        result: totalAmount,
      },
      {
        label: "Original Amount (before GST)",
        formula: `${formatINR(totalAmount)} × 100 ÷ (100 + ${rate})`,
        result: originalAmount,
      },
      {
        label: `GST Amount @ ${rate}%`,
        formula: `${formatINR(totalAmount)} − ${formatINR(originalAmount)}`,
        result: gstAmount,
      },
      {
        label: `CGST @ ${halfRate}%`,
        formula: `${formatINR(gstAmount)} ÷ 2`,
        result: cgst,
      },
      {
        label: `SGST @ ${halfRate}%`,
        formula: `${formatINR(gstAmount)} − ${formatINR(cgst)}`,
        result: sgst,
      },
    ];
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateGSTInputs(amount: number, rate: number): GSTValidationErrors {
  const errors: GSTValidationErrors = {};

  if (!amount || amount <= 0) {
    errors.amount = "Amount must be greater than ₹0";
  } else if (amount > 1_000_000_000) {
    errors.amount = "Amount cannot exceed ₹100 crore";
  }

  if (isNaN(rate)) {
    errors.rate = "Please enter a valid GST rate";
  } else if (rate < 0) {
    errors.rate = "GST rate cannot be negative";
  } else if (rate > 100) {
    errors.rate = "GST rate cannot exceed 100%";
  }

  return errors;
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

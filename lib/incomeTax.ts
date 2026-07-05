/**
 * Income Tax Calculation Engine (India) — Accounting Policy
 *
 * Applicable rules: Financial Year 2025-26 (Assessment Year 2026-27), as per
 * the Finance Act, 2025 (Union Budget 2025).
 *
 * Official Sources:
 *   - Income Tax Department, Government of India — https://www.incometax.gov.in
 *   - Central Board of Direct Taxes (CBDT)
 *   - Finance Act, 2025 (slabs, rebate, surcharge, cess)
 *   - Ministry of Finance, Government of India
 *
 * NEW REGIME (default, Section 115BAC) — FY 2025-26 slabs:
 *   ₹0–4L: nil · 4–8L: 5% · 8–12L: 10% · 12–16L: 15% · 16–20L: 20% ·
 *   20–24L: 25% · above 24L: 30%. Standard deduction ₹75,000 (salaried).
 *   Section 87A: full rebate (up to ₹60,000) so tax is nil up to ₹12,00,000
 *   taxable income, with MARGINAL RELIEF just above ₹12,00,000.
 *   Chapter VI-A deductions (80C/80D/HRA/24b/…) do NOT apply.
 *
 * OLD REGIME — slabs (individual < 60):
 *   ₹0–2.5L: nil · 2.5–5L: 5% · 5–10L: 20% · above 10L: 30%.
 *   Standard deduction ₹50,000. Section 87A rebate (up to ₹12,500) → nil tax
 *   up to ₹5,00,000 taxable. Deductions allowed: 80C (₹1.5L), 80D (₹1L),
 *   HRA exemption, home-loan interest u/s 24(b) (₹2L, self-occupied),
 *   professional tax, and other Chapter VI-A deductions.
 *
 * SURCHARGE (on income-tax, based on total/taxable income), with marginal
 *   relief at each threshold:
 *     > ₹50L to ₹1Cr: 10% · > ₹1Cr to ₹2Cr: 15% · > ₹2Cr to ₹5Cr: 25% ·
 *     > ₹5Cr: 37% (old regime) / 25% (new regime — capped).
 *
 * HEALTH & EDUCATION CESS: 4% on (income-tax + surcharge).
 *
 * Both regimes are always computed from the same inputs so the tool can show a
 * fair Old-vs-New comparison and the tax saved.
 *
 * Rounding Policy: computations use full IEEE 754 precision; tax amounts are
 * rounded to the nearest rupee for display (per common practice), and rates to
 * two decimals.
 */

import { formatINR } from "./emi";

export { formatINR };

export type TaxRegime = "old" | "new";

export const CURRENT_FY = "2025-26";
export const CURRENT_AY = "2026-27";

interface Slab {
  upTo: number;
  rate: number;
}

const NEW_REGIME_SLABS: Slab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];

const OLD_REGIME_SLABS: Slab[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

export const STANDARD_DEDUCTION: Record<TaxRegime, number> = { old: 50000, new: 75000 };
export const DEDUCTION_CAPS = {
  section80C: 150000,
  section80D: 100000,
  homeLoanInterest: 200000,
  professionalTax: 2500,
};
const REBATE: Record<TaxRegime, { incomeLimit: number; maxRebate: number }> = {
  old: { incomeLimit: 500000, maxRebate: 12500 },
  new: { incomeLimit: 1200000, maxRebate: 60000 },
};
const CESS_RATE = 0.04;

export interface IncomeTaxInput {
  annualSalary: number;
  otherIncome: number;
  /** Chapter VI-A / exemptions — applied in the OLD regime only. */
  section80C: number;
  section80D: number;
  hraExemption: number;
  homeLoanInterest: number;
  professionalTax: number;
  otherDeductions: number;
}

export interface TaxSlabRow {
  label: string;
  rate: number; // %
  taxableInSlab: number;
  tax: number;
}

export interface RegimeResult {
  regime: TaxRegime;
  grossIncome: number;
  standardDeduction: number;
  otherDeductions: number; // total non-standard deductions applied
  totalDeductions: number;
  taxableIncome: number;
  taxBeforeRebate: number;
  rebate: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveRate: number; // % of gross income
  monthlyTax: number;
  slabs: TaxSlabRow[];
}

export interface IncomeTaxResult {
  old: RegimeResult;
  new: RegimeResult;
  recommended: TaxRegime;
  taxSaved: number; // absolute saving of the recommended regime vs the other
}

export interface IncomeTaxValidationErrors {
  salary?: string;
  otherIncome?: string;
  deductions?: string;
}

// ── Slab tax ──────────────────────────────────────────────────────────────────

function slabsFor(regime: TaxRegime): Slab[] {
  return regime === "new" ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
}

function computeSlabTax(taxable: number, slabs: Slab[]): { tax: number; rows: TaxSlabRow[] } {
  let tax = 0;
  let lower = 0;
  const rows: TaxSlabRow[] = [];
  for (const s of slabs) {
    if (taxable <= lower) break;
    const amt = Math.min(taxable, s.upTo) - lower;
    const slabTax = amt * s.rate;
    tax += slabTax;
    rows.push({
      label:
        s.upTo === Infinity ? `Above ${fmtLakh(lower)}` : `${fmtLakh(lower)} – ${fmtLakh(s.upTo)}`,
      rate: s.rate * 100,
      taxableInSlab: amt,
      tax: slabTax,
    });
    lower = s.upTo;
  }
  return { tax, rows };
}

function fmtLakh(n: number): string {
  if (n === 0) return "₹0";
  if (n % 100000 === 0) return `₹${n / 100000}L`;
  return `₹${(n / 100000).toFixed(2)}L`;
}

// Tax after Section 87A rebate (with marginal relief in the new regime).
function taxAfterRebate(
  taxable: number,
  regime: TaxRegime
): { base: number; rebate: number; net: number } {
  const { tax: base } = computeSlabTax(taxable, slabsFor(regime));
  const r = REBATE[regime];
  if (taxable <= r.incomeLimit) {
    const rebate = Math.min(base, r.maxRebate);
    return { base, rebate, net: Math.max(0, base - rebate) };
  }
  if (regime === "new") {
    // Marginal relief: tax cannot exceed the income above the rebate limit.
    const relievedNet = Math.min(base, taxable - r.incomeLimit);
    return { base, rebate: base - relievedNet, net: relievedNet };
  }
  return { base, rebate: 0, net: base };
}

// Surcharge with marginal relief. Recurses on the band threshold (terminates at
// ₹50L where the rate is 0).
function surchargeWithRelief(
  taxable: number,
  taxBeforeSurcharge: number,
  regime: TaxRegime
): number {
  const rate = surchargeRate(taxable, regime);
  if (rate === 0) return 0;

  const threshold =
    taxable <= 10000000
      ? 5000000
      : taxable <= 20000000
        ? 10000000
        : taxable <= 50000000
          ? 20000000
          : 50000000;

  let surcharge = taxBeforeSurcharge * rate;

  const taxAtThreshold = taxAfterRebate(threshold, regime).net;
  const surchargeAtThreshold = surchargeWithRelief(threshold, taxAtThreshold, regime);
  const capAtThreshold = taxAtThreshold + surchargeAtThreshold;
  const excess = taxable - threshold;

  if (taxBeforeSurcharge + surcharge > capAtThreshold + excess) {
    surcharge = capAtThreshold + excess - taxBeforeSurcharge;
  }
  return Math.max(0, surcharge);
}

function surchargeRate(taxable: number, regime: TaxRegime): number {
  if (taxable <= 5000000) return 0;
  if (taxable <= 10000000) return 0.1;
  if (taxable <= 20000000) return 0.15;
  if (taxable <= 50000000) return 0.25;
  return regime === "new" ? 0.25 : 0.37;
}

// ── Per-regime computation ──────────────────────────────────────────────────

function computeRegime(input: IncomeTaxInput, regime: TaxRegime): RegimeResult {
  const grossIncome = round0(input.annualSalary + input.otherIncome);
  const standardDeduction = grossIncome > 0 ? STANDARD_DEDUCTION[regime] : 0;

  // Non-standard deductions apply only in the OLD regime.
  let otherDeductions = 0;
  if (regime === "old") {
    otherDeductions =
      Math.min(input.section80C, DEDUCTION_CAPS.section80C) +
      Math.min(input.section80D, DEDUCTION_CAPS.section80D) +
      Math.max(0, input.hraExemption) +
      Math.min(input.homeLoanInterest, DEDUCTION_CAPS.homeLoanInterest) +
      Math.min(input.professionalTax, DEDUCTION_CAPS.professionalTax) +
      Math.max(0, input.otherDeductions);
  }

  const totalDeductions = standardDeduction + otherDeductions;
  const taxableIncome = round0(Math.max(0, grossIncome - totalDeductions));

  const { base, rebate, net } = taxAfterRebate(taxableIncome, regime);
  const surcharge = surchargeWithRelief(taxableIncome, net, regime);
  const cess = (net + surcharge) * CESS_RATE;
  const totalTax = round0(net + surcharge + cess);

  const { rows } = computeSlabTax(taxableIncome, slabsFor(regime));

  return {
    regime,
    grossIncome,
    standardDeduction,
    otherDeductions,
    totalDeductions,
    taxableIncome,
    taxBeforeRebate: round0(base),
    rebate: round0(rebate),
    taxAfterRebate: round0(net),
    surcharge: round0(surcharge),
    cess: round0(cess),
    totalTax,
    effectiveRate: grossIncome > 0 ? round2((totalTax / grossIncome) * 100) : 0,
    monthlyTax: round0(totalTax / 12),
    slabs: rows,
  };
}

export function calculateIncomeTax(input: IncomeTaxInput): IncomeTaxResult {
  const oldR = computeRegime(input, "old");
  const newR = computeRegime(input, "new");
  const recommended: TaxRegime = newR.totalTax <= oldR.totalTax ? "new" : "old";
  const taxSaved = Math.abs(round0(oldR.totalTax - newR.totalTax));
  return { old: oldR, new: newR, recommended, taxSaved };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateIncomeTaxInputs(
  salary: number,
  otherIncome: number,
  totalDeductions: number
): IncomeTaxValidationErrors {
  const errors: IncomeTaxValidationErrors = {};

  if (isNaN(salary) || salary < 0) {
    errors.salary = "Annual salary cannot be negative";
  } else if (salary > 100_000_000_000) {
    errors.salary = "Annual salary is unrealistically high";
  }

  if (isNaN(otherIncome) || otherIncome < 0) {
    errors.otherIncome = "Other income cannot be negative";
  }

  if (!isNaN(salary) && !isNaN(otherIncome) && salary + otherIncome <= 0) {
    errors.salary = "Enter your annual income to calculate tax";
  }

  if (totalDeductions < 0) {
    errors.deductions = "Deductions cannot be negative";
  }

  return errors;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function resultToCSV(result: IncomeTaxResult): string {
  const rows: (string | number)[][] = [
    ["Item", "Old Regime (₹)", "New Regime (₹)"],
    ["Gross Income", result.old.grossIncome, result.new.grossIncome],
    ["Total Deductions", result.old.totalDeductions, result.new.totalDeductions],
    ["Taxable Income", result.old.taxableIncome, result.new.taxableIncome],
    ["Tax before Rebate", result.old.taxBeforeRebate, result.new.taxBeforeRebate],
    ["Rebate (87A)", result.old.rebate, result.new.rebate],
    ["Tax after Rebate", result.old.taxAfterRebate, result.new.taxAfterRebate],
    ["Surcharge", result.old.surcharge, result.new.surcharge],
    ["Health & Education Cess", result.old.cess, result.new.cess],
    ["Total Tax", result.old.totalTax, result.new.totalTax],
    ["Effective Tax Rate (%)", result.old.effectiveRate, result.new.effectiveRate],
    ["Monthly Tax", result.old.monthlyTax, result.new.monthlyTax],
  ];
  return rows.map((r) => r.join(",")).join("\n");
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

function round0(n: number): number {
  return Math.round(n);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

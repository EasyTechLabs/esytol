/**
 * EMI Calculation Engine — Accounting Policy
 *
 * TWO parallel value streams are maintained throughout this module:
 *
 * 1. Internal / Exact values
 *    - Full IEEE 754 double precision.
 *    - Used for every arithmetic operation inside the loop.
 *    - NEVER rounded during computation.
 *    - Exposed via ExactAmortizationRow for audit / verification.
 *
 * 2. Display values
 *    - Rounded to 2 decimal places (round2) immediately before storage.
 *    - Used for UI, CSV export, and chart data.
 *    - The EMI column is derived as displayPrincipal + displayInterest, never
 *      independently rounded from exactEMI. This guarantees the per-row identity
 *        row.emi = row.principal + row.interest   (exact in IEEE 754)
 *      and therefore
 *        Σ EMI = Σ principal + Σ interest         (exact in IEEE 754)
 *
 * Final Settlement
 *    The last row's displayPrincipal is set to round2(loan − Σ prior displayPrincipal).
 *    This absorbs all accumulated display rounding so that
 *        |Σ displayPrincipal − loan| ≤ 0.005 < ₹0.01
 *    for any schedule length.
 *
 *    Combining the two facts above:
 *        Σ displayEMI   = Σ displayPrincipal  +  Σ displayInterest
 *        Σ principal    ≈ loan                              (±₹0.01)
 *    →   summary.totalPayment ≈ loan + summary.totalInterest (±₹0.02)
 *
 * Summary
 *    summary is derived entirely from displaySchedule — not from formula outputs.
 *    The schedule is the single source of truth for all UI totals.
 */

export interface EMIInput {
  principal: number;
  annualRate: number;
  months: number;
}

export interface EMIResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
}

export interface AmortizationRow {
  month: number;
  /** Derived as displayPrincipal + displayInterest — not independently rounded. */
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}

/** Full-precision row for audit and verification. No rounding applied. */
export interface ExactAmortizationRow {
  month: number;
  exactEMI: number;
  exactPrincipal: number;
  exactInterest: number;
  exactBalance: number;
}

/** Totals computed from displaySchedule. Schedule is the single source of truth. */
export interface EMISummary {
  /** round2(exactEMI) — the standard installment shown in the results card. */
  monthlyEMI: number;
  /** round2(Σ row.interest) derived from displaySchedule. */
  totalInterest: number;
  /** round2(Σ row.emi) derived from displaySchedule. */
  totalPayment: number;
}

export interface EMIScheduleResult {
  displaySchedule: AmortizationRow[];
  exactSchedule: ExactAmortizationRow[];
  summary: EMISummary;
}

export interface ValidationErrors {
  amount?: string;
  rate?: string;
  tenure?: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Returns the mathematically exact (unrounded) EMI.
 *
 * Formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 *
 * Zero-interest edge case: the formula has a 0/0 singularity when annualRate = 0.
 * The correct limit (equal principal each month) is P / n.
 *
 * Never round this value before passing it into the amortization loop.
 * Rounding causes interest > EMI at high rates, producing negative principal.
 */
export function calculateEMIExact({ principal, annualRate, months }: EMIInput): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Returns display-rounded EMI and totals.
 * These values are for UI result cards only; do not use them as inputs to
 * the amortization loop. Use generateEMISchedule() for schedule-derived totals.
 */
export function calculateEMI(input: EMIInput): EMIResult {
  const { principal, annualRate, months } = input;
  if (principal <= 0 || months <= 0) {
    return { emi: 0, totalInterest: 0, totalPayment: 0 };
  }
  if (annualRate === 0) {
    const emi = round2(principal / months);
    return { emi, totalInterest: 0, totalPayment: round2(principal) };
  }
  const exactEMI = calculateEMIExact(input);
  const totalPayment = exactEMI * months;
  return {
    emi: round2(exactEMI),
    totalInterest: round2(totalPayment - principal),
    totalPayment: round2(totalPayment),
  };
}

// ── Primary schedule engine ───────────────────────────────────────────────────

/**
 * Generates both the display schedule and the exact schedule in a single pass.
 *
 * Accounting guarantees (see module header for proofs):
 *   row.emi = row.principal + row.interest          (exact, every row)
 *   |Σ displayPrincipal − loan|  ≤ ₹0.01           (final-row correction)
 *   |summary.totalPayment − loan − summary.totalInterest| ≤ ₹0.02
 *   last row balance = 0
 *   balance is non-increasing
 *   principal ≥ 0, interest ≥ 0 in every row
 *
 * summary is derived entirely from displaySchedule — not from formula outputs.
 */
export function generateEMISchedule(input: EMIInput): EMIScheduleResult {
  const { principal, annualRate, months } = input;

  if (principal <= 0 || months <= 0) {
    return {
      displaySchedule: [],
      exactSchedule: [],
      summary: { monthlyEMI: 0, totalInterest: 0, totalPayment: 0 },
    };
  }

  const r = annualRate / 12 / 100;
  // exactEMI is the single authoritative value for all per-row calculations.
  // It is never rounded during the loop.
  const exactEMI = calculateEMIExact(input);

  const displaySchedule: AmortizationRow[] = [];
  const exactSchedule: ExactAmortizationRow[] = [];

  let exactBalance = principal; // full-precision running balance; rounded only for display
  let sumDisplayPrincipal = 0; // accumulated display principal; used for final correction

  for (let month = 1; month <= months; month++) {
    const isLast = month === months;

    // ── Internal (exact) values ──────────────────────────────────────────────
    // exactInterest: interest on the current exact outstanding balance.
    // exactPrincipal: for regular rows = exactEMI − exactInterest (positive because
    //   exactEMI > exactBalance × r always); for the last row = exact remaining balance.
    const exactInterest = annualRate === 0 ? 0 : exactBalance * r;
    const exactPrincipal = isLast ? exactBalance : exactEMI - exactInterest;
    const nextExactBalance = isLast ? 0 : exactBalance - exactPrincipal;

    exactSchedule.push({
      month,
      exactEMI: isLast ? exactPrincipal + exactInterest : exactEMI,
      exactPrincipal,
      exactInterest,
      exactBalance: nextExactBalance,
    });

    // ── Display (rounded) values ─────────────────────────────────────────────
    if (isLast) {
      // Final settlement: correct displayPrincipal so that
      //   Σ displayPrincipal = loan ± ₹0.01
      // The last interest is the actual interest on the remaining exact balance.
      // EMI is derived (not independently rounded) so that
      //   row.emi = row.principal + row.interest exactly in IEEE 754.
      const displayPrincipal = round2(principal - sumDisplayPrincipal);
      const displayInterest = round2(exactInterest);
      displaySchedule.push({
        month,
        emi: displayPrincipal + displayInterest,
        principal: displayPrincipal,
        interest: displayInterest,
        balance: 0,
      });
    } else {
      // Regular row: round principal and interest independently; derive EMI.
      // Do NOT apply round2 to exactEMI — that would break the row identity.
      const displayPrincipal = round2(exactPrincipal);
      const displayInterest = round2(exactInterest);
      sumDisplayPrincipal += displayPrincipal;

      displaySchedule.push({
        month,
        emi: displayPrincipal + displayInterest,
        principal: displayPrincipal,
        interest: displayInterest,
        balance: round2(nextExactBalance),
      });
    }

    exactBalance = nextExactBalance;
  }

  // Summary derived entirely from displaySchedule.
  // round2 cleans up floating-point epsilon that accumulates during summation.
  const rawTotalInterest = displaySchedule.reduce((s, row) => s + row.interest, 0);
  const rawTotalPayment = displaySchedule.reduce((s, row) => s + row.emi, 0);

  return {
    displaySchedule,
    exactSchedule,
    summary: {
      monthlyEMI: round2(exactEMI),
      totalInterest: round2(rawTotalInterest),
      totalPayment: round2(rawTotalPayment),
    },
  };
}

/**
 * Backward-compatible wrapper.
 * Returns displaySchedule from generateEMISchedule.
 */
export function generateAmortizationSchedule(input: EMIInput): AmortizationRow[] {
  return generateEMISchedule(input).displaySchedule;
}

// ── CSV / download ────────────────────────────────────────────────────────────

export function scheduleToCSV(rows: AmortizationRow[]): string {
  const header = "Month,EMI,Principal,Interest,Balance";
  const body = rows
    .map(
      (r) =>
        `${r.month},${r.emi.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`
    )
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

// ── Validation ────────────────────────────────────────────────────────────────

export function validateEMIInputs(
  amount: number,
  rate: number,
  tenure: number,
  tenureUnit: "months" | "years"
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!amount || amount <= 0) {
    errors.amount = "Loan amount must be greater than 0";
  } else if (amount > 1_000_000_000) {
    errors.amount = "Loan amount cannot exceed ₹100 crore";
  }

  if (rate < 0) {
    errors.rate = "Interest rate cannot be negative";
  } else if (rate > 100) {
    errors.rate = "Interest rate cannot exceed 100%";
  }

  const maxTenure = tenureUnit === "years" ? 30 : 360;
  if (!tenure || tenure < 1) {
    errors.tenure = `Minimum tenure is 1 ${tenureUnit === "years" ? "year" : "month"}`;
  } else if (tenure > maxTenure) {
    errors.tenure = `Maximum tenure is ${maxTenure} ${tenureUnit === "years" ? "years" : "months"}`;
  }

  return errors;
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

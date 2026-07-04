export interface EMIInput {
  principal: number;
  annualRate: number;
  months: number;
}

export interface EMIResult {
  emi: number; // rounded for display; do not use for schedule computation
  totalInterest: number;
  totalPayment: number;
}

export interface AmortizationRow {
  month: number;
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface ValidationErrors {
  amount?: string;
  rate?: string;
  tenure?: string;
}

/**
 * Returns the mathematically exact (unrounded) EMI.
 *
 * Formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = annualRate / 12 / 100, n = months.
 *
 * Zero-interest edge case: the standard formula has a 0/0 singularity
 * when annualRate = 0. The correct limit is P / n (equal principal each month).
 *
 * This value must be used as-is for amortization schedule computation.
 * Rounding it before the loop causes interest to exceed EMI at high rates,
 * producing negative principal and an increasing balance.
 */
export function calculateEMIExact({ principal, annualRate, months }: EMIInput): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Returns display-rounded EMI and totals for UI presentation.
 * Internally calls calculateEMIExact and rounds only for display.
 * Do not pass EMIResult.emi into generateAmortizationSchedule.
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

/**
 * Generates a full amortization schedule with correct financial invariants
 * for any valid input, including high-interest / long-tenure combinations.
 *
 * Exact math:
 *   At each step: interest = balance × r (exact)
 *                 principal = exactEMI − interest (exact)
 *                 balance  -= principal (exact; never rounded during the loop)
 *
 * Display rounding:
 *   Each row stores round2() values for presentation. The running balance
 *   variable is kept at full IEEE 754 precision so rounding errors do not
 *   compound across hundreds of months.
 *
 * Final payment adjustment:
 *   The last row's principal is computed as (loanAmount − sumDisplayedPrincipal)
 *   rather than round2(exactPrincipalPaid). This absorbs all accumulated
 *   display rounding so that Sum(principal) = loanAmount ± ₹0.01 regardless
 *   of schedule length. The math proof:
 *     sum = sumDisplayedPrincipal + round2(loanAmount − sumDisplayedPrincipal)
 *         = loanAmount ± 0.005   (only the final round2 introduces error)
 *   The last EMI is adjusted accordingly and will differ slightly from the
 *   regular monthly EMI; this is standard practice in Indian banking.
 */
export function generateAmortizationSchedule(input: EMIInput): AmortizationRow[] {
  const { principal, annualRate, months } = input;
  if (principal <= 0 || months <= 0) return [];

  const r = annualRate / 12 / 100;
  // exactEMI is never rounded. Using round2(EMI) in the loop would make
  // interest > EMI at high rates (e.g. 100 % p.a.), producing negative principal.
  const exactEMI = calculateEMIExact(input);
  const rows: AmortizationRow[] = [];

  let exactBalance = principal; // full-precision; rounded only for display
  let sumDisplayPrincipal = 0; // tracks sum of rounded principals for final correction

  for (let month = 1; month <= months; month++) {
    const isLast = month === months;
    // Exact interest on the current outstanding balance
    const exactInterest = annualRate === 0 ? 0 : exactBalance * r;

    if (isLast) {
      // Final payment adjustment.
      // principal − sumDisplayPrincipal is the accumulated display rounding error
      // absorbed here, guaranteeing Sum(displayed principal) = loan ± ₹0.01.
      const displayPrincipal = round2(principal - sumDisplayPrincipal);
      const displayInterest = round2(exactInterest);
      rows.push({
        month,
        emi: round2(displayPrincipal + displayInterest),
        principal: displayPrincipal,
        interest: displayInterest,
        balance: 0,
      });
    } else {
      // Subtract exact value from balance — do NOT round here.
      // Rounding the running balance compounds errors over hundreds of months.
      const exactPrincipalPaid = exactEMI - exactInterest;
      exactBalance -= exactPrincipalPaid;

      const displayPrincipal = round2(exactPrincipalPaid);
      const displayInterest = round2(exactInterest);
      sumDisplayPrincipal += displayPrincipal;

      rows.push({
        month,
        emi: round2(exactEMI),
        principal: displayPrincipal,
        interest: displayInterest,
        balance: round2(exactBalance),
      });
    }
  }

  return rows;
}

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

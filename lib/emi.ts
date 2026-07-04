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

export function calculateEMI({ principal, annualRate, months }: EMIInput): EMIResult {
  if (principal <= 0 || months <= 0) {
    return { emi: 0, totalInterest: 0, totalPayment: 0 };
  }

  if (annualRate === 0) {
    const emi = round2(principal / months);
    return { emi, totalInterest: 0, totalPayment: round2(principal) };
  }

  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, months);
  const emi = (principal * r * factor) / (factor - 1);
  const totalPayment = emi * months;

  return {
    emi: round2(emi),
    totalInterest: round2(totalPayment - principal),
    totalPayment: round2(totalPayment),
  };
}

export function generateAmortizationSchedule(
  { principal, annualRate, months }: EMIInput,
  emi: number
): AmortizationRow[] {
  const r = annualRate / 12 / 100;
  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    const principalPaid = emi - interest;
    balance = balance - principalPaid;

    rows.push({
      month,
      emi: round2(emi),
      principal: round2(principalPaid),
      interest: round2(interest),
      balance: month === months ? 0 : round2(balance),
    });
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

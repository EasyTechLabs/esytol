/**
 * EPF (Employees' Provident Fund) Projection Engine — India
 *
 * Projects the EPF corpus at retirement from monthly Basic + DA wages, applying
 * the statutory contribution split and EPFO's annual interest crediting.
 *
 * Official Sources:
 *   - Employees' Provident Fund Organisation (EPFO) — https://www.epfindia.gov.in
 *   - Employees' Provident Funds & Miscellaneous Provisions Act, 1952
 *   - Ministry of Labour & Employment, Government of India
 *   - Income Tax Department (for the taxability of EPF, where applicable)
 *
 * CONTRIBUTION RULES (on monthly wages = Basic + DA):
 *   - Employee: 12% of wages → entirely to the EPF account.
 *   - Employer: 12% of wages, split into:
 *       • EPS (Employees' Pension Scheme): 8.33% of wages, capped at the
 *         ₹15,000 wage ceiling (so a maximum of ~₹1,250/month). EPS is a
 *         pension pool and does NOT earn EPF interest or form the EPF corpus.
 *       • EPF (employer share): the remainder = 12% of wages − EPS.
 *   The EPF corpus that earns interest = employee 12% + employer EPF share.
 *
 * INTEREST (EPFO method):
 *   Interest is calculated on the monthly running balance at rate ÷ 12 and
 *   credited once at the end of each financial year (no intra-year compounding).
 *   The rate is notified annually by EPFO/Government (8.25% for FY 2024-25).
 *
 * SALARY GROWTH: wages grow by an assumed annual increment each year.
 *
 * Rounding Policy: computations use full IEEE 754 precision; rupee amounts are
 * rounded to the nearest rupee for display and rates to two decimals.
 */

import { formatINR } from "./emi";

export { formatINR };

export const EPF_EMPLOYEE_RATE = 0.12;
export const EPF_EMPLOYER_RATE = 0.12;
export const EPS_RATE = 0.0833;
export const EPS_WAGE_CEILING = 15000;
export const DEFAULT_EPF_RATE = 8.25; // % — FY 2024-25 notified rate
export const DEFAULT_RETIREMENT_AGE = 58;

export interface EPFInput {
  /** Monthly wages for PF = Basic Salary + Dearness Allowance. */
  monthlyWages: number;
  currentAge: number;
  retirementAge: number;
  /** Existing EPF balance already accumulated. */
  currentBalance: number;
  /** Expected annual salary increment (%). */
  annualIncrement: number;
  /** EPF interest rate (%). */
  interestRate: number;
}

export interface EPFYearRow {
  year: number;
  age: number;
  openingBalance: number;
  employeeContribution: number;
  employerContribution: number;
  interest: number;
  closingBalance: number;
}

export interface EPFResult {
  // Monthly figures (based on the first-year wages)
  monthlyEmployee: number;
  monthlyEmployerEPF: number;
  monthlyEPS: number;
  monthlyTotalToEPF: number;
  // Totals over the projection
  totalEmployeeContribution: number;
  totalEmployerContribution: number;
  totalContribution: number;
  totalInterest: number;
  totalEPS: number;
  maturityBalance: number;
  years: number;
  yearWise: EPFYearRow[];
}

export interface EPFValidationErrors {
  monthlyWages?: string;
  currentAge?: string;
  retirementAge?: string;
  currentBalance?: string;
  annualIncrement?: string;
  interestRate?: string;
}

// ── Core computation ────────────────────────────────────────────────────────

export function calculateEPF(input: EPFInput): EPFResult {
  const years = Math.max(0, Math.floor(input.retirementAge - input.currentAge));
  const rate = Math.max(0, input.interestRate) / 100;
  const inc = Math.max(0, input.annualIncrement) / 100;
  const initialBalance = Math.max(0, input.currentBalance);

  let wages = Math.max(0, input.monthlyWages);
  let balance = initialBalance;

  // First-year monthly figures (for the headline "monthly contribution").
  const monthlyEmployee = EPF_EMPLOYEE_RATE * wages;
  const firstEps = EPS_RATE * Math.min(wages, EPS_WAGE_CEILING);
  const monthlyEmployerEPF = EPF_EMPLOYER_RATE * wages - firstEps;

  let totalEmployee = 0;
  let totalEmployerEPF = 0;
  let totalEPS = 0;
  let totalInterest = 0;
  const yearWise: EPFYearRow[] = [];

  for (let y = 0; y < years; y++) {
    const opening = balance;

    const employeeMo = EPF_EMPLOYEE_RATE * wages;
    const epsMo = EPS_RATE * Math.min(wages, EPS_WAGE_CEILING);
    const employerEpfMo = EPF_EMPLOYER_RATE * wages - epsMo;
    const monthlyEpf = employeeMo + employerEpfMo;

    // EPFO method: interest on the monthly running balance, credited at year end.
    let running = opening;
    let yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      running += monthlyEpf;
      yearInterest += running * (rate / 12);
    }

    const yearEmployee = employeeMo * 12;
    const yearEmployerEpf = employerEpfMo * 12;
    const yearEps = epsMo * 12;

    balance = opening + yearEmployee + yearEmployerEpf + yearInterest;

    totalEmployee += yearEmployee;
    totalEmployerEPF += yearEmployerEpf;
    totalEPS += yearEps;
    totalInterest += yearInterest;

    yearWise.push({
      year: y + 1,
      age: input.currentAge + y + 1,
      openingBalance: round0(opening),
      employeeContribution: round0(yearEmployee),
      employerContribution: round0(yearEmployerEpf),
      interest: round0(yearInterest),
      closingBalance: round0(balance),
    });

    // Grow wages for the next year.
    wages = wages * (1 + inc);
  }

  const totalContribution = totalEmployee + totalEmployerEPF;

  return {
    monthlyEmployee: round0(monthlyEmployee),
    monthlyEmployerEPF: round0(monthlyEmployerEPF),
    monthlyEPS: round0(firstEps),
    monthlyTotalToEPF: round0(monthlyEmployee + monthlyEmployerEPF),
    totalEmployeeContribution: round0(totalEmployee),
    totalEmployerContribution: round0(totalEmployerEPF),
    totalContribution: round0(totalContribution),
    totalInterest: round0(totalInterest),
    totalEPS: round0(totalEPS),
    maturityBalance: round0(balance),
    years,
    yearWise,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateEPFInputs(input: EPFInput): EPFValidationErrors {
  const errors: EPFValidationErrors = {};
  const { monthlyWages, currentAge, retirementAge, currentBalance, annualIncrement, interestRate } =
    input;

  if (isNaN(monthlyWages) || monthlyWages < 0) {
    errors.monthlyWages = "Monthly Basic + DA cannot be negative";
  } else if (monthlyWages === 0) {
    errors.monthlyWages = "Enter your monthly Basic + DA to project your EPF";
  } else if (monthlyWages > 100_000_000) {
    errors.monthlyWages = "Monthly wages are unrealistically high";
  }

  if (isNaN(currentAge) || currentAge < 15) {
    errors.currentAge = "Current age must be at least 15";
  } else if (currentAge > 75) {
    errors.currentAge = "Current age is unrealistically high";
  }

  if (isNaN(retirementAge) || retirementAge <= currentAge) {
    errors.retirementAge = "Retirement age must be greater than current age";
  } else if (retirementAge > 75) {
    errors.retirementAge = "Retirement age is unrealistically high";
  }

  if (isNaN(currentBalance) || currentBalance < 0) {
    errors.currentBalance = "Current EPF balance cannot be negative";
  }

  if (isNaN(annualIncrement) || annualIncrement < 0) {
    errors.annualIncrement = "Annual increment cannot be negative";
  } else if (annualIncrement > 50) {
    errors.annualIncrement = "Annual increment is unrealistically high";
  }

  if (isNaN(interestRate) || interestRate < 0) {
    errors.interestRate = "Interest rate cannot be negative";
  } else if (interestRate > 20) {
    errors.interestRate = "Interest rate is unrealistically high";
  }

  return errors;
}

// ── CSV export ──────────────────────────────────────────────────────────────

export function resultToCSV(result: EPFResult): string {
  const header = [
    "Year",
    "Age",
    "Opening Balance (₹)",
    "Employee Contribution (₹)",
    "Employer EPF Contribution (₹)",
    "Interest (₹)",
    "Closing Balance (₹)",
  ];
  const rows = result.yearWise.map((r) => [
    r.year,
    r.age,
    r.openingBalance,
    r.employeeContribution,
    r.employerContribution,
    r.interest,
    r.closingBalance,
  ]);
  const summary = [
    [],
    ["Maturity Balance", result.maturityBalance],
    ["Total Employee Contribution", result.totalEmployeeContribution],
    ["Total Employer EPF Contribution", result.totalEmployerContribution],
    ["Total Interest Earned", result.totalInterest],
    ["Total EPS (pension) Contribution", result.totalEPS],
  ];
  return [header, ...rows, ...summary].map((r) => r.join(",")).join("\n");
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

// ── Internal ────────────────────────────────────────────────────────────────

function round0(n: number): number {
  return Math.round(n);
}

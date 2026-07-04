import { describe, it, expect } from "vitest";
import {
  calculatePersonalLoan,
  validatePersonalLoanInputs,
  scheduleToCSV,
} from "@/lib/personalLoan";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

// Independent amortization implementation — a separate code path from the
// engine (which reuses lib/emi.ts). Used to cross-check EMI, total interest,
// principal repayment, and final-balance settlement.
function independentAmortize(P: number, ratePct: number, n: number) {
  const r = ratePct / 12 / 100;
  const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let bal = P;
  let totalInterest = 0;
  let totalPrincipal = 0;
  for (let m = 1; m <= n; m++) {
    const interest = r === 0 ? 0 : bal * r;
    const principal = m === n ? bal : emi - interest;
    bal -= principal;
    totalInterest += interest;
    totalPrincipal += principal;
  }
  return { emi, totalInterest, totalPrincipal, finalBalance: bal };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Deterministic financial validation ────────────────────────────────────────

describe("calculatePersonalLoan — known scenarios", () => {
  it("₹5,00,000 @ 11% for 5 years → EMI ≈ ₹10,871", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(r.summary.monthlyEMI).toBeGreaterThan(10800);
    expect(r.summary.monthlyEMI).toBeLessThan(10950);
  });

  it("EMI matches the independent implementation", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    const ref = independentAmortize(500000, 11, 60);
    expect(r.summary.monthlyEMI).toBe(round2(ref.emi));
  });

  it("schedule length equals tenure months", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(r.schedule.length).toBe(60);
  });

  it("last row balance is exactly 0", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(r.schedule[r.schedule.length - 1].balance).toBe(0);
  });

  it("total payment = principal + total interest (± ₹0.02)", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(Math.abs(r.summary.totalPayment - (500000 + r.summary.totalInterest))).toBeLessThan(
      0.02
    );
  });

  it("zero rate: EMI = P / n, no interest", () => {
    const r = calculatePersonalLoan({ loanAmount: 600000, annualRate: 0, months: 60 });
    expect(r.summary.monthlyEMI).toBe(10000); // 600000 / 60
    expect(r.summary.totalInterest).toBe(0);
    expect(r.summary.totalBorrowingCost).toBe(0);
  });

  it("processing fee = loan × feePct / 100", () => {
    const r = calculatePersonalLoan({
      loanAmount: 500000,
      annualRate: 11,
      months: 60,
      processingFeePct: 1,
    });
    expect(r.summary.processingFee).toBe(5000); // 1% of 5L
  });

  it("processing fee defaults to 0 when omitted", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(r.summary.processingFee).toBe(0);
    expect(r.summary.totalBorrowingCost).toBe(r.summary.totalInterest);
  });

  it("total borrowing cost = total interest + processing fee", () => {
    const r = calculatePersonalLoan({
      loanAmount: 500000,
      annualRate: 11,
      months: 60,
      processingFeePct: 2,
    });
    expect(r.summary.totalBorrowingCost).toBe(round2(r.summary.totalInterest + 10000));
  });

  it("effective cost % = (interest + fee) / principal × 100", () => {
    const r = calculatePersonalLoan({
      loanAmount: 500000,
      annualRate: 11,
      months: 60,
      processingFeePct: 2,
    });
    const expected = round2(((r.summary.totalInterest + 10000) / 500000) * 100);
    expect(r.summary.effectiveCostPct).toBe(expected);
  });

  it("interest as % of principal = totalInterest / loan × 100", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(r.summary.interestToPrincipalPct).toBe(round2((r.summary.totalInterest / 500000) * 100));
  });

  it("total years = months / 12", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    expect(r.summary.totalYears).toBe(5);
  });

  it("longer tenure lowers EMI but raises total interest", () => {
    const short = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 24 });
    const long = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 72 });
    expect(long.summary.monthlyEMI).toBeLessThan(short.summary.monthlyEMI);
    expect(long.summary.totalInterest).toBeGreaterThan(short.summary.totalInterest);
  });
});

// ── Schedule integrity ────────────────────────────────────────────────────────

describe("calculatePersonalLoan — schedule integrity", () => {
  it("every row: emi = principal + interest (exact)", () => {
    const r = calculatePersonalLoan({ loanAmount: 750000, annualRate: 14.5, months: 48 });
    r.schedule.forEach((row) => {
      expect(row.emi).toBe(row.principal + row.interest);
    });
  });

  it("balance is non-increasing and principal/interest are non-negative", () => {
    const r = calculatePersonalLoan({ loanAmount: 750000, annualRate: 14.5, months: 48 });
    let prev = Infinity;
    r.schedule.forEach((row) => {
      expect(row.balance).toBeLessThanOrEqual(prev + 1e-9);
      expect(row.principal).toBeGreaterThanOrEqual(0);
      expect(row.interest).toBeGreaterThanOrEqual(0);
      prev = row.balance;
    });
  });

  it("sum of principal repayments ≈ loan amount (± ₹0.01)", () => {
    const r = calculatePersonalLoan({ loanAmount: 750000, annualRate: 14.5, months: 48 });
    const sumPrincipal = r.schedule.reduce((s, row) => s + row.principal, 0);
    expect(Math.abs(sumPrincipal - 750000)).toBeLessThanOrEqual(0.01);
  });
});

// ── Randomized cross-check — 1500+ scenarios ──────────────────────────────────

describe("calculatePersonalLoan — 1500 randomized scenarios cross-checked (seed 0x9e2c)", () => {
  it("EMI, principal repayment, and settlement match an independent implementation", () => {
    const rng = lcg(0x9e2c11);
    let failCount = 0;

    for (let s = 0; s < 1500; s++) {
      const loan = Math.round(rng(5_000_000, 10000) * 100) / 100;
      const rate = rng(30, 0); // 0–30% personal-loan band
      const months = Math.ceil(rng(84, 1)); // 1 month – 7 years
      const feePct = rng(5, 0);

      const r = calculatePersonalLoan({
        loanAmount: loan,
        annualRate: rate,
        months,
        processingFeePct: feePct,
      });
      const ref = independentAmortize(loan, rate, months);
      const { summary, schedule } = r;

      if (schedule.length !== months) failCount++;

      // EMI matches independent (both round2 of the same formula)
      if (summary.monthlyEMI !== round2(ref.emi)) failCount++;

      // per-row identity
      for (const row of schedule) {
        if (row.emi !== row.principal + row.interest) failCount++;
        if (row.principal < -1e-9 || row.interest < -1e-9) failCount++;
      }

      // final settlement
      if (schedule[schedule.length - 1].balance !== 0) failCount++;

      // sum of principal ≈ loan
      const sumPrincipal = schedule.reduce((acc, row) => acc + row.principal, 0);
      if (Math.abs(sumPrincipal - round2(loan)) > 0.02) failCount++;

      // totalPayment = loan + totalInterest
      if (Math.abs(summary.totalPayment - (round2(loan) + summary.totalInterest)) > 0.02) {
        failCount++;
      }

      // engine total interest agrees with independent exact interest within drift
      if (Math.abs(summary.totalInterest - ref.totalInterest) > Math.max(0.5, months * 0.02)) {
        failCount++;
      }

      // personal-loan quantities
      const fee = round2((loan * feePct) / 100);
      if (summary.processingFee !== fee) failCount++;
      if (summary.totalBorrowingCost !== round2(summary.totalInterest + fee)) failCount++;
      if (summary.effectiveCostPct !== round2((summary.totalBorrowingCost / round2(loan)) * 100)) {
        failCount++;
      }
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validatePersonalLoanInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validatePersonalLoanInputs(500000, 11, 5, "years", 1)).toEqual({});
  });

  it("errors on zero loan amount", () => {
    expect(validatePersonalLoanInputs(0, 11, 5, "years", 0).amount).toBeDefined();
  });

  it("errors on loan above ₹100 crore", () => {
    expect(validatePersonalLoanInputs(1_000_000_001, 11, 5, "years", 0).amount).toBeDefined();
  });

  it("errors on negative rate", () => {
    expect(validatePersonalLoanInputs(500000, -1, 5, "years", 0).rate).toBeDefined();
  });

  it("errors on rate above 100%", () => {
    expect(validatePersonalLoanInputs(500000, 101, 5, "years", 0).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validatePersonalLoanInputs(500000, 0, 5, "years", 0).rate).toBeUndefined();
  });

  it("errors on tenure below 1", () => {
    expect(validatePersonalLoanInputs(500000, 11, 0, "years", 0).tenure).toBeDefined();
  });

  it("errors on tenure above 7 years", () => {
    expect(validatePersonalLoanInputs(500000, 11, 8, "years", 0).tenure).toBeDefined();
  });

  it("allows exactly 7 years", () => {
    expect(validatePersonalLoanInputs(500000, 11, 7, "years", 0).tenure).toBeUndefined();
  });

  it("errors on tenure above 84 months", () => {
    expect(validatePersonalLoanInputs(500000, 11, 85, "months", 0).tenure).toBeDefined();
  });

  it("allows exactly 84 months", () => {
    expect(validatePersonalLoanInputs(500000, 11, 84, "months", 0).tenure).toBeUndefined();
  });

  it("errors on negative processing fee", () => {
    expect(validatePersonalLoanInputs(500000, 11, 5, "years", -1).fee).toBeDefined();
  });

  it("errors on processing fee above 5%", () => {
    expect(validatePersonalLoanInputs(500000, 11, 5, "years", 6).fee).toBeDefined();
  });

  it("allows processing fee of 0", () => {
    expect(validatePersonalLoanInputs(500000, 11, 5, "years", 0).fee).toBeUndefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validatePersonalLoanInputs(0, -1, 0, "years", -1);
    expect(errs.amount).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.tenure).toBeDefined();
    expect(errs.fee).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("scheduleToCSV", () => {
  it("header includes Opening Balance and Closing Balance", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    expect(csv).toContain("Month,Opening Balance,EMI,Principal,Interest,Closing Balance");
  });

  it("row count equals months + 1 (header)", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(61);
  });

  it("first data row opening balance equals the loan amount", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    const firstRow = csv.split("\n")[1];
    expect(firstRow.startsWith("1,500000.00,")).toBe(true);
  });

  it("second row opening balance equals first row closing balance", () => {
    const r = calculatePersonalLoan({ loanAmount: 500000, annualRate: 11, months: 60 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    const rows = csv.split("\n");
    const firstClosing = rows[1].split(",")[5];
    const secondOpening = rows[2].split(",")[1];
    expect(secondOpening).toBe(firstClosing);
  });
});

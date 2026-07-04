import { describe, it, expect } from "vitest";
import { calculateHomeLoan, validateHomeLoanInputs, scheduleToCSV } from "@/lib/homeLoan";

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

describe("calculateHomeLoan — known scenarios", () => {
  it("₹50,00,000 @ 8.5% for 20 years → EMI ≈ ₹43,391", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.summary.monthlyEMI).toBeGreaterThan(43000);
    expect(r.summary.monthlyEMI).toBeLessThan(43800);
  });

  it("EMI matches the independent implementation", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    const ref = independentAmortize(5000000, 8.5, 240);
    expect(r.summary.monthlyEMI).toBe(round2(ref.emi));
  });

  it("schedule length equals tenure months", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.schedule.length).toBe(240);
  });

  it("last row balance is exactly 0", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.schedule[r.schedule.length - 1].balance).toBe(0);
  });

  it("total payment = principal + total interest (± ₹0.02)", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(Math.abs(r.summary.totalPayment - (5000000 + r.summary.totalInterest))).toBeLessThan(
      0.02
    );
  });

  it("zero rate: EMI = P / n, no interest", () => {
    const r = calculateHomeLoan({ loanAmount: 1200000, annualRate: 0, months: 240 });
    expect(r.summary.monthlyEMI).toBe(5000); // 1200000 / 240
    expect(r.summary.totalInterest).toBe(0);
    expect(r.summary.totalPayment).toBeCloseTo(1200000, 2);
  });

  it("processing fee = loan × feePct / 100", () => {
    const r = calculateHomeLoan({
      loanAmount: 5000000,
      annualRate: 8.5,
      months: 240,
      processingFeePct: 0.5,
    });
    expect(r.summary.processingFee).toBe(25000); // 0.5% of 50L
  });

  it("processing fee defaults to 0 when omitted", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.summary.processingFee).toBe(0);
  });

  it("total initial cost = down payment + processing fee", () => {
    const r = calculateHomeLoan({
      loanAmount: 5000000,
      annualRate: 8.5,
      months: 240,
      processingFeePct: 0.5,
      downPayment: 1000000,
    });
    expect(r.summary.totalInitialCost).toBe(1025000); // 10L + 25k
  });

  it("LTV = loan / (loan + down payment) × 100", () => {
    const r = calculateHomeLoan({
      loanAmount: 4000000,
      annualRate: 8.5,
      months: 240,
      downPayment: 1000000,
    });
    // 40L / 50L = 80%
    expect(r.summary.ltv).toBe(80);
    expect(r.summary.propertyValue).toBe(5000000);
  });

  it("LTV is 100% when there is no down payment", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.summary.ltv).toBe(100);
  });

  it("interest as % of principal = totalInterest / loan × 100", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.summary.interestToPrincipalPct).toBe(
      round2((r.summary.totalInterest / 5000000) * 100)
    );
  });

  it("effective cost of borrowing includes the processing fee", () => {
    const r = calculateHomeLoan({
      loanAmount: 5000000,
      annualRate: 8.5,
      months: 240,
      processingFeePct: 0.5,
    });
    const expected = round2(((r.summary.totalInterest + 25000) / 5000000) * 100);
    expect(r.summary.effectiveCostPct).toBe(expected);
  });

  it("total years = months / 12", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    expect(r.summary.totalYears).toBe(20);
  });

  it("longer tenure lowers EMI but raises total interest", () => {
    const short = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 120 });
    const long = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 300 });
    expect(long.summary.monthlyEMI).toBeLessThan(short.summary.monthlyEMI);
    expect(long.summary.totalInterest).toBeGreaterThan(short.summary.totalInterest);
  });
});

// ── Schedule integrity ────────────────────────────────────────────────────────

describe("calculateHomeLoan — schedule integrity", () => {
  it("every row: emi = principal + interest (exact)", () => {
    const r = calculateHomeLoan({ loanAmount: 3500000, annualRate: 9.25, months: 180 });
    r.schedule.forEach((row) => {
      expect(row.emi).toBe(row.principal + row.interest);
    });
  });

  it("balance is non-increasing and principal/interest are non-negative", () => {
    const r = calculateHomeLoan({ loanAmount: 3500000, annualRate: 9.25, months: 180 });
    let prev = Infinity;
    r.schedule.forEach((row) => {
      expect(row.balance).toBeLessThanOrEqual(prev + 1e-9);
      expect(row.principal).toBeGreaterThanOrEqual(0);
      expect(row.interest).toBeGreaterThanOrEqual(0);
      prev = row.balance;
    });
  });

  it("sum of principal repayments ≈ loan amount (± ₹0.01)", () => {
    const r = calculateHomeLoan({ loanAmount: 3500000, annualRate: 9.25, months: 180 });
    const sumPrincipal = r.schedule.reduce((s, row) => s + row.principal, 0);
    expect(Math.abs(sumPrincipal - 3500000)).toBeLessThanOrEqual(0.01);
  });
});

// ── Randomized cross-check — 1500+ scenarios ──────────────────────────────────

describe("calculateHomeLoan — 1500 randomized scenarios cross-checked (seed 0xh0m3)", () => {
  it("EMI, principal repayment, and settlement match an independent implementation", () => {
    const rng = lcg(0x102344);
    let failCount = 0;

    for (let s = 0; s < 1500; s++) {
      const loan = Math.round(rng(50_000_000, 100000) * 100) / 100;
      const rate = rng(20, 0); // 0–20% home-loan band
      const months = Math.ceil(rng(360, 12)); // 1–30 years
      const feePct = rng(3, 0);
      const down = Math.round(rng(20_000_000, 0));

      const r = calculateHomeLoan({
        loanAmount: loan,
        annualRate: rate,
        months,
        processingFeePct: feePct,
        downPayment: down,
      });
      const ref = independentAmortize(loan, rate, months);
      const { summary, schedule } = r;

      // schedule length
      if (schedule.length !== months) failCount++;

      // EMI matches independent (both round2 of the same formula)
      if (summary.monthlyEMI !== round2(ref.emi)) failCount++;

      // per-row identity: emi = principal + interest
      for (const row of schedule) {
        if (row.emi !== row.principal + row.interest) failCount++;
        if (row.principal < -1e-9 || row.interest < -1e-9) failCount++;
      }

      // final settlement
      if (schedule[schedule.length - 1].balance !== 0) failCount++;

      // sum of principal ≈ loan (final-row correction guarantees ± ₹0.01)
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

      // home-loan quantities
      if (summary.processingFee !== round2((loan * feePct) / 100)) failCount++;
      if (summary.totalInitialCost !== round2(round2(down) + summary.processingFee)) failCount++;
      const pv = round2(round2(loan) + round2(down));
      if (summary.ltv !== round2((round2(loan) / pv) * 100)) failCount++;
      if (summary.ltv < 0 || summary.ltv > 100.000001) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateHomeLoanInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 20, "years", 0.5, 0)).toEqual({});
  });

  it("errors on zero loan amount", () => {
    expect(validateHomeLoanInputs(0, 8.5, 20, "years", 0, 0).amount).toBeDefined();
  });

  it("errors on loan above ₹100 crore", () => {
    expect(validateHomeLoanInputs(1_000_000_001, 8.5, 20, "years", 0, 0).amount).toBeDefined();
  });

  it("errors on negative rate", () => {
    expect(validateHomeLoanInputs(5000000, -1, 20, "years", 0, 0).rate).toBeDefined();
  });

  it("errors on rate above 100%", () => {
    expect(validateHomeLoanInputs(5000000, 101, 20, "years", 0, 0).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validateHomeLoanInputs(5000000, 0, 20, "years", 0, 0).rate).toBeUndefined();
  });

  it("errors on tenure below 1", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 0, "years", 0, 0).tenure).toBeDefined();
  });

  it("errors on tenure above 30 years", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 31, "years", 0, 0).tenure).toBeDefined();
  });

  it("allows exactly 30 years", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 30, "years", 0, 0).tenure).toBeUndefined();
  });

  it("errors on tenure above 360 months", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 361, "months", 0, 0).tenure).toBeDefined();
  });

  it("errors on negative processing fee", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 20, "years", -1, 0).fee).toBeDefined();
  });

  it("errors on processing fee above 5%", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 20, "years", 6, 0).fee).toBeDefined();
  });

  it("allows processing fee of 0", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 20, "years", 0, 0).fee).toBeUndefined();
  });

  it("errors on negative down payment", () => {
    expect(validateHomeLoanInputs(5000000, 8.5, 20, "years", 0, -1).downPayment).toBeDefined();
  });

  it("errors on down payment above ₹100 crore", () => {
    expect(
      validateHomeLoanInputs(5000000, 8.5, 20, "years", 0, 1_000_000_001).downPayment
    ).toBeDefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validateHomeLoanInputs(0, -1, 0, "years", -1, -1);
    expect(errs.amount).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.tenure).toBeDefined();
    expect(errs.fee).toBeDefined();
    expect(errs.downPayment).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("scheduleToCSV", () => {
  it("header includes Opening Balance and Closing Balance", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    expect(csv).toContain("Month,Opening Balance,EMI,Principal,Interest,Closing Balance");
  });

  it("row count equals months + 1 (header)", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(241);
  });

  it("first data row opening balance equals the loan amount", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    const firstRow = csv.split("\n")[1];
    expect(firstRow.startsWith("1,5000000.00,")).toBe(true);
  });

  it("second row opening balance equals first row closing balance", () => {
    const r = calculateHomeLoan({ loanAmount: 5000000, annualRate: 8.5, months: 240 });
    const csv = scheduleToCSV(r.schedule, r.summary.loanAmount);
    const rows = csv.split("\n");
    const firstClosing = rows[1].split(",")[5];
    const secondOpening = rows[2].split(",")[1];
    expect(secondOpening).toBe(firstClosing);
  });
});

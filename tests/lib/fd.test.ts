import { describe, it, expect } from "vitest";
import {
  calculateFD,
  validateFDInputs,
  projectionToCSV,
  periodsPerYear,
  periodLabel,
  type CompoundingFrequency,
} from "@/lib/fd";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

const FREQS: CompoundingFrequency[] = ["yearly", "half-yearly", "quarterly", "monthly"];

// Reference closed-form maturity, independent of the iterative engine.
function refMaturity(P: number, ratePct: number, months: number, n: number): number {
  const r = ratePct / 100;
  const t = months / 12;
  return P * Math.pow(1 + r / n, n * t);
}

// ── Frequency helpers ─────────────────────────────────────────────────────────

describe("periodsPerYear", () => {
  it("yearly = 1", () => expect(periodsPerYear("yearly")).toBe(1));
  it("half-yearly = 2", () => expect(periodsPerYear("half-yearly")).toBe(2));
  it("quarterly = 4", () => expect(periodsPerYear("quarterly")).toBe(4));
  it("monthly = 12", () => expect(periodsPerYear("monthly")).toBe(12));
});

describe("periodLabel", () => {
  it("yearly → Year", () => expect(periodLabel("yearly")).toBe("Year"));
  it("half-yearly → Half-Year", () => expect(periodLabel("half-yearly")).toBe("Half-Year"));
  it("quarterly → Quarter", () => expect(periodLabel("quarterly")).toBe("Quarter"));
  it("monthly → Month", () => expect(periodLabel("monthly")).toBe("Month"));
});

// ── Deterministic financial validation ────────────────────────────────────────

describe("calculateFD — known textbook scenarios", () => {
  it("₹1,00,000 @ 10% annual compounding for 1 year → ₹1,10,000", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 10,
      months: 12,
      frequency: "yearly",
    });
    expect(r.summary.maturityAmount).toBe(110000);
    expect(r.summary.interestEarned).toBe(10000);
  });

  it("₹1,00,000 @ 10% annual compounding for 2 years → ₹1,21,000", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 10,
      months: 24,
      frequency: "yearly",
    });
    // 100000 × 1.1^2 = 121000
    expect(r.summary.maturityAmount).toBe(121000);
    expect(r.summary.interestEarned).toBe(21000);
  });

  it("₹1,00,000 @ 8% quarterly compounding for 1 year → ₹1,08,243.22", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 8,
      months: 12,
      frequency: "quarterly",
    });
    // 100000 × (1.02)^4 = 108243.216
    expect(r.summary.maturityAmount).toBeCloseTo(108243.22, 2);
  });

  it("quarterly compounding: 4 projection rows for a 1-year deposit", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 8,
      months: 12,
      frequency: "quarterly",
    });
    expect(r.projection.length).toBe(4);
  });

  it("monthly compounding: 12 projection rows for a 1-year deposit", () => {
    const r = calculateFD({
      principal: 50000,
      annualRate: 6,
      months: 12,
      frequency: "monthly",
    });
    expect(r.projection.length).toBe(12);
  });

  it("effective annual yield for 8% quarterly ≈ 8.24%", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 8,
      months: 12,
      frequency: "quarterly",
    });
    // (1.02)^4 − 1 = 0.08243216
    expect(r.summary.effectiveAnnualYield).toBeCloseTo(8.24, 2);
  });

  it("effective annual yield for annual compounding equals nominal rate", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 12,
      frequency: "yearly",
    });
    expect(r.summary.effectiveAnnualYield).toBe(7);
  });

  it("higher compounding frequency yields higher maturity (same nominal rate)", () => {
    const base = { principal: 100000, annualRate: 9, months: 60 };
    const yearly = calculateFD({ ...base, frequency: "yearly" });
    const half = calculateFD({ ...base, frequency: "half-yearly" });
    const quarterly = calculateFD({ ...base, frequency: "quarterly" });
    const monthly = calculateFD({ ...base, frequency: "monthly" });
    expect(half.summary.maturityAmount).toBeGreaterThan(yearly.summary.maturityAmount);
    expect(quarterly.summary.maturityAmount).toBeGreaterThan(half.summary.maturityAmount);
    expect(monthly.summary.maturityAmount).toBeGreaterThan(quarterly.summary.maturityAmount);
  });

  it("zero rate: maturity equals principal, no interest", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 0,
      months: 60,
      frequency: "quarterly",
    });
    expect(r.summary.maturityAmount).toBe(100000);
    expect(r.summary.interestEarned).toBe(0);
    expect(r.summary.effectiveAnnualYield).toBe(0);
    expect(r.summary.totalGrowthPct).toBe(0);
  });

  it("total growth % = interest / principal × 100", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 10,
      months: 24,
      frequency: "yearly",
    });
    // interest 21000 / 100000 × 100 = 21
    expect(r.summary.totalGrowthPct).toBe(21);
  });

  it("longer tenure produces higher maturity (same rate & frequency)", () => {
    const short = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 12,
      frequency: "quarterly",
    });
    const long = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 60,
      frequency: "quarterly",
    });
    expect(long.summary.maturityAmount).toBeGreaterThan(short.summary.maturityAmount);
  });
});

// ── Fractional / broken period ────────────────────────────────────────────────

describe("calculateFD — fractional final period", () => {
  it("5 months quarterly = 1 full quarter + 1 partial period → 2 rows", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 8,
      months: 5,
      frequency: "quarterly",
    });
    expect(r.projection.length).toBe(2);
  });

  it("closing balance of last row equals summary maturity (fractional case)", () => {
    const r = calculateFD({
      principal: 123456,
      annualRate: 7.35,
      months: 7,
      frequency: "quarterly",
    });
    const last = r.projection[r.projection.length - 1];
    expect(last.closingBalance).toBe(r.summary.maturityAmount);
  });

  it("maturity matches closed-form reference for a broken period", () => {
    const P = 100000;
    const rate = 8;
    const months = 5;
    const n = 4;
    const r = calculateFD({ principal: P, annualRate: rate, months, frequency: "quarterly" });
    expect(r.summary.maturityAmount).toBeCloseTo(refMaturity(P, rate, months, n), 2);
  });

  it("13 months yearly = 1 full year + partial period → 2 rows", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 13,
      frequency: "yearly",
    });
    expect(r.projection.length).toBe(2);
  });

  it("no fractional row when tenure divides evenly (24 months quarterly = 8 rows)", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 24,
      frequency: "quarterly",
    });
    expect(r.projection.length).toBe(8);
  });
});

// ── Chained projection identities ─────────────────────────────────────────────

describe("calculateFD — projection chaining", () => {
  it("first row opening balance equals principal", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 36,
      frequency: "quarterly",
    });
    expect(r.projection[0].openingBalance).toBe(100000);
  });

  it("each row's opening equals previous row's closing", () => {
    const r = calculateFD({
      principal: 87654,
      annualRate: 9.25,
      months: 48,
      frequency: "monthly",
    });
    for (let i = 1; i < r.projection.length; i++) {
      expect(r.projection[i].openingBalance).toBe(r.projection[i - 1].closingBalance);
    }
  });

  it("period numbers are sequential 1..n", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 36,
      frequency: "quarterly",
    });
    r.projection.forEach((row, i) => expect(row.period).toBe(i + 1));
  });

  it("closing balances are non-decreasing for positive rate", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 8,
      months: 120,
      frequency: "monthly",
    });
    for (let i = 1; i < r.projection.length; i++) {
      expect(r.projection[i].closingBalance).toBeGreaterThanOrEqual(
        r.projection[i - 1].closingBalance
      );
    }
  });
});

// ── Accounting identities ─────────────────────────────────────────────────────

describe("calculateFD — accounting identity: opening + interest = closing (each row)", () => {
  it("holds for quarterly 5-year deposit", () => {
    const r = calculateFD({
      principal: 250000,
      annualRate: 7.5,
      months: 60,
      frequency: "quarterly",
    });
    r.projection.forEach((row) => {
      expect(row.openingBalance + row.interestEarned).toBe(row.closingBalance);
    });
  });

  it("holds for monthly 10-year deposit", () => {
    const r = calculateFD({
      principal: 500000,
      annualRate: 6.8,
      months: 120,
      frequency: "monthly",
    });
    r.projection.forEach((row) => {
      expect(row.openingBalance + row.interestEarned).toBe(row.closingBalance);
    });
  });
});

describe("calculateFD — accounting identity: principal + interest = maturity", () => {
  it("holds for quarterly", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 60,
      frequency: "quarterly",
    });
    expect(r.summary.principal + r.summary.interestEarned).toBe(r.summary.maturityAmount);
  });

  it("holds for zero rate", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 0,
      months: 60,
      frequency: "monthly",
    });
    expect(r.summary.principal + r.summary.interestEarned).toBe(r.summary.maturityAmount);
  });
});

// ── Randomised property tests — 1000+ scenarios ───────────────────────────────
//
// Identity tolerance note: for extreme inputs (high P + high rate + long tenure),
// the maturity can exceed 1e10, where the IEEE 754 error in the derived-difference
// identity exceeds an absolute 1e-9. We use a relative tolerance
// max(1e-9, value × 1e-10) — ~10 significant digits — matching the FP feedback
// pattern established for the SIP engine.

describe("calculateFD — 600 randomised standard scenarios (seed 0xf1ded00d)", () => {
  it("all satisfy identities and match closed-form maturity", () => {
    const rng = lcg(0xf1ded00d);
    let failCount = 0;

    for (let i = 0; i < 600; i++) {
      const P = Math.round(rng(1_000_000, 1000) * 100) / 100;
      const rate = rng(15, 0); // typical FD rate band 0–15%
      const months = Math.ceil(rng(240, 1)); // up to 20 years
      const freq = FREQS[Math.floor(rng(FREQS.length, 0))];
      const n = periodsPerYear(freq);

      const result = calculateFD({ principal: P, annualRate: rate, months, frequency: freq });
      const { summary, projection } = result;

      // row identity
      for (const row of projection) {
        const diff = Math.abs(row.openingBalance + row.interestEarned - row.closingBalance);
        const tol = Math.max(1e-9, row.closingBalance * 1e-10);
        if (diff > tol) failCount++;
      }

      // chaining
      for (let k = 1; k < projection.length; k++) {
        if (projection[k].openingBalance !== projection[k - 1].closingBalance) failCount++;
      }

      // summary identity
      const sumDiff = Math.abs(summary.principal + summary.interestEarned - summary.maturityAmount);
      if (sumDiff > Math.max(1e-9, summary.maturityAmount * 1e-10)) failCount++;

      // maturity matches closed-form reference
      const ref = refMaturity(P, rate, months, n);
      const refDiff = Math.abs(summary.maturityAmount - ref);
      if (refDiff > Math.max(0.01, ref * 1e-9)) failCount++;

      // non-negative interest for non-negative rate
      if (rate >= 0 && summary.interestEarned < -0.01) failCount++;

      // first opening = principal
      if (projection.length > 0 && projection[0].openingBalance !== summary.principal) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateFD — 300 randomised high-rate/long-tenure scenarios (seed 0xabad1dea)", () => {
  it("all satisfy identities under extreme magnitudes", () => {
    const rng = lcg(0xabad1dea);
    let failCount = 0;

    for (let i = 0; i < 300; i++) {
      const P = Math.round(rng(10_000_000, 100000));
      const rate = rng(100, 15);
      const months = Math.ceil(rng(600, 60));
      const freq = FREQS[Math.floor(rng(FREQS.length, 0))];

      const result = calculateFD({ principal: P, annualRate: rate, months, frequency: freq });
      const { summary, projection } = result;

      for (const row of projection) {
        const diff = Math.abs(row.openingBalance + row.interestEarned - row.closingBalance);
        const tol = Math.max(1e-9, row.closingBalance * 1e-10);
        if (diff > tol) failCount++;
      }

      const sumDiff = Math.abs(summary.principal + summary.interestEarned - summary.maturityAmount);
      if (sumDiff > Math.max(1e-9, summary.maturityAmount * 1e-10)) failCount++;

      // maturity strictly grows for positive rate
      if (summary.maturityAmount < summary.principal - 0.01) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateFD — 200 randomised broken-period scenarios (seed 0x5eedcafe)", () => {
  it("last row closing equals maturity even with fractional periods", () => {
    const rng = lcg(0x5eedcafe);
    let failCount = 0;

    for (let i = 0; i < 200; i++) {
      const P = Math.round(rng(500000, 5000));
      const rate = rng(12, 1);
      // Bias toward months that produce broken periods for quarterly/half-yearly.
      const months = Math.ceil(rng(59, 1));
      const freq = FREQS[Math.floor(rng(FREQS.length, 0))];

      const result = calculateFD({ principal: P, annualRate: rate, months, frequency: freq });
      const { summary, projection } = result;

      if (projection.length > 0) {
        const last = projection[projection.length - 1];
        if (last.closingBalance !== summary.maturityAmount) failCount++;
      }

      // effective yield is always >= nominal-equivalent 0 and finite
      if (!isFinite(summary.effectiveAnnualYield)) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateFDInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validateFDInputs(100000, 7, 60)).toEqual({});
  });

  it("errors on zero principal", () => {
    expect(validateFDInputs(0, 7, 60).principal).toBeDefined();
  });

  it("errors on negative principal", () => {
    expect(validateFDInputs(-1000, 7, 60).principal).toBeDefined();
  });

  it("errors on principal exceeding 100 crore", () => {
    expect(validateFDInputs(1_000_000_001, 7, 60).principal).toBeDefined();
  });

  it("errors on NaN rate", () => {
    expect(validateFDInputs(100000, NaN, 60).rate).toBeDefined();
  });

  it("errors on negative rate", () => {
    expect(validateFDInputs(100000, -1, 60).rate).toBeDefined();
  });

  it("errors on rate > 100", () => {
    expect(validateFDInputs(100000, 101, 60).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validateFDInputs(100000, 0, 60).rate).toBeUndefined();
  });

  it("allows rate = 100", () => {
    expect(validateFDInputs(100000, 100, 60).rate).toBeUndefined();
  });

  it("errors on months = 0", () => {
    expect(validateFDInputs(100000, 7, 0).period).toBeDefined();
  });

  it("errors on months > 600", () => {
    expect(validateFDInputs(100000, 7, 601).period).toBeDefined();
  });

  it("allows months = 1", () => {
    expect(validateFDInputs(100000, 7, 1).period).toBeUndefined();
  });

  it("allows months = 600", () => {
    expect(validateFDInputs(100000, 7, 600).period).toBeUndefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validateFDInputs(0, -5, 0);
    expect(errs.principal).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.period).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("projectionToCSV", () => {
  it("header contains required column names", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 12,
      frequency: "quarterly",
    });
    const csv = projectionToCSV(r.projection, "Quarter");
    expect(csv).toContain("Quarter");
    expect(csv).toContain("Opening Balance");
    expect(csv).toContain("Interest Earned");
    expect(csv).toContain("Closing Balance");
  });

  it("row count equals periods + 1 (header)", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 12,
      frequency: "quarterly",
    });
    const csv = projectionToCSV(r.projection, "Quarter");
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(r.projection.length + 1);
  });

  it("first data row starts with '1,'", () => {
    const r = calculateFD({
      principal: 100000,
      annualRate: 7,
      months: 24,
      frequency: "quarterly",
    });
    const csv = projectionToCSV(r.projection, "Quarter");
    const lines = csv.split("\n");
    expect(lines[1].startsWith("1,")).toBe(true);
  });
});

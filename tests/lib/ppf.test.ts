import { describe, it, expect } from "vitest";
import {
  calculatePPF,
  validatePPFInputs,
  projectionToCSV,
  PPF_MIN_CONTRIBUTION,
  PPF_MAX_CONTRIBUTION,
  PPF_CURRENT_RATE,
} from "@/lib/ppf";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

// Independent closed-form reference (annuity-due future value + opening balance),
// distinct from the engine's iterative recurrence.
//   M = opening × (1+r)^N + C × [((1+r)^N − 1) / r] × (1+r)      (r > 0)
//   M = opening + C × N                                          (r = 0)
function refMaturity(C: number, N: number, ratePct: number, opening: number): number {
  const r = ratePct / 100;
  if (r === 0) return opening + C * N;
  const growth = Math.pow(1 + r, N);
  return opening * growth + C * ((growth - 1) / r) * (1 + r);
}

// ── Deterministic financial validation ────────────────────────────────────────

describe("calculatePPF — known reference scenarios", () => {
  it("₹1.5L/yr @ 7.1% for 15 years → maturity ≈ ₹40,68,209", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    expect(r.summary.maturityValue).toBeGreaterThan(4060000);
    expect(r.summary.maturityValue).toBeLessThan(4075000);
    expect(r.summary.totalContribution).toBe(2250000);
  });

  it("maturity matches independent closed-form reference (₹1.5L, 15y, 7.1%)", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    expect(r.summary.maturityValue).toBeCloseTo(refMaturity(150000, 15, 7.1, 0), 2);
  });

  it("total interest = maturity − total contribution (no opening)", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    expect(r.summary.totalInterest).toBeCloseTo(r.summary.maturityValue - 2250000, 2);
  });

  it("first year interest = contribution × rate (opening 0)", () => {
    const r = calculatePPF({ yearlyContribution: 100000, years: 15, annualRate: 7.1 });
    // (0 + 100000) × 0.071 = 7100
    expect(r.projection[0].interest).toBeCloseTo(7100, 2);
    expect(r.projection[0].closingBalance).toBeCloseTo(107100, 2);
  });

  it("projection length equals number of years", () => {
    const r = calculatePPF({ yearlyContribution: 50000, years: 20, annualRate: 7.1 });
    expect(r.projection.length).toBe(20);
  });

  it("zero rate: maturity equals total contribution, no interest", () => {
    const r = calculatePPF({ yearlyContribution: 100000, years: 15, annualRate: 0 });
    expect(r.summary.maturityValue).toBe(1500000);
    expect(r.summary.totalInterest).toBe(0);
    expect(r.summary.wealthGainPct).toBe(0);
  });

  it("opening balance grows and is reflected in maturity", () => {
    const withOpening = calculatePPF({
      yearlyContribution: 100000,
      years: 15,
      annualRate: 7.1,
      openingBalance: 500000,
    });
    const without = calculatePPF({ yearlyContribution: 100000, years: 15, annualRate: 7.1 });
    // Opening ₹5L compounds for 15 years at 7.1%.
    const openingGrown = 500000 * Math.pow(1.071, 15);
    expect(withOpening.summary.maturityValue).toBeCloseTo(
      without.summary.maturityValue + openingGrown,
      1
    );
  });

  it("opening balance is reported in the summary", () => {
    const r = calculatePPF({
      yearlyContribution: 100000,
      years: 15,
      annualRate: 7.1,
      openingBalance: 250000,
    });
    expect(r.summary.openingBalance).toBe(250000);
    expect(r.projection[0].openingBalance).toBe(250000);
  });

  it("wealth gain % = interest / (opening + contribution) × 100", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    const expected = Math.round((r.summary.totalInterest / 2250000) * 100 * 100) / 100;
    expect(r.summary.wealthGainPct).toBe(expected);
  });

  it("longer period produces higher maturity", () => {
    const y15 = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    const y20 = calculatePPF({ yearlyContribution: 150000, years: 20, annualRate: 7.1 });
    expect(y20.summary.maturityValue).toBeGreaterThan(y15.summary.maturityValue);
  });

  it("higher rate produces higher maturity", () => {
    const low = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 6 });
    const high = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 8 });
    expect(high.summary.maturityValue).toBeGreaterThan(low.summary.maturityValue);
  });

  it("default current rate constant is 7.1", () => {
    expect(PPF_CURRENT_RATE).toBe(7.1);
  });
});

// ── Projection structure & chaining ───────────────────────────────────────────

describe("calculatePPF — projection structure", () => {
  it("year numbers are sequential 1..N", () => {
    const r = calculatePPF({ yearlyContribution: 100000, years: 15, annualRate: 7.1 });
    r.projection.forEach((row, idx) => expect(row.year).toBe(idx + 1));
  });

  it("first row opening equals opening balance", () => {
    const r = calculatePPF({
      yearlyContribution: 100000,
      years: 15,
      annualRate: 7.1,
      openingBalance: 123456,
    });
    expect(r.projection[0].openingBalance).toBe(123456);
  });

  it("each row opening equals previous row closing", () => {
    const r = calculatePPF({ yearlyContribution: 90000, years: 25, annualRate: 7.1 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].openingBalance).toBe(r.projection[k - 1].closingBalance);
    }
  });

  it("contribution is constant across all rows", () => {
    const r = calculatePPF({ yearlyContribution: 75000, years: 15, annualRate: 7.1 });
    r.projection.forEach((row) => expect(row.contribution).toBe(75000));
  });

  it("closing balance is strictly increasing for positive rate", () => {
    const r = calculatePPF({ yearlyContribution: 100000, years: 30, annualRate: 7.1 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].closingBalance).toBeGreaterThan(r.projection[k - 1].closingBalance);
    }
  });

  it("summary maturity equals last row closing balance", () => {
    const r = calculatePPF({ yearlyContribution: 100000, years: 18, annualRate: 7.1 });
    expect(r.summary.maturityValue).toBe(r.projection[r.projection.length - 1].closingBalance);
  });
});

// ── Accounting identities ─────────────────────────────────────────────────────

describe("calculatePPF — identity: opening + contribution + interest = closing (each row)", () => {
  it("holds with no opening balance", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    r.projection.forEach((row) => {
      expect(row.openingBalance + row.contribution + row.interest).toBe(row.closingBalance);
    });
  });

  it("holds with an opening balance", () => {
    const r = calculatePPF({
      yearlyContribution: 120000,
      years: 20,
      annualRate: 7.1,
      openingBalance: 800000,
    });
    r.projection.forEach((row) => {
      expect(row.openingBalance + row.contribution + row.interest).toBe(row.closingBalance);
    });
  });

  it("holds at zero rate", () => {
    const r = calculatePPF({ yearlyContribution: 100000, years: 15, annualRate: 0 });
    r.projection.forEach((row) => {
      expect(row.openingBalance + row.contribution + row.interest).toBe(row.closingBalance);
    });
  });
});

describe("calculatePPF — identity: opening + totalContribution + totalInterest = maturity", () => {
  it("holds with opening balance", () => {
    const r = calculatePPF({
      yearlyContribution: 150000,
      years: 15,
      annualRate: 7.1,
      openingBalance: 1000000,
    });
    expect(r.summary.openingBalance + r.summary.totalContribution + r.summary.totalInterest).toBe(
      r.summary.maturityValue
    );
  });
});

// ── Randomized property tests — 1000+ scenarios ───────────────────────────────
//
// Identity tolerance note: for extreme inputs (max contribution + high rate +
// long extension + large opening) the maturity can exceed 1e9, where the IEEE
// 754 error in the derived-difference identity exceeds an absolute 1e-9. We use
// a relative tolerance max(1e-9, value × 1e-10), matching the FP feedback
// pattern established for the SIP/FD/RD engines.

describe("calculatePPF — 600 randomized standard scenarios (seed 0x9f9f01)", () => {
  it("all satisfy identities and match the closed-form reference", () => {
    const rng = lcg(0x9f9f01);
    let failCount = 0;

    for (let s = 0; s < 600; s++) {
      const C = Math.round(rng(PPF_MAX_CONTRIBUTION, PPF_MIN_CONTRIBUTION));
      const N = Math.floor(rng(51, 15)); // 15–50 years
      const rate = rng(12, 0); // realistic PPF band 0–12%
      const opening = Math.round(rng(2_000_000, 0));

      const result = calculatePPF({
        yearlyContribution: C,
        years: N,
        annualRate: rate,
        openingBalance: opening,
      });
      const { summary, projection } = result;

      if (projection.length !== N) failCount++;

      // row identity
      for (const row of projection) {
        const diff = Math.abs(
          row.openingBalance + row.contribution + row.interest - row.closingBalance
        );
        const tol = Math.max(1e-9, row.closingBalance * 1e-10);
        if (diff > tol) failCount++;
      }

      // chaining
      for (let k = 1; k < projection.length; k++) {
        if (projection[k].openingBalance !== projection[k - 1].closingBalance) failCount++;
      }

      // summary identity
      const sumDiff = Math.abs(
        summary.openingBalance +
          summary.totalContribution +
          summary.totalInterest -
          summary.maturityValue
      );
      if (sumDiff > Math.max(1e-9, summary.maturityValue * 1e-10)) failCount++;

      // reference match
      const ref = refMaturity(C, N, rate, opening);
      if (Math.abs(summary.maturityValue - ref) > Math.max(0.01, ref * 1e-9)) failCount++;

      // non-negative interest for non-negative rate
      if (rate >= 0 && summary.totalInterest < -0.01) failCount++;

      // total contribution exact
      if (summary.totalContribution !== Math.round(C * N * 100) / 100) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculatePPF — 300 randomized high-rate/long-extension scenarios (seed 0xc0ffee)", () => {
  it("all satisfy identities under extreme magnitudes", () => {
    const rng = lcg(0xc0ffee);
    let failCount = 0;

    for (let s = 0; s < 300; s++) {
      const C = PPF_MAX_CONTRIBUTION;
      const N = Math.floor(rng(51, 40)); // long extensions 40–50 years
      const rate = rng(15, 10);
      const opening = Math.round(rng(50_000_000, 0));

      const result = calculatePPF({
        yearlyContribution: C,
        years: N,
        annualRate: rate,
        openingBalance: opening,
      });
      const { summary, projection } = result;

      for (const row of projection) {
        const diff = Math.abs(
          row.openingBalance + row.contribution + row.interest - row.closingBalance
        );
        const tol = Math.max(1e-9, row.closingBalance * 1e-10);
        if (diff > tol) failCount++;
      }

      const sumDiff = Math.abs(
        summary.openingBalance +
          summary.totalContribution +
          summary.totalInterest -
          summary.maturityValue
      );
      if (sumDiff > Math.max(1e-9, summary.maturityValue * 1e-10)) failCount++;

      if (summary.maturityValue < summary.totalContribution + summary.openingBalance - 0.01) {
        failCount++;
      }
    }

    expect(failCount).toBe(0);
  });
});

describe("calculatePPF — 200 randomized minimum-contribution scenarios (seed 0x0d0d0d)", () => {
  it("hold identities and reference match for small deposits", () => {
    const rng = lcg(0x0d0d0d);
    let failCount = 0;

    for (let s = 0; s < 200; s++) {
      const C = Math.round(rng(5000, PPF_MIN_CONTRIBUTION));
      const N = Math.floor(rng(51, 15));
      const rate = rng(10, 4);

      const result = calculatePPF({ yearlyContribution: C, years: N, annualRate: rate });
      const { summary } = result;

      const ref = refMaturity(C, N, rate, 0);
      if (Math.abs(summary.maturityValue - ref) > Math.max(0.01, ref * 1e-9)) failCount++;

      const sumDiff = Math.abs(
        summary.totalContribution + summary.totalInterest - summary.maturityValue
      );
      if (sumDiff > Math.max(1e-9, summary.maturityValue * 1e-10)) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validatePPFInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validatePPFInputs(150000, 15, 7.1, 0)).toEqual({});
  });

  it("errors when contribution below minimum (₹500)", () => {
    expect(validatePPFInputs(100, 15, 7.1, 0).contribution).toBeDefined();
  });

  it("allows the minimum contribution exactly", () => {
    expect(validatePPFInputs(500, 15, 7.1, 0).contribution).toBeUndefined();
  });

  it("errors when contribution above maximum (₹1.5L)", () => {
    expect(validatePPFInputs(150001, 15, 7.1, 0).contribution).toBeDefined();
  });

  it("allows the maximum contribution exactly", () => {
    expect(validatePPFInputs(150000, 15, 7.1, 0).contribution).toBeUndefined();
  });

  it("errors on zero / NaN contribution", () => {
    expect(validatePPFInputs(0, 15, 7.1, 0).contribution).toBeDefined();
    expect(validatePPFInputs(NaN, 15, 7.1, 0).contribution).toBeDefined();
  });

  it("errors when period below 15-year lock-in", () => {
    expect(validatePPFInputs(150000, 14, 7.1, 0).years).toBeDefined();
  });

  it("allows exactly 15 years", () => {
    expect(validatePPFInputs(150000, 15, 7.1, 0).years).toBeUndefined();
  });

  it("errors when period above 50 years", () => {
    expect(validatePPFInputs(150000, 51, 7.1, 0).years).toBeDefined();
  });

  it("allows exactly 50 years", () => {
    expect(validatePPFInputs(150000, 50, 7.1, 0).years).toBeUndefined();
  });

  it("errors on negative rate", () => {
    expect(validatePPFInputs(150000, 15, -1, 0).rate).toBeDefined();
  });

  it("errors on rate above 15%", () => {
    expect(validatePPFInputs(150000, 15, 16, 0).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validatePPFInputs(150000, 15, 0, 0).rate).toBeUndefined();
  });

  it("errors on NaN rate", () => {
    expect(validatePPFInputs(150000, 15, NaN, 0).rate).toBeDefined();
  });

  it("errors on negative opening balance", () => {
    expect(validatePPFInputs(150000, 15, 7.1, -1).openingBalance).toBeDefined();
  });

  it("allows zero opening balance", () => {
    expect(validatePPFInputs(150000, 15, 7.1, 0).openingBalance).toBeUndefined();
  });

  it("errors on opening balance above ₹100 crore", () => {
    expect(validatePPFInputs(150000, 15, 7.1, 1_000_000_001).openingBalance).toBeDefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validatePPFInputs(100, 10, -5, -1);
    expect(errs.contribution).toBeDefined();
    expect(errs.years).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.openingBalance).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("projectionToCSV", () => {
  it("header contains required column names", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    const csv = projectionToCSV(r.projection);
    expect(csv).toContain("Year");
    expect(csv).toContain("Opening Balance");
    expect(csv).toContain("Contribution");
    expect(csv).toContain("Interest");
    expect(csv).toContain("Closing Balance");
  });

  it("row count equals years + 1 (header)", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(16);
  });

  it("first data row starts with '1,'", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 15, annualRate: 7.1 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n");
    expect(lines[1].startsWith("1,")).toBe(true);
  });

  it("last data row year equals total years", () => {
    const r = calculatePPF({ yearlyContribution: 150000, years: 20, annualRate: 7.1 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines[lines.length - 1].startsWith("20,")).toBe(true);
  });
});

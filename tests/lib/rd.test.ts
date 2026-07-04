import { describe, it, expect } from "vitest";
import { calculateRD, validateRDInputs, projectionToCSV } from "@/lib/rd";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

// Independent closed-form reference for RD maturity, computed as the direct
// sum over installments (NOT the incremental recurrence used by the engine).
// M = Σ_{j=1}^{N} P × (1 + r/4)^((N − j + 1) / 3)
function refMaturity(P: number, ratePct: number, N: number): number {
  const i = ratePct / 4 / 100;
  let sum = 0;
  for (let j = 1; j <= N; j++) {
    const monthsRemaining = N - j + 1;
    sum += P * Math.pow(1 + i, monthsRemaining / 3);
  }
  return sum;
}

// ── Deterministic financial validation ────────────────────────────────────────

describe("calculateRD — known bank reference scenarios", () => {
  it("₹5,000 × 12 months @ 8% → maturity ≈ ₹62,646.63 (SBI reference)", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 8, months: 12 });
    // Cross-checked against the independent closed-form reference (62,646.6279).
    expect(r.summary.maturityAmount).toBeCloseTo(refMaturity(5000, 8, 12), 2);
    expect(r.summary.maturityAmount).toBeCloseTo(62646.63, 2);
    expect(r.summary.totalDeposited).toBe(60000);
  });

  it("interest earned equals maturity minus total deposited", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 8, months: 12 });
    expect(r.summary.interestEarned).toBeCloseTo(2646.63, 2);
  });

  it("total deposited = monthly deposit × months", () => {
    const r = calculateRD({ monthlyDeposit: 3000, annualRate: 7, months: 60 });
    expect(r.summary.totalDeposited).toBe(180000);
  });

  it("projection length equals number of months", () => {
    const r = calculateRD({ monthlyDeposit: 1000, annualRate: 7, months: 36 });
    expect(r.projection.length).toBe(36);
  });

  it("maturity matches independent closed-form reference (5-year RD)", () => {
    const P = 2500;
    const rate = 7.25;
    const N = 60;
    const r = calculateRD({ monthlyDeposit: P, annualRate: rate, months: N });
    expect(r.summary.maturityAmount).toBeCloseTo(refMaturity(P, rate, N), 2);
  });

  it("effective annual yield for 8% quarterly ≈ 8.24%", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 8, months: 12 });
    // (1.02)^4 − 1 = 0.08243216
    expect(r.summary.effectiveAnnualYield).toBeCloseTo(8.24, 2);
  });

  it("effective annual yield for 7% quarterly ≈ 7.19%", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 12 });
    // (1.0175)^4 − 1 = 0.071859
    expect(r.summary.effectiveAnnualYield).toBeCloseTo(7.19, 2);
  });

  it("zero rate: maturity equals total deposited, no interest", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 0, months: 24 });
    expect(r.summary.maturityAmount).toBe(120000);
    expect(r.summary.interestEarned).toBe(0);
    expect(r.summary.effectiveAnnualYield).toBe(0);
    expect(r.summary.totalGrowthPct).toBe(0);
  });

  it("longer tenure produces higher maturity (same deposit & rate)", () => {
    const short = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 12 });
    const long = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 60 });
    expect(long.summary.maturityAmount).toBeGreaterThan(short.summary.maturityAmount);
  });

  it("higher rate produces higher maturity (same deposit & tenure)", () => {
    const low = calculateRD({ monthlyDeposit: 5000, annualRate: 5, months: 60 });
    const high = calculateRD({ monthlyDeposit: 5000, annualRate: 9, months: 60 });
    expect(high.summary.maturityAmount).toBeGreaterThan(low.summary.maturityAmount);
  });

  it("total growth % = interest / total deposited × 100", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 8, months: 12 });
    const expected =
      Math.round((r.summary.interestEarned / r.summary.totalDeposited) * 100 * 100) / 100;
    expect(r.summary.totalGrowthPct).toBe(expected);
  });

  it("RD earns less than lump-sum FD of same total (installments compound less)", () => {
    // 12 × ₹5,000 = ₹60,000. An FD of ₹60,000 @ 8% quarterly for 1 year:
    const fd = 60000 * Math.pow(1 + 0.08 / 4, 4); // ≈ 64,946.16
    const rd = calculateRD({ monthlyDeposit: 5000, annualRate: 8, months: 12 });
    expect(rd.summary.maturityAmount).toBeLessThan(fd);
  });

  it("1 month RD: single installment grows for one month", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 8, months: 1 });
    // 5000 × (1.02)^(1/3)
    expect(r.summary.maturityAmount).toBeCloseTo(5000 * Math.pow(1.02, 1 / 3), 2);
    expect(r.projection.length).toBe(1);
  });
});

// ── Projection structure & chaining ───────────────────────────────────────────

describe("calculateRD — projection structure", () => {
  it("month numbers are sequential 1..N", () => {
    const r = calculateRD({ monthlyDeposit: 1000, annualRate: 7, months: 24 });
    r.projection.forEach((row, idx) => expect(row.month).toBe(idx + 1));
  });

  it("totalDeposited in each row equals round2(P × month)", () => {
    const P = 1500;
    const r = calculateRD({ monthlyDeposit: P, annualRate: 7, months: 24 });
    r.projection.forEach((row) => {
      expect(row.totalDeposited).toBe(Math.round(P * row.month * 100) / 100);
    });
  });

  it("balance is non-decreasing for positive rate", () => {
    const r = calculateRD({ monthlyDeposit: 2000, annualRate: 8, months: 120 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].balance).toBeGreaterThanOrEqual(r.projection[k - 1].balance);
    }
  });

  it("summary derives from the last projection row", () => {
    const r = calculateRD({ monthlyDeposit: 2000, annualRate: 7.5, months: 60 });
    const last = r.projection[r.projection.length - 1];
    expect(r.summary.totalDeposited).toBe(last.totalDeposited);
    expect(r.summary.maturityAmount).toBe(last.balance);
    expect(r.summary.interestEarned).toBe(last.interestEarned);
  });
});

// ── Accounting identities ─────────────────────────────────────────────────────

describe("calculateRD — accounting identity: totalDeposited + interest = balance (each row)", () => {
  it("holds for 5-year RD", () => {
    const r = calculateRD({ monthlyDeposit: 3000, annualRate: 7.5, months: 60 });
    r.projection.forEach((row) => {
      expect(row.totalDeposited + row.interestEarned).toBe(row.balance);
    });
  });

  it("holds for zero rate", () => {
    const r = calculateRD({ monthlyDeposit: 3000, annualRate: 0, months: 24 });
    r.projection.forEach((row) => {
      expect(row.totalDeposited + row.interestEarned).toBe(row.balance);
    });
  });
});

describe("calculateRD — accounting identity: totalDeposited + interest = maturity", () => {
  it("holds for quarterly compounding", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 60 });
    expect(r.summary.totalDeposited + r.summary.interestEarned).toBe(r.summary.maturityAmount);
  });
});

// ── Randomized property tests — 1000+ scenarios ───────────────────────────────
//
// Identity tolerance note: for extreme inputs (high deposit + high rate + long
// tenure), the balance can exceed 1e10, where the IEEE 754 error in the
// derived-difference identity exceeds an absolute 1e-9. We use a relative
// tolerance max(1e-9, value × 1e-10) — ~10 significant digits — matching the
// FP feedback pattern established for the SIP/FD engines.

describe("calculateRD — 600 randomized standard scenarios (seed 0xr0tating)", () => {
  it("all satisfy identities and match closed-form reference", () => {
    const rng = lcg(0x2071a71); // arbitrary fixed seed
    let failCount = 0;

    for (let s = 0; s < 600; s++) {
      const P = Math.round(rng(100000, 500) * 100) / 100;
      const rate = rng(15, 0); // typical RD band 0–15%
      const N = Math.ceil(rng(240, 1)); // up to 20 years

      const result = calculateRD({ monthlyDeposit: P, annualRate: rate, months: N });
      const { summary, projection } = result;

      if (projection.length !== N) failCount++;

      // row identity
      for (const row of projection) {
        const diff = Math.abs(row.totalDeposited + row.interestEarned - row.balance);
        const tol = Math.max(1e-9, row.balance * 1e-10);
        if (diff > tol) failCount++;
      }

      // summary identity
      const sumDiff = Math.abs(
        summary.totalDeposited + summary.interestEarned - summary.maturityAmount
      );
      if (sumDiff > Math.max(1e-9, summary.maturityAmount * 1e-10)) failCount++;

      // maturity matches independent closed-form reference
      const ref = refMaturity(P, rate, N);
      if (Math.abs(summary.maturityAmount - ref) > Math.max(0.01, ref * 1e-9)) failCount++;

      // non-negative interest for non-negative rate
      if (rate >= 0 && summary.interestEarned < -0.01) failCount++;

      // total deposited exact
      if (summary.totalDeposited !== Math.round(P * N * 100) / 100) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateRD — 300 randomized high-rate/long-tenure scenarios (seed 0xd39051)", () => {
  it("all satisfy identities under extreme magnitudes", () => {
    const rng = lcg(0xd39051);
    let failCount = 0;

    for (let s = 0; s < 300; s++) {
      const P = Math.round(rng(1_000_000, 10000));
      const rate = rng(100, 15);
      const N = Math.ceil(rng(600, 60));

      const result = calculateRD({ monthlyDeposit: P, annualRate: rate, months: N });
      const { summary, projection } = result;

      for (const row of projection) {
        const diff = Math.abs(row.totalDeposited + row.interestEarned - row.balance);
        const tol = Math.max(1e-9, row.balance * 1e-10);
        if (diff > tol) failCount++;
      }

      const sumDiff = Math.abs(
        summary.totalDeposited + summary.interestEarned - summary.maturityAmount
      );
      if (sumDiff > Math.max(1e-9, summary.maturityAmount * 1e-10)) failCount++;

      // maturity strictly exceeds total deposited for positive rate
      if (summary.maturityAmount < summary.totalDeposited - 0.01) failCount++;

      if (!isFinite(summary.effectiveAnnualYield)) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateRD — 200 randomized short-tenure scenarios (seed 0x5h0r7)", () => {
  it("hold identities and reference match for 1–24 month RDs", () => {
    const rng = lcg(0x5401207);
    let failCount = 0;

    for (let s = 0; s < 200; s++) {
      const P = Math.round(rng(50000, 100));
      const rate = rng(12, 1);
      const N = Math.ceil(rng(24, 1));

      const result = calculateRD({ monthlyDeposit: P, annualRate: rate, months: N });
      const { summary } = result;

      const ref = refMaturity(P, rate, N);
      if (Math.abs(summary.maturityAmount - ref) > Math.max(0.01, ref * 1e-9)) failCount++;

      const sumDiff = Math.abs(
        summary.totalDeposited + summary.interestEarned - summary.maturityAmount
      );
      if (sumDiff > Math.max(1e-9, summary.maturityAmount * 1e-10)) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateRDInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validateRDInputs(5000, 7, 60)).toEqual({});
  });

  it("errors on zero deposit", () => {
    expect(validateRDInputs(0, 7, 60).amount).toBeDefined();
  });

  it("errors on negative deposit", () => {
    expect(validateRDInputs(-100, 7, 60).amount).toBeDefined();
  });

  it("errors on deposit exceeding 100 crore", () => {
    expect(validateRDInputs(1_000_000_001, 7, 60).amount).toBeDefined();
  });

  it("errors on NaN rate", () => {
    expect(validateRDInputs(5000, NaN, 60).rate).toBeDefined();
  });

  it("errors on negative rate", () => {
    expect(validateRDInputs(5000, -1, 60).rate).toBeDefined();
  });

  it("errors on rate > 100", () => {
    expect(validateRDInputs(5000, 101, 60).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validateRDInputs(5000, 0, 60).rate).toBeUndefined();
  });

  it("allows rate = 100", () => {
    expect(validateRDInputs(5000, 100, 60).rate).toBeUndefined();
  });

  it("errors on months = 0", () => {
    expect(validateRDInputs(5000, 7, 0).period).toBeDefined();
  });

  it("errors on months > 600", () => {
    expect(validateRDInputs(5000, 7, 601).period).toBeDefined();
  });

  it("allows months = 1", () => {
    expect(validateRDInputs(5000, 7, 1).period).toBeUndefined();
  });

  it("allows months = 600", () => {
    expect(validateRDInputs(5000, 7, 600).period).toBeUndefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validateRDInputs(0, -5, 0);
    expect(errs.amount).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.period).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("projectionToCSV", () => {
  it("header contains required column names", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 6 });
    const csv = projectionToCSV(r.projection, 5000);
    expect(csv).toContain("Month");
    expect(csv).toContain("Total Deposited");
    expect(csv).toContain("Interest Earned");
    expect(csv).toContain("Balance");
  });

  it("row count equals months + 1 (header)", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 12 });
    const csv = projectionToCSV(r.projection, 5000);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(13);
  });

  it("first data row starts with '1,'", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 12 });
    const csv = projectionToCSV(r.projection, 5000);
    const lines = csv.split("\n");
    expect(lines[1].startsWith("1,")).toBe(true);
  });

  it("last data row month number equals total months", () => {
    const r = calculateRD({ monthlyDeposit: 5000, annualRate: 7, months: 24 });
    const csv = projectionToCSV(r.projection, 5000);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines[lines.length - 1].startsWith("24,")).toBe(true);
  });
});

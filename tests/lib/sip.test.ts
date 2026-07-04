import { describe, it, expect } from "vitest";
import { calculateSIP, validateSIPInputs, projectionToCSV } from "@/lib/sip";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
// Identical generator used in gst.test.ts and emi.test.ts for reproducibility.
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

// ── Deterministic sanity checks ───────────────────────────────────────────────

describe("calculateSIP — deterministic scenarios", () => {
  it("zero rate: portfolio value equals total invested", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 0, months: 12 });
    expect(r.summary.totalInvested).toBe(12000);
    expect(r.summary.totalValue).toBe(12000);
    expect(r.summary.estimatedReturn).toBe(0);
    expect(r.summary.wealthGainedPct).toBe(0);
  });

  it("zero rate: CAGR is 0 for >= 12 months", () => {
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 0, months: 24 });
    expect(r.summary.cagr).toBe(0);
  });

  it("zero rate: CAGR is null for < 12 months", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 0, months: 6 });
    expect(r.summary.cagr).toBeNull();
  });

  it("1 month: single installment grows by one month of return", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 1 });
    // balance = 1000 × (1 + 0.01) = 1010
    expect(r.summary.totalValue).toBe(1010);
    expect(r.summary.totalInvested).toBe(1000);
    expect(r.summary.estimatedReturn).toBe(10);
    expect(r.summary.cagr).toBeNull(); // < 12 months
  });

  it("projection length equals months", () => {
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 12, months: 36 });
    expect(r.projection.length).toBe(36);
  });

  it("month numbers are sequential 1..n", () => {
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 8, months: 24 });
    r.projection.forEach((row, i) => {
      expect(row.month).toBe(i + 1);
    });
  });

  it("portfolio is non-decreasing for positive rate", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 15, months: 60 });
    for (let i = 1; i < r.projection.length; i++) {
      expect(r.projection[i].portfolioValue).toBeGreaterThanOrEqual(
        r.projection[i - 1].portfolioValue
      );
    }
  });

  it("totalInvested in each row equals round2(P × k)", () => {
    const P = 1000;
    const r = calculateSIP({ monthlyAmount: P, annualRate: 12, months: 24 });
    r.projection.forEach((row, i) => {
      const k = i + 1;
      const expected = Math.round(P * k * 100) / 100;
      expect(row.totalInvested).toBe(expected);
    });
  });

  it("summary derives from last projection row", () => {
    const r = calculateSIP({ monthlyAmount: 2000, annualRate: 10, months: 60 });
    const last = r.projection[59];
    expect(r.summary.totalInvested).toBe(last.totalInvested);
    expect(r.summary.totalValue).toBe(last.portfolioValue);
    expect(r.summary.estimatedReturn).toBe(last.interestEarned);
  });

  it("P=1000, rate=12%, 120 months: totalInvested=120000", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 120 });
    expect(r.summary.totalInvested).toBe(120000);
  });

  it("P=1000, rate=12%, 120 months: totalValue > 230000", () => {
    // Known: FV ≈ 232,339 for P=1000, 12% p.a., 120 months (annuity due)
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 120 });
    expect(r.summary.totalValue).toBeGreaterThan(230000);
    expect(r.summary.totalValue).toBeLessThan(235000);
  });

  it("P=1000, rate=12%, 120 months: returns > 100000", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 120 });
    expect(r.summary.estimatedReturn).toBeGreaterThan(100000);
  });

  it("CAGR is present for 120-month SIP", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 120 });
    expect(r.summary.cagr).not.toBeNull();
    // CAGR should be positive but less than the annual rate (since not all money
    // is invested for the full period — earlier instalments earn more, later less)
    expect(r.summary.cagr!).toBeGreaterThan(0);
    expect(r.summary.cagr!).toBeLessThan(12);
  });

  it("wealth gained is positive for positive rate", () => {
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 15, months: 60 });
    expect(r.summary.wealthGainedPct).toBeGreaterThan(0);
  });

  it("higher rate produces higher total value", () => {
    const low = calculateSIP({ monthlyAmount: 1000, annualRate: 8, months: 60 });
    const high = calculateSIP({ monthlyAmount: 1000, annualRate: 15, months: 60 });
    expect(high.summary.totalValue).toBeGreaterThan(low.summary.totalValue);
  });

  it("longer period produces higher total value (same rate)", () => {
    const short = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 60 });
    const long = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 120 });
    expect(long.summary.totalValue).toBeGreaterThan(short.summary.totalValue);
  });
});

// ── Accounting identities ─────────────────────────────────────────────────────

describe("calculateSIP — accounting identity: invested + interest = portfolio (each row)", () => {
  it("holds for P=500, rate=12%, 36 months", () => {
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 12, months: 36 });
    r.projection.forEach((row) => {
      expect(row.totalInvested + row.interestEarned).toBe(row.portfolioValue);
    });
  });

  it("holds for P=1000, rate=0%, 24 months", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 0, months: 24 });
    r.projection.forEach((row) => {
      expect(row.totalInvested + row.interestEarned).toBe(row.portfolioValue);
    });
  });
});

describe("calculateSIP — accounting identity: summary invested + return = totalValue", () => {
  it("holds for P=1000, rate=12%, 120 months", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 120 });
    expect(r.summary.totalInvested + r.summary.estimatedReturn).toBe(r.summary.totalValue);
  });

  it("holds for P=500, rate=0%, 6 months", () => {
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 0, months: 6 });
    expect(r.summary.totalInvested + r.summary.estimatedReturn).toBe(r.summary.totalValue);
  });
});

// ── Randomised scenarios — wide range ────────────────────────────────────────
// 500 scenarios: P ∈ [100, 100000], rate ∈ [0, 50%], months ∈ [1, 600]
//
// Identity tolerance note: for extreme inputs (high P + high rate + many months),
// the portfolio value can exceed 1e10. At that scale the IEEE 754 error in
// fl(A + fl(C − A)) − C can be O(C × 2^−52), larger than 1e-9 absolute.
// We therefore use a relative tolerance: max(1e-9, C × 1e-10), which
// corresponds to ~10 significant digits of precision — appropriate for the
// structural test purpose of these scenarios.

describe("calculateSIP — 500 randomised wide-range scenarios (seed 0xcafef00d)", () => {
  it("all satisfy row accounting identity and non-negative returns", () => {
    const rng = lcg(0xcafef00d);
    let failCount = 0;

    for (let i = 0; i < 500; i++) {
      const P = Math.round(rng(100000, 100) * 100) / 100;
      const rate = rng(50, 0);
      const months = Math.ceil(rng(600, 1));

      const result = calculateSIP({ monthlyAmount: P, annualRate: rate, months });
      const { summary, projection } = result;

      // projection length
      if (projection.length !== months) failCount++;

      // row identity: totalInvested + interestEarned = portfolioValue
      // Use relative tolerance to accommodate extreme portfolio magnitudes.
      for (const row of projection) {
        const diff = Math.abs(row.totalInvested + row.interestEarned - row.portfolioValue);
        const tol = Math.max(1e-9, row.portfolioValue * 1e-10);
        if (diff > tol) failCount++;
      }

      // summary identity
      const sumDiff = Math.abs(
        summary.totalInvested + summary.estimatedReturn - summary.totalValue
      );
      const sumTol = Math.max(1e-9, summary.totalValue * 1e-10);
      if (sumDiff > sumTol) failCount++;

      // non-negative returns for non-negative rate
      if (rate >= 0 && summary.estimatedReturn < -0.01) failCount++;

      // CAGR present iff months >= 12
      if (months >= 12 && summary.cagr === null) failCount++;
      if (months < 12 && summary.cagr !== null) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Randomised scenarios — common SIP range ───────────────────────────────────
// 300 scenarios: P ∈ [500, 25000], rate ∈ [6, 20%], months ∈ [12, 360]

describe("calculateSIP — 300 randomised common-SIP scenarios (seed 0xdeadbeef)", () => {
  it("all satisfy accounting identities and reasonable CAGR bounds", () => {
    const rng = lcg(0xdeadbeef);
    let failCount = 0;

    for (let i = 0; i < 300; i++) {
      const P = Math.round(rng(25000, 500));
      const rate = rng(20, 6);
      const months = Math.ceil(rng(360, 12));

      const result = calculateSIP({ monthlyAmount: P, annualRate: rate, months });
      const { summary, projection } = result;

      // row identity
      for (const row of projection) {
        const diff = Math.abs(row.totalInvested + row.interestEarned - row.portfolioValue);
        if (diff > 1e-9) failCount++;
      }

      // summary identity
      const sumDiff = Math.abs(
        summary.totalInvested + summary.estimatedReturn - summary.totalValue
      );
      if (sumDiff > 1e-9) failCount++;

      // CAGR must be present (months >= 12 always in this range)
      if (summary.cagr === null) failCount++;

      // CAGR should be positive (rate > 0)
      if (summary.cagr !== null && summary.cagr < 0) failCount++;

      // wealthGained should be positive
      if (summary.wealthGainedPct < 0) failCount++;

      // totalValue > totalInvested for positive rate
      if (summary.totalValue < summary.totalInvested - 0.01) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Randomised scenarios — high rate ──────────────────────────────────────────
// 200 scenarios: P ∈ [1000, 50000], rate ∈ [25, 100%], months ∈ [12, 600]
//
// High-rate scenarios produce very large portfolio values where round2 itself
// loses 2dp precision (ULP > 0.01). Same relative tolerance as wide-range.

describe("calculateSIP — 200 randomised high-rate scenarios (seed 0xbaddcafe)", () => {
  it("all satisfy accounting identities", () => {
    const rng = lcg(0xbaddcafe);
    let failCount = 0;

    for (let i = 0; i < 200; i++) {
      const P = Math.round(rng(50000, 1000));
      const rate = rng(100, 25);
      const months = Math.ceil(rng(600, 12));

      const result = calculateSIP({ monthlyAmount: P, annualRate: rate, months });
      const { summary, projection } = result;

      for (const row of projection) {
        const diff = Math.abs(row.totalInvested + row.interestEarned - row.portfolioValue);
        const tol = Math.max(1e-9, row.portfolioValue * 1e-10);
        if (diff > tol) failCount++;
      }

      const sumDiff = Math.abs(
        summary.totalInvested + summary.estimatedReturn - summary.totalValue
      );
      const sumTol = Math.max(1e-9, summary.totalValue * 1e-10);
      if (sumDiff > sumTol) failCount++;

      if (summary.cagr === null) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateSIPInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validateSIPInputs(1000, 12, 120)).toEqual({});
  });

  it("errors on zero amount", () => {
    expect(validateSIPInputs(0, 12, 120).amount).toBeDefined();
  });

  it("errors on negative amount", () => {
    expect(validateSIPInputs(-500, 12, 120).amount).toBeDefined();
  });

  it("errors on amount exceeding 100 crore", () => {
    expect(validateSIPInputs(1_000_000_001, 12, 120).amount).toBeDefined();
  });

  it("errors on NaN rate", () => {
    expect(validateSIPInputs(1000, NaN, 120).rate).toBeDefined();
  });

  it("errors on negative rate", () => {
    expect(validateSIPInputs(1000, -1, 120).rate).toBeDefined();
  });

  it("errors on rate > 100", () => {
    expect(validateSIPInputs(1000, 101, 120).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validateSIPInputs(1000, 0, 120).rate).toBeUndefined();
  });

  it("allows rate = 100", () => {
    expect(validateSIPInputs(1000, 100, 120).rate).toBeUndefined();
  });

  it("errors on months = 0", () => {
    expect(validateSIPInputs(1000, 12, 0).period).toBeDefined();
  });

  it("errors on months > 600", () => {
    expect(validateSIPInputs(1000, 12, 601).period).toBeDefined();
  });

  it("allows months = 600", () => {
    expect(validateSIPInputs(1000, 12, 600).period).toBeUndefined();
  });

  it("allows months = 1", () => {
    expect(validateSIPInputs(1000, 12, 1).period).toBeUndefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validateSIPInputs(0, -5, 0);
    expect(errs.amount).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.period).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("projectionToCSV", () => {
  it("header contains required column names", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 3 });
    const csv = projectionToCSV(r.projection, 1000);
    expect(csv).toContain("Month");
    expect(csv).toContain("Total Invested");
    expect(csv).toContain("Interest Earned");
    expect(csv).toContain("Portfolio Value");
  });

  it("row count equals months + 1 (header)", () => {
    const months = 12;
    const r = calculateSIP({ monthlyAmount: 500, annualRate: 8, months });
    const csv = projectionToCSV(r.projection, 500);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(months + 1);
  });

  it("first data row starts with '1,'", () => {
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months: 6 });
    const csv = projectionToCSV(r.projection, 1000);
    const lines = csv.split("\n");
    expect(lines[1].startsWith("1,")).toBe(true);
  });

  it("last data row month number equals total months", () => {
    const months = 24;
    const r = calculateSIP({ monthlyAmount: 1000, annualRate: 12, months });
    const csv = projectionToCSV(r.projection, 1000);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines[lines.length - 1].startsWith(`${months},`)).toBe(true);
  });
});

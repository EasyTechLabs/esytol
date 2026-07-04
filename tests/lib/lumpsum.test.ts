import { describe, it, expect } from "vitest";
import { calculateLumpsum, validateLumpsumInputs, projectionToCSV } from "@/lib/lumpsum";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

// Independent reference for future value.
function refFV(P: number, ratePct: number, months: number): number {
  return P * Math.pow(1 + ratePct / 100, months / 12);
}

// ── Deterministic financial validation ────────────────────────────────────────

describe("calculateLumpsum — known scenarios", () => {
  it("₹1,00,000 @ 12% for 10 years → ₹3,10,584.82", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    // 100000 × 1.12^10 = 310584.82
    expect(r.summary.maturityValue).toBeCloseTo(310584.82, 2);
    expect(r.summary.initialInvestment).toBe(100000);
  });

  it("estimated returns = maturity − initial", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    expect(r.summary.estimatedReturns).toBeCloseTo(210584.82, 2);
  });

  it("investment multiple = (1 + r)^t", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    // 1.12^10 = 3.1058
    expect(r.summary.investmentMultiple).toBeCloseTo(3.11, 2);
  });

  it("CAGR equals the expected return for constant growth", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    expect(r.summary.cagrPct).toBe(12);
  });

  it("CAGR equals expected return for a fractional period too", () => {
    const r = calculateLumpsum({ initialInvestment: 50000, annualRate: 9.5, months: 42 });
    expect(r.summary.cagrPct).toBe(9.5);
  });

  it("wealth gain % = returns / initial × 100", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    const expected = Math.round((r.summary.estimatedReturns / 100000) * 100 * 100) / 100;
    expect(r.summary.wealthGainPct).toBe(expected);
  });

  it("maturity matches independent reference", () => {
    const r = calculateLumpsum({ initialInvestment: 250000, annualRate: 8.5, months: 84 });
    expect(r.summary.maturityValue).toBeCloseTo(refFV(250000, 8.5, 84), 2);
  });

  it("zero return: maturity equals initial, no returns", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 0, months: 120 });
    expect(r.summary.maturityValue).toBe(100000);
    expect(r.summary.estimatedReturns).toBe(0);
    expect(r.summary.wealthGainPct).toBe(0);
    expect(r.summary.investmentMultiple).toBe(1);
    expect(r.summary.cagrPct).toBe(0);
  });

  it("negative return: 100000 @ −10% for 5 years → loss", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: -10, months: 60 });
    // 100000 × 0.9^5 = 59049
    expect(r.summary.maturityValue).toBeCloseTo(59049, 2);
    expect(r.summary.estimatedReturns).toBeCloseTo(-40951, 2);
    expect(r.summary.wealthGainPct).toBeCloseTo(-40.95, 2);
    expect(r.summary.cagrPct).toBe(-10);
  });

  it("total loss: −100% return → maturity 0, multiple 0×", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: -100, months: 60 });
    expect(r.summary.maturityValue).toBe(0);
    expect(r.summary.estimatedReturns).toBe(-100000);
    expect(r.summary.investmentMultiple).toBe(0);
    expect(r.summary.wealthGainPct).toBe(-100);
  });

  it("month input: 18 months = 1.5 years honoured", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 10, months: 18 });
    // 100000 × 1.1^1.5 = 115369.26
    expect(r.summary.maturityValue).toBeCloseTo(refFV(100000, 10, 18), 2);
    expect(r.summary.years).toBe(1.5);
  });

  it("higher return produces higher maturity", () => {
    const low = calculateLumpsum({ initialInvestment: 100000, annualRate: 8, months: 120 });
    const high = calculateLumpsum({ initialInvestment: 100000, annualRate: 14, months: 120 });
    expect(high.summary.maturityValue).toBeGreaterThan(low.summary.maturityValue);
  });

  it("longer period produces higher maturity (positive return)", () => {
    const short = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 60 });
    const long = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    expect(long.summary.maturityValue).toBeGreaterThan(short.summary.maturityValue);
  });
});

// ── Projection ────────────────────────────────────────────────────────────────

describe("calculateLumpsum — yearly projection", () => {
  it("integer years: one row per year, last row equals maturity", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    expect(r.projection.length).toBe(10);
    expect(r.projection[9].closingValue).toBe(r.summary.maturityValue);
  });

  it("first row opening equals initial investment", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    expect(r.projection[0].openingValue).toBe(100000);
  });

  it("each row opening equals previous row closing", () => {
    const r = calculateLumpsum({ initialInvestment: 80000, annualRate: 11, months: 180 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].openingValue).toBe(r.projection[k - 1].closingValue);
    }
  });

  it("year numbers are sequential for full years", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    r.projection.forEach((row, idx) => expect(row.year).toBe(idx + 1));
  });

  it("fractional period appends a final partial-year row ending at maturity", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 10, months: 18 });
    expect(r.projection.length).toBe(2);
    expect(r.projection[1].year).toBe(1.5);
    expect(r.projection[1].closingValue).toBe(r.summary.maturityValue);
  });

  it("sub-year period (6 months): single row equal to maturity", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 10, months: 6 });
    expect(r.projection.length).toBe(1);
    expect(r.projection[0].closingValue).toBe(r.summary.maturityValue);
  });

  it("closing increases for positive return", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].closingValue).toBeGreaterThan(r.projection[k - 1].closingValue);
    }
  });

  it("closing decreases for negative return", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: -8, months: 120 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].closingValue).toBeLessThan(r.projection[k - 1].closingValue);
    }
  });

  it("closing is flat for zero return", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 0, months: 60 });
    r.projection.forEach((row) => expect(row.closingValue).toBe(100000));
  });
});

// ── Accounting identities ─────────────────────────────────────────────────────

describe("calculateLumpsum — identity: opening + growth = closing (each row)", () => {
  it("holds for positive return", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 180 });
    r.projection.forEach((row) => {
      expect(row.openingValue + row.growth).toBe(row.closingValue);
    });
  });

  it("holds for negative return", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: -6, months: 120 });
    r.projection.forEach((row) => {
      expect(row.openingValue + row.growth).toBe(row.closingValue);
    });
  });
});

describe("calculateLumpsum — identity: initial + returns = maturity", () => {
  it("holds for a gain", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    expect(r.summary.initialInvestment + r.summary.estimatedReturns).toBe(r.summary.maturityValue);
  });

  it("holds for a loss", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: -20, months: 60 });
    expect(r.summary.initialInvestment + r.summary.estimatedReturns).toBe(r.summary.maturityValue);
  });
});

// ── Randomized property tests — 1000+ scenarios ───────────────────────────────

describe("calculateLumpsum — 600 randomized positive-return scenarios (seed 0x1a3b5c)", () => {
  it("all satisfy identities and match the reference", () => {
    const rng = lcg(0x1a3b5c);
    let failCount = 0;

    for (let s = 0; s < 600; s++) {
      const P = Math.round(rng(10_000_000, 1000) * 100) / 100;
      const rate = rng(100, 0); // 0–100%
      const months = Math.ceil(rng(600, 1));

      const r = calculateLumpsum({ initialInvestment: P, annualRate: rate, months });
      const { summary, projection } = r;

      // maturity matches reference
      const ref = refFV(P, rate, months);
      if (Math.abs(summary.maturityValue - ref) > Math.max(0.02, ref * 1e-9)) failCount++;

      // CAGR equals input rate
      if (summary.cagrPct !== Math.round(rate * 100) / 100) failCount++;

      // summary identity (relative tolerance: at extreme multiples maturity ≫
      // initial, so the derived-difference reconstruction carries sub-ULP error).
      const sumDiff = Math.abs(
        summary.initialInvestment + summary.estimatedReturns - summary.maturityValue
      );
      if (sumDiff > Math.max(1e-9, Math.abs(summary.maturityValue) * 1e-10)) failCount++;

      // last projection row equals maturity
      const last = projection[projection.length - 1];
      if (last.closingValue !== summary.maturityValue) failCount++;

      // row identity (relative tolerance for extreme ratios; exact under Sterbenz)
      for (const row of projection) {
        const diff = Math.abs(row.openingValue + row.growth - row.closingValue);
        if (diff > Math.max(1e-9, Math.abs(row.closingValue) * 1e-10)) failCount++;
      }

      // non-negative returns for non-negative rate
      if (rate >= 0 && summary.estimatedReturns < -0.01) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateLumpsum — 300 randomized negative-return scenarios (seed 0x2c4e6f)", () => {
  it("losses are handled and reference matches", () => {
    const rng = lcg(0x2c4e6f);
    let failCount = 0;

    for (let s = 0; s < 300; s++) {
      const P = Math.round(rng(10_000_000, 1000));
      const rate = rng(0, -100); // −100% to 0
      const months = Math.ceil(rng(600, 1));

      const r = calculateLumpsum({ initialInvestment: P, annualRate: rate, months });
      const { summary } = r;

      const ref = refFV(P, rate, months);
      if (Math.abs(summary.maturityValue - ref) > Math.max(0.02, Math.abs(ref) * 1e-9)) {
        failCount++;
      }

      // loss ⇒ maturity ≤ initial
      if (summary.maturityValue > summary.initialInvestment + 0.01) failCount++;

      const sumDiff = Math.abs(
        summary.initialInvestment + summary.estimatedReturns - summary.maturityValue
      );
      if (sumDiff > Math.max(1e-9, Math.abs(summary.maturityValue) * 1e-10)) failCount++;

      if (!isFinite(summary.maturityValue)) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateLumpsum — 200 randomized fractional-period scenarios (seed 0x3d5f7a)", () => {
  it("last row equals maturity regardless of fractional years", () => {
    const rng = lcg(0x3d5f7a);
    let failCount = 0;

    for (let s = 0; s < 200; s++) {
      const P = Math.round(rng(500000, 1000));
      const rate = rng(30, -30);
      const months = Math.ceil(rng(59, 1));

      const r = calculateLumpsum({ initialInvestment: P, annualRate: rate, months });
      const last = r.projection[r.projection.length - 1];
      if (last.closingValue !== r.summary.maturityValue) failCount++;

      const years = months / 12;
      if (!Number.isInteger(years)) {
        if (Math.abs(last.year - Math.round(years * 100) / 100) > 1e-9) failCount++;
      }
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateLumpsumInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validateLumpsumInputs(100000, 12, 120)).toEqual({});
  });

  it("errors on zero investment", () => {
    expect(validateLumpsumInputs(0, 12, 120).amount).toBeDefined();
  });

  it("errors on negative investment", () => {
    expect(validateLumpsumInputs(-1000, 12, 120).amount).toBeDefined();
  });

  it("errors on NaN investment", () => {
    expect(validateLumpsumInputs(NaN, 12, 120).amount).toBeDefined();
  });

  it("errors on investment above ₹100 crore", () => {
    expect(validateLumpsumInputs(1_000_000_001, 12, 120).amount).toBeDefined();
  });

  it("allows a negative rate (loss)", () => {
    expect(validateLumpsumInputs(100000, -10, 120).rate).toBeUndefined();
  });

  it("allows exactly −100%", () => {
    expect(validateLumpsumInputs(100000, -100, 120).rate).toBeUndefined();
  });

  it("errors on rate below −100%", () => {
    expect(validateLumpsumInputs(100000, -101, 120).rate).toBeDefined();
  });

  it("errors on rate above 100%", () => {
    expect(validateLumpsumInputs(100000, 101, 120).rate).toBeDefined();
  });

  it("errors on NaN rate", () => {
    expect(validateLumpsumInputs(100000, NaN, 120).rate).toBeDefined();
  });

  it("allows rate = 0", () => {
    expect(validateLumpsumInputs(100000, 0, 120).rate).toBeUndefined();
  });

  it("errors on months = 0", () => {
    expect(validateLumpsumInputs(100000, 12, 0).period).toBeDefined();
  });

  it("errors on months > 600", () => {
    expect(validateLumpsumInputs(100000, 12, 601).period).toBeDefined();
  });

  it("allows months = 1", () => {
    expect(validateLumpsumInputs(100000, 12, 1).period).toBeUndefined();
  });

  it("allows months = 600", () => {
    expect(validateLumpsumInputs(100000, 12, 600).period).toBeUndefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validateLumpsumInputs(0, -200, 0);
    expect(errs.amount).toBeDefined();
    expect(errs.rate).toBeDefined();
    expect(errs.period).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("projectionToCSV", () => {
  it("header contains required column names", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    const csv = projectionToCSV(r.projection);
    expect(csv).toContain("Year");
    expect(csv).toContain("Opening Value");
    expect(csv).toContain("Growth");
    expect(csv).toContain("Closing Value");
  });

  it("row count equals projection length + 1 (header)", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(r.projection.length + 1);
  });

  it("first data row starts with '1,'", () => {
    const r = calculateLumpsum({ initialInvestment: 100000, annualRate: 12, months: 120 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n");
    expect(lines[1].startsWith("1,")).toBe(true);
  });
});

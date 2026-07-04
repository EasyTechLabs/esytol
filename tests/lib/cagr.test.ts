import { describe, it, expect } from "vitest";
import { calculateCAGR, validateCAGRInputs, projectionToCSV } from "@/lib/cagr";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

// Independent reference for CAGR (fraction, not percent).
function refCAGR(B: number, E: number, months: number): number {
  return Math.pow(E / B, 1 / (months / 12)) - 1;
}

// ── Deterministic financial validation ────────────────────────────────────────

describe("calculateCAGR — known scenarios", () => {
  it("₹1,00,000 → ₹2,00,000 over 5 years → CAGR ≈ 14.87%", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    // (2)^(1/5) − 1 = 0.148698
    expect(r.summary.cagrPct).toBeCloseTo(14.87, 2);
  });

  it("doubling over 5 years gives investment multiple 2.00×", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    expect(r.summary.investmentMultiple).toBe(2);
  });

  it("absolute return for a doubling is 100%", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    expect(r.summary.absoluteReturnPct).toBe(100);
  });

  it("total profit = ending − beginning", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    expect(r.summary.totalProfitLoss).toBe(100000);
  });

  it("annualized growth = total profit / years", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    // 100000 / 5 = 20000
    expect(r.summary.annualizedGrowth).toBe(20000);
  });

  it("zero growth: CAGR 0%, multiple 1.00×, profit 0", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 100000, months: 36 });
    expect(r.summary.cagrPct).toBe(0);
    expect(r.summary.absoluteReturnPct).toBe(0);
    expect(r.summary.investmentMultiple).toBe(1);
    expect(r.summary.totalProfitLoss).toBe(0);
  });

  it("negative return: 100000 → 50000 over 2 years → CAGR ≈ −29.29%", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 50000, months: 24 });
    // (0.5)^(1/2) − 1 = −0.292893
    expect(r.summary.cagrPct).toBeCloseTo(-29.29, 2);
    expect(r.summary.absoluteReturnPct).toBe(-50);
    expect(r.summary.totalProfitLoss).toBe(-50000);
  });

  it("total loss: ending 0 → CAGR = −100%, multiple 0×", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 0, months: 36 });
    expect(r.summary.cagrPct).toBe(-100);
    expect(r.summary.investmentMultiple).toBe(0);
    expect(r.summary.totalProfitLoss).toBe(-100000);
  });

  it("triple over 3 years → CAGR ≈ 44.22%", () => {
    const r = calculateCAGR({ beginningValue: 10000, endingValue: 30000, months: 36 });
    // (3)^(1/3) − 1 = 0.442250
    expect(r.summary.cagrPct).toBeCloseTo(44.22, 2);
  });

  it("month input: 18 months = 1.5 years is honoured", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 150000, months: 18 });
    // (1.5)^(1/1.5) − 1 = 0.310371
    expect(r.summary.cagrPct).toBeCloseTo(31.04, 2);
    expect(r.summary.years).toBe(1.5);
  });

  it("1-year period: CAGR equals absolute return", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 112000, months: 12 });
    expect(r.summary.cagrPct).toBeCloseTo(r.summary.absoluteReturnPct, 2);
    expect(r.summary.cagrPct).toBeCloseTo(12, 2);
  });

  it("CAGR matches independent reference", () => {
    const r = calculateCAGR({ beginningValue: 73500, endingValue: 219000, months: 84 });
    expect(r.summary.cagrPct).toBeCloseTo(refCAGR(73500, 219000, 84) * 100, 2);
  });
});

// ── Projection ────────────────────────────────────────────────────────────────

describe("calculateCAGR — yearly projection", () => {
  it("integer years: one row per year, last row equals ending value", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    expect(r.projection.length).toBe(5);
    expect(r.projection[4].projectedValue).toBeCloseTo(200000, 2);
  });

  it("year numbers are sequential for full years", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    r.projection.forEach((row, idx) => expect(row.year).toBe(idx + 1));
  });

  it("fractional period: appends a final partial-year row ending at the ending value", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 150000, months: 18 });
    // 1 full year + a 1.5 final row
    expect(r.projection.length).toBe(2);
    expect(r.projection[1].year).toBe(1.5);
    expect(r.projection[1].projectedValue).toBeCloseTo(150000, 2);
  });

  it("sub-year period (6 months): single final row equal to ending value", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 120000, months: 6 });
    expect(r.projection.length).toBe(1);
    expect(r.projection[0].projectedValue).toBeCloseTo(120000, 2);
  });

  it("each full-year row grows at the CAGR rate", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    // growthPct of each full year should equal the CAGR%
    r.projection.slice(0, 5).forEach((row) => {
      expect(row.growthPct).toBeCloseTo(r.summary.cagrPct, 1);
    });
  });

  it("projected values increase for positive CAGR", () => {
    const r = calculateCAGR({ beginningValue: 50000, endingValue: 250000, months: 120 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].projectedValue).toBeGreaterThan(r.projection[k - 1].projectedValue);
    }
  });

  it("projected values decrease for negative CAGR", () => {
    const r = calculateCAGR({ beginningValue: 200000, endingValue: 50000, months: 120 });
    for (let k = 1; k < r.projection.length; k++) {
      expect(r.projection[k].projectedValue).toBeLessThan(r.projection[k - 1].projectedValue);
    }
  });
});

// ── Row identity ──────────────────────────────────────────────────────────────

describe("calculateCAGR — projection identity: prev + growth = current", () => {
  it("holds for positive growth", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 260000, months: 96 });
    let prev = 100000;
    r.projection.forEach((row) => {
      expect(prev + row.growth).toBe(row.projectedValue);
      prev = row.projectedValue;
    });
  });

  it("holds for negative growth", () => {
    const r = calculateCAGR({ beginningValue: 300000, endingValue: 120000, months: 72 });
    let prev = 300000;
    r.projection.forEach((row) => {
      expect(prev + row.growth).toBe(row.projectedValue);
      prev = row.projectedValue;
    });
  });
});

// ── Randomized property tests — 1000+ scenarios ───────────────────────────────

describe("calculateCAGR — 600 randomized positive-growth scenarios (seed 0xca9a01)", () => {
  it("CAGR matches reference and projection terminates at ending value", () => {
    const rng = lcg(0xca9a01);
    let failCount = 0;

    for (let s = 0; s < 600; s++) {
      const B = Math.round(rng(1_000_000, 1000) * 100) / 100;
      const E = Math.round(rng(10_000_000, B) * 100) / 100; // ending ≥ beginning
      const months = Math.ceil(rng(600, 1));

      const r = calculateCAGR({ beginningValue: B, endingValue: E, months });
      const { summary, projection } = r;

      // CAGR matches independent reference
      const ref = refCAGR(B, E, months) * 100;
      if (Math.abs(summary.cagrPct - ref) > 0.01) failCount++;

      // multiple, absolute, profit
      if (summary.investmentMultiple !== Math.round((E / B) * 100) / 100) failCount++;
      if (summary.totalProfitLoss !== Math.round((E - B) * 100) / 100) failCount++;

      // last projection row ≈ ending value
      const last = projection[projection.length - 1];
      if (Math.abs(last.projectedValue - E) > Math.max(0.02, E * 1e-9)) failCount++;

      // row identity: prev + growth = projectedValue.
      // Exact under Sterbenz (consecutive values within a 2× ratio); at extreme
      // CAGRs consecutive values can differ by >2×, so the derived-difference
      // reconstruction carries sub-ULP IEEE error. Use a relative tolerance,
      // matching the FP pattern used by the SIP/FD/RD/PPF engines.
      let prev = Math.round(B * 100) / 100;
      for (const row of projection) {
        const diff = Math.abs(prev + row.growth - row.projectedValue);
        if (diff > Math.max(1e-9, Math.abs(row.projectedValue) * 1e-10)) failCount++;
        prev = row.projectedValue;
      }

      // positive growth ⇒ non-negative CAGR
      if (E >= B && summary.cagrPct < -0.01) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateCAGR — 300 randomized negative-growth scenarios (seed 0x105e33)", () => {
  it("negative CAGR is real and projection declines to ending value", () => {
    const rng = lcg(0x105e33);
    let failCount = 0;

    for (let s = 0; s < 300; s++) {
      const B = Math.round(rng(10_000_000, 1000));
      const E = Math.round(rng(B, 1)); // ending < beginning (but > 0)
      const months = Math.ceil(rng(600, 1));

      const r = calculateCAGR({ beginningValue: B, endingValue: E, months });
      const { summary, projection } = r;

      const ref = refCAGR(B, E, months) * 100;
      if (Math.abs(summary.cagrPct - ref) > 0.01) failCount++;

      if (!isFinite(summary.cagrPct)) failCount++;
      if (E < B && summary.cagrPct > 0.01) failCount++;

      const last = projection[projection.length - 1];
      if (Math.abs(last.projectedValue - E) > Math.max(0.02, E * 1e-9)) failCount++;
    }

    expect(failCount).toBe(0);
  });
});

describe("calculateCAGR — 200 randomized fractional-period scenarios (seed 0xf7ac10)", () => {
  it("last row equals ending value regardless of fractional years", () => {
    const rng = lcg(0xf7ac10);
    let failCount = 0;

    for (let s = 0; s < 200; s++) {
      const B = Math.round(rng(500000, 1000));
      const E = Math.round(rng(2_000_000, 1));
      const months = Math.ceil(rng(59, 1)); // < 5 years, often fractional in years

      const r = calculateCAGR({ beginningValue: B, endingValue: E, months });
      const last = r.projection[r.projection.length - 1];
      if (Math.abs(last.projectedValue - E) > Math.max(0.02, E * 1e-9)) failCount++;

      // year of last row equals total years when fractional
      const years = months / 12;
      if (!Number.isInteger(years)) {
        if (Math.abs(last.year - Math.round(years * 100) / 100) > 1e-9) failCount++;
      }
    }

    expect(failCount).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateCAGRInputs", () => {
  it("returns no errors for valid inputs", () => {
    expect(validateCAGRInputs(100000, 200000, 60)).toEqual({});
  });

  it("errors on zero beginning value", () => {
    expect(validateCAGRInputs(0, 200000, 60).beginning).toBeDefined();
  });

  it("errors on negative beginning value", () => {
    expect(validateCAGRInputs(-100, 200000, 60).beginning).toBeDefined();
  });

  it("errors on NaN beginning value", () => {
    expect(validateCAGRInputs(NaN, 200000, 60).beginning).toBeDefined();
  });

  it("errors on beginning above ₹100 crore", () => {
    expect(validateCAGRInputs(1_000_000_001, 200000, 60).beginning).toBeDefined();
  });

  it("allows ending value of 0 (total loss)", () => {
    expect(validateCAGRInputs(100000, 0, 60).ending).toBeUndefined();
  });

  it("errors on negative ending value", () => {
    expect(validateCAGRInputs(100000, -1, 60).ending).toBeDefined();
  });

  it("errors on NaN ending value", () => {
    expect(validateCAGRInputs(100000, NaN, 60).ending).toBeDefined();
  });

  it("errors on ending above ₹100 crore", () => {
    expect(validateCAGRInputs(100000, 1_000_000_001, 60).ending).toBeDefined();
  });

  it("errors on months = 0", () => {
    expect(validateCAGRInputs(100000, 200000, 0).period).toBeDefined();
  });

  it("errors on months > 600", () => {
    expect(validateCAGRInputs(100000, 200000, 601).period).toBeDefined();
  });

  it("allows months = 1", () => {
    expect(validateCAGRInputs(100000, 200000, 1).period).toBeUndefined();
  });

  it("allows months = 600", () => {
    expect(validateCAGRInputs(100000, 200000, 600).period).toBeUndefined();
  });

  it("returns multiple errors simultaneously", () => {
    const errs = validateCAGRInputs(0, -1, 0);
    expect(errs.beginning).toBeDefined();
    expect(errs.ending).toBeDefined();
    expect(errs.period).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("projectionToCSV", () => {
  it("header contains required column names", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    const csv = projectionToCSV(r.projection);
    expect(csv).toContain("Year");
    expect(csv).toContain("Projected Value");
    expect(csv).toContain("Growth");
    expect(csv).toContain("Growth %");
  });

  it("row count equals projection length + 1 (header)", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines.length).toBe(r.projection.length + 1);
  });

  it("first data row starts with '1,'", () => {
    const r = calculateCAGR({ beginningValue: 100000, endingValue: 200000, months: 60 });
    const csv = projectionToCSV(r.projection);
    const lines = csv.split("\n");
    expect(lines[1].startsWith("1,")).toBe(true);
  });
});

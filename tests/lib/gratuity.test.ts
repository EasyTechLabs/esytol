import { describe, it, expect } from "vitest";
import {
  calculateGratuity,
  gratuityAtService,
  validateGratuityInputs,
  resultToCSV,
  GRATUITY_CAP,
  type GratuityInput,
} from "@/lib/gratuity";

// ── Deterministic LCG RNG ──────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

const make = (extra: Partial<GratuityInput> = {}): GratuityInput => ({
  monthlyBasic: 50000,
  years: 10,
  months: 0,
  coveredUnderAct: true,
  ...extra,
});

// ── Known-value financial validation ───────────────────────────────────────────

describe("calculateGratuity — covered under the Act (÷26)", () => {
  it("₹50,000 · 10y 7m → 11 years → ₹3,17,308", () => {
    const r = calculateGratuity(make({ years: 10, months: 7 }));
    expect(r.divisor).toBe(26);
    expect(r.eligibleYears).toBe(11); // months > 6 rounds up
    expect(r.gratuityAmount).toBe(317308); // 15 × 50000 × 11 / 26
  });

  it("5y 6m does NOT round up (stays 5 years)", () => {
    const r = calculateGratuity(make({ monthlyBasic: 30000, years: 5, months: 6 }));
    expect(r.eligibleYears).toBe(5);
    expect(r.gratuityAmount).toBe(86538); // 15 × 30000 × 5 / 26
  });

  it("5y 7m rounds up to 6 years", () => {
    const r = calculateGratuity(make({ monthlyBasic: 30000, years: 5, months: 7 }));
    expect(r.eligibleYears).toBe(6);
    expect(r.gratuityAmount).toBe(103846); // 15 × 30000 × 6 / 26
  });
});

describe("calculateGratuity — not covered (÷30, whole years only)", () => {
  it("₹50,000 · 10y 7m → 10 years → ₹2,50,000", () => {
    const r = calculateGratuity(make({ years: 10, months: 7, coveredUnderAct: false }));
    expect(r.divisor).toBe(30);
    expect(r.eligibleYears).toBe(10); // trailing months ignored
    expect(r.gratuityAmount).toBe(250000); // 15 × 50000 × 10 / 30
  });

  it("trailing months never change a not-covered result", () => {
    const a = calculateGratuity(make({ years: 8, months: 0, coveredUnderAct: false }));
    const b = calculateGratuity(make({ years: 8, months: 11, coveredUnderAct: false }));
    expect(a.gratuityAmount).toBe(b.gratuityAmount);
  });
});

describe("calculateGratuity — eligibility & cap", () => {
  it("under 5 years → not eligible → gratuity is 0", () => {
    const r = calculateGratuity(make({ years: 4, months: 11 }));
    expect(r.isEligible).toBe(false);
    expect(r.gratuityAmount).toBe(0);
  });

  it("exactly 5 years → eligible", () => {
    const r = calculateGratuity(make({ years: 5, months: 0 }));
    expect(r.isEligible).toBe(true);
    expect(r.gratuityAmount).toBeGreaterThan(0);
  });

  it("caps at ₹20 lakh", () => {
    const r = calculateGratuity(make({ monthlyBasic: 200000, years: 40 }));
    expect(r.formulaGratuity).toBeGreaterThan(GRATUITY_CAP);
    expect(r.gratuityAmount).toBe(GRATUITY_CAP);
  });

  it("amount up to the cap is tax-exempt with no taxable portion", () => {
    const r = calculateGratuity(make({ years: 12 }));
    expect(r.taxExemptAmount).toBe(r.gratuityAmount);
    expect(r.taxableAmount).toBe(0);
  });

  it("echoes the last drawn salary", () => {
    const r = calculateGratuity(make({ monthlyBasic: 45000 }));
    expect(r.lastDrawnSalary).toBe(45000);
  });
});

describe("gratuityAtService — projection helper", () => {
  it("is non-decreasing in years and never exceeds the cap", () => {
    let prev = -1;
    for (let y = 0; y <= 45; y++) {
      const g = gratuityAtService(80000, y, true);
      expect(g).toBeGreaterThanOrEqual(prev);
      expect(g).toBeLessThanOrEqual(GRATUITY_CAP);
      prev = g;
    }
  });

  it("covered pays more than not-covered for the same inputs (÷26 vs ÷30)", () => {
    expect(gratuityAtService(50000, 20, true)).toBeGreaterThan(gratuityAtService(50000, 20, false));
  });
});

// ── Randomized property tests ───────────────────────────────────────────────────

describe("calculateGratuity — 1000 randomized scenarios (seed 0x9a7)", () => {
  it("invariants hold", () => {
    const rng = lcg(0x9a7);
    let fail = 0;
    for (let i = 0; i < 1000; i++) {
      const input: GratuityInput = {
        monthlyBasic: Math.round(rng(500_000, 1000)),
        years: Math.floor(rng(45, 0)),
        months: Math.floor(rng(12, 0)),
        coveredUnderAct: rng(1) > 0.5,
      };
      const r = calculateGratuity(input);

      // bounds
      if (r.gratuityAmount < 0) fail++;
      if (r.gratuityAmount > GRATUITY_CAP) fail++;

      // eligibility gate
      if (!r.isEligible && r.gratuityAmount !== 0) fail++;

      // divisor by coverage
      if (r.divisor !== (input.coveredUnderAct ? 26 : 30)) fail++;

      // formula-years rounding rule
      const yrs = Math.floor(input.years);
      const mons = Math.min(11, Math.max(0, Math.floor(input.months)));
      const expectedFormulaYears = input.coveredUnderAct ? yrs + (mons > 6 ? 1 : 0) : yrs;
      if (r.eligibleYears !== expectedFormulaYears) fail++;

      // eligible payable = min(formula, cap)
      if (r.isEligible) {
        const expected = Math.min(r.formulaGratuity, GRATUITY_CAP);
        if (Math.abs(r.gratuityAmount - expected) > 1) fail++;
      }

      // exemption identity
      if (r.taxExemptAmount !== Math.min(r.gratuityAmount, GRATUITY_CAP)) fail++;
      if (r.taxableAmount !== Math.max(0, r.gratuityAmount - GRATUITY_CAP)) fail++;
    }
    expect(fail).toBe(0);
  });
});

// ── Validation ──────────────────────────────────────────────────────────────────

describe("validateGratuityInputs", () => {
  const ok = { monthlyBasic: 50000, years: 10, months: 0 };

  it("valid inputs → no errors", () => {
    expect(validateGratuityInputs(ok)).toEqual({});
  });
  it("zero salary → error", () => {
    expect(validateGratuityInputs({ ...ok, monthlyBasic: 0 }).monthlyBasic).toBeDefined();
  });
  it("negative salary → error", () => {
    expect(validateGratuityInputs({ ...ok, monthlyBasic: -1 }).monthlyBasic).toBeDefined();
  });
  it("negative years → error", () => {
    expect(validateGratuityInputs({ ...ok, years: -1 }).years).toBeDefined();
  });
  it("months out of range → error", () => {
    expect(validateGratuityInputs({ ...ok, months: 12 }).months).toBeDefined();
    expect(validateGratuityInputs({ ...ok, months: -1 }).months).toBeDefined();
  });
});

// ── CSV ──────────────────────────────────────────────────────────────────────────

describe("resultToCSV", () => {
  it("includes the key rows", () => {
    const input = make({ years: 12, months: 8 });
    const csv = resultToCSV(input, calculateGratuity(input));
    expect(csv).toContain("Last Drawn Salary");
    expect(csv).toContain("Covered under Gratuity Act");
    expect(csv).toContain("Gratuity Amount Payable");
    expect(csv).toContain("Tax-Exempt Amount");
    expect(csv.split("\n").length).toBeGreaterThan(10);
  });
});

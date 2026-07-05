import { describe, it, expect } from "vitest";
import {
  calculateIncomeTax,
  validateIncomeTaxInputs,
  resultToCSV,
  STANDARD_DEDUCTION,
  type IncomeTaxInput,
} from "@/lib/incomeTax";

// ── LCG deterministic RNG ─────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

const base: IncomeTaxInput = {
  annualSalary: 0,
  otherIncome: 0,
  section80C: 0,
  section80D: 0,
  hraExemption: 0,
  homeLoanInterest: 0,
  professionalTax: 0,
  otherDeductions: 0,
};

const withSalary = (annualSalary: number, extra: Partial<IncomeTaxInput> = {}): IncomeTaxInput => ({
  ...base,
  annualSalary,
  ...extra,
});

// ── Known-value financial validation ──────────────────────────────────────────

describe("calculateIncomeTax — New Regime FY 2025-26", () => {
  it("₹12,75,000 salary → NIL tax (₹75k std + ₹12L rebate)", () => {
    const r = calculateIncomeTax(withSalary(1275000));
    expect(r.new.taxableIncome).toBe(1200000);
    expect(r.new.totalTax).toBe(0);
  });

  it("₹12,00,000 taxable exactly → NIL (rebate)", () => {
    const r = calculateIncomeTax(withSalary(1275000));
    expect(r.new.taxBeforeRebate).toBe(60000);
    expect(r.new.rebate).toBe(60000);
    expect(r.new.taxAfterRebate).toBe(0);
  });

  it("₹13,00,000 salary → ₹26,000 (marginal relief just above ₹12L)", () => {
    const r = calculateIncomeTax(withSalary(1300000));
    expect(r.new.taxableIncome).toBe(1225000);
    expect(r.new.totalTax).toBe(26000);
  });

  it("₹20,00,000 salary → ₹1,92,400", () => {
    const r = calculateIncomeTax(withSalary(2000000));
    // taxable 1,925,000: 20k+40k+60k+65k = 185k + 4% cess
    expect(r.new.taxableIncome).toBe(1925000);
    expect(r.new.totalTax).toBe(192400);
  });

  it("standard deduction is ₹75,000", () => {
    const r = calculateIncomeTax(withSalary(1000000));
    expect(r.new.standardDeduction).toBe(STANDARD_DEDUCTION.new);
    expect(r.new.taxableIncome).toBe(925000);
  });

  it("new regime ignores 80C / 80D / HRA deductions", () => {
    const a = calculateIncomeTax(withSalary(1500000));
    const b = calculateIncomeTax(
      withSalary(1500000, { section80C: 150000, section80D: 50000, hraExemption: 100000 })
    );
    expect(a.new.totalTax).toBe(b.new.totalTax); // deductions don't change the new-regime tax
  });
});

describe("calculateIncomeTax — Old Regime", () => {
  it("₹10,00,000 salary + 80C ₹1.5L + 80D ₹25k → ₹70,200", () => {
    const r = calculateIncomeTax(withSalary(1000000, { section80C: 150000, section80D: 25000 }));
    expect(r.old.taxableIncome).toBe(775000);
    expect(r.old.totalTax).toBe(70200);
  });

  it("₹5,00,000 taxable → NIL (87A rebate)", () => {
    const r = calculateIncomeTax(withSalary(550000)); // 550000 - 50000 std = 500000
    expect(r.old.taxableIncome).toBe(500000);
    expect(r.old.totalTax).toBe(0);
  });

  it("just above ₹5L taxable → tax applies (rebate cliff)", () => {
    const r = calculateIncomeTax(withSalary(560000)); // 510000 taxable
    expect(r.old.taxableIncome).toBe(510000);
    expect(r.old.totalTax).toBeGreaterThan(0);
  });

  it("standard deduction is ₹50,000", () => {
    const r = calculateIncomeTax(withSalary(1000000));
    expect(r.old.standardDeduction).toBe(STANDARD_DEDUCTION.old);
  });

  it("caps 80C at ₹1,50,000 and home-loan interest at ₹2,00,000", () => {
    const capped = calculateIncomeTax(
      withSalary(2000000, { section80C: 500000, homeLoanInterest: 500000 })
    );
    const atCap = calculateIncomeTax(
      withSalary(2000000, { section80C: 150000, homeLoanInterest: 200000 })
    );
    expect(capped.old.totalTax).toBe(atCap.old.totalTax);
  });
});

describe("calculateIncomeTax — surcharge & cess", () => {
  it("adds 4% Health & Education Cess", () => {
    const r = calculateIncomeTax(withSalary(2000000));
    const s = r.new;
    expect(s.cess).toBe(Math.round((s.taxAfterRebate + s.surcharge) * 0.04));
  });

  it("applies surcharge above ₹50L taxable", () => {
    const r = calculateIncomeTax(withSalary(8000000)); // taxable 7,925,000 > 50L
    expect(r.new.surcharge).toBeGreaterThan(0);
  });

  it("no surcharge below ₹50L taxable", () => {
    const r = calculateIncomeTax(withSalary(4000000));
    expect(r.new.surcharge).toBe(0);
  });

  it("surcharge marginal relief just above ₹50L keeps total tax reasonable", () => {
    const at50L = calculateIncomeTax(withSalary(5075000)); // taxable 5,000,000
    const just = calculateIncomeTax(withSalary(5085000)); // taxable 5,010,000
    // ₹10,000 more income must not raise tax by more than a few thousand (relief)
    expect(just.new.totalTax - at50L.new.totalTax).toBeLessThan(15000);
  });
});

describe("calculateIncomeTax — comparison & structure", () => {
  it("recommends the cheaper regime and reports the saving", () => {
    const r = calculateIncomeTax(withSalary(1500000));
    const cheaper = r.new.totalTax <= r.old.totalTax ? "new" : "old";
    expect(r.recommended).toBe(cheaper);
    expect(r.taxSaved).toBe(Math.abs(r.old.totalTax - r.new.totalTax));
  });

  it("zero income → zero tax, both regimes", () => {
    const r = calculateIncomeTax(withSalary(0));
    expect(r.old.totalTax).toBe(0);
    expect(r.new.totalTax).toBe(0);
  });

  it("effective rate = totalTax / gross × 100", () => {
    const r = calculateIncomeTax(withSalary(2500000));
    expect(r.new.effectiveRate).toBe(Math.round((r.new.totalTax / 2500000) * 100 * 100) / 100);
  });
});

// ── Randomized property tests ──────────────────────────────────────────────────

describe("calculateIncomeTax — 1000 randomized scenarios (seed 0x1ac0me)", () => {
  it("invariants hold across regimes", () => {
    const rng = lcg(0x1ac0);
    let fail = 0;
    for (let i = 0; i < 1000; i++) {
      const input = withSalary(Math.round(rng(60_000_000, 0)), {
        otherIncome: Math.round(rng(1_000_000, 0)),
        section80C: Math.round(rng(300000, 0)),
        section80D: Math.round(rng(120000, 0)),
        hraExemption: Math.round(rng(400000, 0)),
        homeLoanInterest: Math.round(rng(300000, 0)),
        professionalTax: 2500,
        otherDeductions: Math.round(rng(200000, 0)),
      });
      const r = calculateIncomeTax(input);
      for (const s of [r.old, r.new]) {
        if (s.totalTax < 0) fail++;
        if (s.taxableIncome < 0) fail++;
        // cess = 4% of (taxAfterRebate + surcharge)
        if (Math.abs(s.cess - Math.round((s.taxAfterRebate + s.surcharge) * 0.04)) > 1) fail++;
        // total = tax + surcharge + cess (rounded)
        if (Math.abs(s.totalTax - Math.round(s.taxAfterRebate + s.surcharge + s.cess)) > 1) fail++;
        if (s.effectiveRate < 0 || s.effectiveRate > 60) fail++;
      }
      // rebate thresholds
      if (r.new.taxableIncome <= 1200000 && r.new.totalTax !== 0) fail++;
      if (r.old.taxableIncome <= 500000 && r.old.totalTax !== 0) fail++;
      // recommended is the cheaper regime
      const cheaper = r.new.totalTax <= r.old.totalTax ? "new" : "old";
      if (r.recommended !== cheaper) fail++;
    }
    expect(fail).toBe(0);
  });

  it("total tax is non-decreasing in income (same regime, no deductions)", () => {
    let prevOld = -1;
    let prevNew = -1;
    for (let salary = 0; salary <= 30_000_000; salary += 250_000) {
      const r = calculateIncomeTax(withSalary(salary));
      expect(r.old.totalTax).toBeGreaterThanOrEqual(prevOld);
      expect(r.new.totalTax).toBeGreaterThanOrEqual(prevNew);
      prevOld = r.old.totalTax;
      prevNew = r.new.totalTax;
    }
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateIncomeTaxInputs", () => {
  it("valid inputs → no errors", () => {
    expect(validateIncomeTaxInputs(1200000, 0, 175000)).toEqual({});
  });
  it("negative salary → error", () => {
    expect(validateIncomeTaxInputs(-1, 0, 0).salary).toBeDefined();
  });
  it("zero total income → error", () => {
    expect(validateIncomeTaxInputs(0, 0, 0).salary).toBeDefined();
  });
  it("negative other income → error", () => {
    expect(validateIncomeTaxInputs(500000, -1, 0).otherIncome).toBeDefined();
  });
  it("negative deductions → error", () => {
    expect(validateIncomeTaxInputs(500000, 0, -1).deductions).toBeDefined();
  });
});

// ── CSV ─────────────────────────────────────────────────────────────────────

describe("resultToCSV", () => {
  it("includes both regimes and key rows", () => {
    const csv = resultToCSV(calculateIncomeTax(withSalary(1500000)));
    expect(csv).toContain("Old Regime");
    expect(csv).toContain("New Regime");
    expect(csv).toContain("Total Tax");
    expect(csv).toContain("Taxable Income");
    expect(csv.split("\n").length).toBeGreaterThan(10);
  });
});

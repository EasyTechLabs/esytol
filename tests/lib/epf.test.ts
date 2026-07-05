import { describe, it, expect } from "vitest";
import {
  calculateEPF,
  validateEPFInputs,
  resultToCSV,
  EPS_WAGE_CEILING,
  type EPFInput,
} from "@/lib/epf";

// ── Deterministic LCG RNG ──────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

const make = (extra: Partial<EPFInput> = {}): EPFInput => ({
  monthlyWages: 15000,
  currentAge: 30,
  retirementAge: 58,
  currentBalance: 0,
  annualIncrement: 0,
  interestRate: 8.25,
  ...extra,
});

// ── Known-value financial validation ───────────────────────────────────────────

describe("calculateEPF — contribution split", () => {
  it("employee is 12% of wages; EPS is 8.33% capped at the ₹15,000 ceiling", () => {
    const r = calculateEPF(make({ monthlyWages: 15000 }));
    expect(r.monthlyEmployee).toBe(1800); // 12% of 15000
    expect(r.monthlyEPS).toBe(1250); // 8.33% of 15000 ≈ 1250
    expect(r.monthlyEmployerEPF).toBe(551); // 12% - EPS = 1800 - 1249.5
    expect(r.monthlyTotalToEPF).toBe(r.monthlyEmployee + r.monthlyEmployerEPF);
  });

  it("below the ceiling, EPS is 8.33% and employer EPF is ~3.67% of wages", () => {
    const r = calculateEPF(make({ monthlyWages: 10000 }));
    expect(r.monthlyEmployee).toBe(1200);
    expect(r.monthlyEPS).toBe(833); // 8.33% of 10000
    expect(r.monthlyEmployerEPF).toBe(367); // 1200 - 833
  });

  it("EPS stays capped at ₹1,250 for high wages", () => {
    const r = calculateEPF(make({ monthlyWages: 80000 }));
    expect(r.monthlyEPS).toBe(1250);
    expect(r.monthlyEmployee).toBe(9600); // 12% of 80000
    // employer EPF = 12% of 80000 − 8.33% of 15000 = 9600 − 1249.5 = 8350.5 → 8351
    expect(r.monthlyEmployerEPF).toBe(8351);
  });

  it("EPS is computed on min(wages, ceiling)", () => {
    const below = calculateEPF(make({ monthlyWages: EPS_WAGE_CEILING - 5000 }));
    const above = calculateEPF(make({ monthlyWages: EPS_WAGE_CEILING + 5000 }));
    expect(below.monthlyEPS).toBeLessThan(1250);
    expect(above.monthlyEPS).toBe(1250);
  });
});

describe("calculateEPF — projection", () => {
  it("years equals retirement age minus current age", () => {
    expect(calculateEPF(make({ currentAge: 30, retirementAge: 58 })).years).toBe(28);
    expect(calculateEPF(make({ currentAge: 25, retirementAge: 60 })).years).toBe(35);
  });

  it("year-wise rows match the number of years and end at the retirement age", () => {
    const r = calculateEPF(make({ currentAge: 40, retirementAge: 58 }));
    expect(r.yearWise).toHaveLength(18);
    expect(r.yearWise[r.yearWise.length - 1].age).toBe(58);
  });

  it("closing balance is non-decreasing across years", () => {
    const r = calculateEPF(make({ monthlyWages: 25000, annualIncrement: 5 }));
    for (let i = 1; i < r.yearWise.length; i++) {
      expect(r.yearWise[i].closingBalance).toBeGreaterThanOrEqual(r.yearWise[i - 1].closingBalance);
    }
  });

  it("accounting identity: maturity = initial + contributions + interest", () => {
    const input = make({ monthlyWages: 50000, currentBalance: 200000, annualIncrement: 6 });
    const r = calculateEPF(input);
    expect(
      Math.abs(r.maturityBalance - (input.currentBalance + r.totalContribution + r.totalInterest))
    ).toBeLessThanOrEqual(1);
  });

  it("total contribution = employee + employer EPF (EPS excluded from the corpus)", () => {
    const r = calculateEPF(make({ monthlyWages: 30000 }));
    expect(r.totalContribution).toBe(r.totalEmployeeContribution + r.totalEmployerContribution);
    expect(r.totalEPS).toBeGreaterThan(0); // EPS tracked separately as pension
  });

  it("zero interest rate → no interest, maturity equals contributions plus opening balance", () => {
    const input = make({ interestRate: 0, currentBalance: 50000 });
    const r = calculateEPF(input);
    expect(r.totalInterest).toBe(0);
    expect(r.maturityBalance).toBe(input.currentBalance + r.totalContribution);
  });

  it("a higher interest rate produces a larger maturity balance", () => {
    const low = calculateEPF(make({ interestRate: 7 }));
    const high = calculateEPF(make({ interestRate: 9 }));
    expect(high.maturityBalance).toBeGreaterThan(low.maturityBalance);
  });

  it("a salary increment increases contributions and maturity", () => {
    const flat = calculateEPF(make({ monthlyWages: 30000, annualIncrement: 0 }));
    const rising = calculateEPF(make({ monthlyWages: 30000, annualIncrement: 8 }));
    expect(rising.totalContribution).toBeGreaterThan(flat.totalContribution);
    expect(rising.maturityBalance).toBeGreaterThan(flat.maturityBalance);
  });
});

// ── Randomized property tests ───────────────────────────────────────────────────

describe("calculateEPF — 1000 randomized scenarios (seed 0xe9f)", () => {
  it("invariants hold", () => {
    const rng = lcg(0xe9f);
    let fail = 0;
    for (let i = 0; i < 1000; i++) {
      const currentAge = Math.floor(rng(50, 18));
      const input: EPFInput = {
        monthlyWages: Math.round(rng(500_000, 1000)),
        currentAge,
        retirementAge: currentAge + Math.floor(rng(40, 1)),
        currentBalance: Math.round(rng(1_000_000, 0)),
        annualIncrement: rng(15, 0),
        interestRate: rng(12, 0),
      };
      const r = calculateEPF(input);

      // interest is non-negative → maturity ≥ contributions + opening
      if (r.totalInterest < 0) fail++;
      if (r.maturityBalance < input.currentBalance + r.totalContribution - 1) fail++;

      // accounting identity
      if (
        Math.abs(
          r.maturityBalance - (input.currentBalance + r.totalContribution + r.totalInterest)
        ) > 2
      )
        fail++;

      // employee = 12% of first-year wages
      if (Math.abs(r.monthlyEmployee - Math.round(0.12 * input.monthlyWages)) > 1) fail++;

      // EPS never exceeds the ₹1,250 cap
      if (r.monthlyEPS > 1251) fail++;
      if (r.monthlyEmployerEPF < 0) fail++;

      // year rows match years, closing non-decreasing
      if (r.yearWise.length !== r.years) fail++;
      for (let k = 1; k < r.yearWise.length; k++) {
        if (r.yearWise[k].closingBalance < r.yearWise[k - 1].closingBalance) fail++;
      }
    }
    expect(fail).toBe(0);
  });
});

// ── Validation ──────────────────────────────────────────────────────────────────

describe("validateEPFInputs", () => {
  const ok: EPFInput = make();

  it("valid inputs → no errors", () => {
    expect(validateEPFInputs(ok)).toEqual({});
  });
  it("zero wages → error", () => {
    expect(validateEPFInputs({ ...ok, monthlyWages: 0 }).monthlyWages).toBeDefined();
  });
  it("negative wages → error", () => {
    expect(validateEPFInputs({ ...ok, monthlyWages: -1 }).monthlyWages).toBeDefined();
  });
  it("retirement age not greater than current age → error", () => {
    expect(
      validateEPFInputs({ ...ok, currentAge: 58, retirementAge: 58 }).retirementAge
    ).toBeDefined();
  });
  it("current age below 15 → error", () => {
    expect(validateEPFInputs({ ...ok, currentAge: 10 }).currentAge).toBeDefined();
  });
  it("negative balance → error", () => {
    expect(validateEPFInputs({ ...ok, currentBalance: -1 }).currentBalance).toBeDefined();
  });
  it("interest rate too high → error", () => {
    expect(validateEPFInputs({ ...ok, interestRate: 25 }).interestRate).toBeDefined();
  });
});

// ── CSV ──────────────────────────────────────────────────────────────────────────

describe("resultToCSV", () => {
  it("includes a header, year rows, and the summary", () => {
    const csv = resultToCSV(calculateEPF(make()));
    expect(csv).toContain("Closing Balance");
    expect(csv).toContain("Maturity Balance");
    expect(csv).toContain("Total Interest Earned");
    expect(csv).toContain("Total EPS (pension) Contribution");
    expect(csv.split("\n").length).toBeGreaterThan(28);
  });
});

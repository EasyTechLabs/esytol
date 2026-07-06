import { describe, it, expect } from "vitest";
import {
  calculateNPS,
  validateNPSInputs,
  resultToCSV,
  NPS_MAX_LUMPSUM_PCT,
  type NPSInput,
} from "@/lib/nps";

// ── Deterministic LCG RNG ──────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

const make = (extra: Partial<NPSInput> = {}): NPSInput => ({
  currentAge: 30,
  retirementAge: 60,
  monthlyContribution: 5000,
  expectedReturn: 10,
  annuityReturn: 6,
  lumpSumPct: 60,
  ...extra,
});

// ── Known-value financial validation ───────────────────────────────────────────

describe("calculateNPS — accumulation & split", () => {
  it("matches the annuity-due future value for 30 years at 10%", () => {
    const r = calculateNPS(make());
    expect(r.months).toBe(360);
    expect(r.years).toBe(30);
    expect(r.totalContributions).toBe(1_800_000); // 5000 × 360
    // closed-form ≈ ₹1.1397 crore
    expect(r.corpus).toBeGreaterThan(11_300_000);
    expect(r.corpus).toBeLessThan(11_500_000);
  });

  it("estimated returns = corpus − contributions", () => {
    const r = calculateNPS(make());
    expect(Math.abs(r.estimatedReturns - (r.corpus - r.totalContributions))).toBeLessThanOrEqual(1);
  });

  it("splits the corpus into lump sum and annuity by the chosen percentage", () => {
    const r = calculateNPS(make({ lumpSumPct: 60 }));
    expect(r.annuityPct).toBe(40);
    expect(Math.abs(r.lumpSumAmount - Math.round(r.corpus * 0.6))).toBeLessThanOrEqual(1);
    expect(Math.abs(r.lumpSumAmount + r.annuityCorpus - r.corpus)).toBeLessThanOrEqual(1);
  });

  it("monthly pension = annuity corpus × annuity rate ÷ 12", () => {
    const r = calculateNPS(make({ annuityReturn: 6 }));
    expect(
      Math.abs(r.monthlyPension - Math.round((r.annuityCorpus * 0.06) / 12))
    ).toBeLessThanOrEqual(1);
  });

  it("zero return → corpus equals contributions, no returns", () => {
    const r = calculateNPS(make({ expectedReturn: 0, currentAge: 40, retirementAge: 60 }));
    expect(r.corpus).toBe(r.totalContributions);
    expect(r.estimatedReturns).toBe(0);
  });

  it("0% lump sum annuitises the whole corpus", () => {
    const r = calculateNPS(make({ lumpSumPct: 0 }));
    expect(r.lumpSumAmount).toBe(0);
    expect(r.annuityPct).toBe(100);
    expect(Math.abs(r.annuityCorpus - r.corpus)).toBeLessThanOrEqual(1);
  });

  it("clamps a lump-sum percentage above 60 down to 60", () => {
    const r = calculateNPS(make({ lumpSumPct: 90 }));
    expect(r.lumpSumPct).toBe(60);
    expect(r.annuityPct).toBe(40);
  });
});

describe("calculateNPS — projection", () => {
  it("year rows match the number of years and end at the retirement age", () => {
    const r = calculateNPS(make({ currentAge: 35, retirementAge: 60 }));
    expect(r.yearWise).toHaveLength(25);
    expect(r.yearWise[r.yearWise.length - 1].age).toBe(60);
  });

  it("closing balance is non-decreasing across years", () => {
    const r = calculateNPS(make());
    for (let k = 1; k < r.yearWise.length; k++) {
      expect(r.yearWise[k].closingBalance).toBeGreaterThanOrEqual(r.yearWise[k - 1].closingBalance);
    }
  });

  it("a longer horizon and higher return both grow the corpus", () => {
    const base = calculateNPS(make());
    const longer = calculateNPS(make({ currentAge: 25 }));
    const higher = calculateNPS(make({ expectedReturn: 12 }));
    expect(longer.corpus).toBeGreaterThan(base.corpus);
    expect(higher.corpus).toBeGreaterThan(base.corpus);
  });
});

// ── Randomized property tests ───────────────────────────────────────────────────

describe("calculateNPS — 1000 randomized scenarios (seed 0x5c3)", () => {
  it("invariants hold", () => {
    const rng = lcg(0x5c3);
    let fail = 0;
    for (let i = 0; i < 1000; i++) {
      const currentAge = Math.floor(rng(55, 18));
      const input: NPSInput = {
        currentAge,
        retirementAge: currentAge + Math.floor(rng(75 - currentAge, 1)) + 1,
        monthlyContribution: Math.round(rng(200_000, 500)),
        expectedReturn: rng(15, 0),
        annuityReturn: rng(10, 0),
        lumpSumPct: rng(80, 0),
      };
      const r = calculateNPS(input);

      // returns non-negative → corpus ≥ contributions
      if (r.corpus < r.totalContributions - 1) fail++;
      if (r.estimatedReturns < -1) fail++;

      // corpus identity
      if (Math.abs(r.corpus - (r.totalContributions + r.estimatedReturns)) > 1) fail++;

      // lump/annuity split
      if (r.lumpSumPct < 0 || r.lumpSumPct > NPS_MAX_LUMPSUM_PCT) fail++;
      if (r.annuityPct !== 100 - r.lumpSumPct) fail++;
      if (Math.abs(r.lumpSumAmount + r.annuityCorpus - r.corpus) > 1) fail++;

      // pension non-negative
      if (r.monthlyPension < 0) fail++;

      // projection shape
      if (r.yearWise.length !== r.years) fail++;
      if (r.months !== r.years * 12) fail++;
      for (let k = 1; k < r.yearWise.length; k++) {
        if (r.yearWise[k].closingBalance < r.yearWise[k - 1].closingBalance) fail++;
      }
    }
    expect(fail).toBe(0);
  });
});

// ── Validation ──────────────────────────────────────────────────────────────────

describe("validateNPSInputs", () => {
  const ok = make();

  it("valid inputs → no errors", () => {
    expect(validateNPSInputs(ok)).toEqual({});
  });
  it("current age below 18 → error", () => {
    expect(validateNPSInputs(make({ currentAge: 16 })).currentAge).toBeDefined();
  });
  it("retirement age not greater than current age → error", () => {
    expect(
      validateNPSInputs(make({ currentAge: 60, retirementAge: 60 })).retirementAge
    ).toBeDefined();
  });
  it("retirement age above 75 → error", () => {
    expect(validateNPSInputs(make({ retirementAge: 80 })).retirementAge).toBeDefined();
  });
  it("zero contribution → error", () => {
    expect(validateNPSInputs(make({ monthlyContribution: 0 })).monthlyContribution).toBeDefined();
  });
  it("lump sum above 60% → error", () => {
    expect(validateNPSInputs(make({ lumpSumPct: 70 })).lumpSumPct).toBeDefined();
  });
  it("negative expected return → error", () => {
    expect(validateNPSInputs(make({ expectedReturn: -1 })).expectedReturn).toBeDefined();
  });
});

// ── CSV ──────────────────────────────────────────────────────────────────────────

describe("resultToCSV", () => {
  it("includes the header, year rows and summary", () => {
    const csv = resultToCSV(calculateNPS(make()));
    expect(csv).toContain("Closing Balance");
    expect(csv).toContain("Corpus at Retirement");
    expect(csv).toContain("Monthly Pension");
    expect(csv).toContain("Annuity Corpus");
    expect(csv.split("\n").length).toBeGreaterThan(30);
  });
});

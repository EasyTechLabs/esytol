import { describe, it, expect } from "vitest";
import {
  calculateHRA,
  validateHRAInputs,
  resultToCSV,
  METRO_RATE,
  NON_METRO_RATE,
  type HRAInput,
} from "@/lib/hra";

// ── Deterministic LCG RNG ──────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return min + (s / 0x100000000) * (max - min);
  };
}

const make = (extra: Partial<HRAInput> = {}): HRAInput => ({
  annualSalary: 1200000,
  basicSalary: 600000,
  hraReceived: 240000,
  rentPaid: 300000,
  isMetro: true,
  ...extra,
});

// ── Known-value financial validation ───────────────────────────────────────────

describe("calculateHRA — Rule 2A known values", () => {
  it("metro: exemption is the least of the three rules", () => {
    const r = calculateHRA(make());
    // rule1 = 240000, rule2 = 300000 - 60000 = 240000, rule3 = 300000
    expect(r.actualHRA).toBe(240000);
    expect(r.rentExcess).toBe(240000);
    expect(r.percentOfBasic).toBe(300000);
    expect(r.hraExemption).toBe(240000);
    expect(r.taxableHRA).toBe(0);
    expect(r.remainingTaxableSalary).toBe(960000);
    expect(r.monthlyExemption).toBe(20000);
  });

  it("non-metro: rent-excess rule wins", () => {
    const r = calculateHRA({
      annualSalary: 1000000,
      basicSalary: 500000,
      hraReceived: 200000,
      rentPaid: 120000,
      isMetro: false,
    });
    // rule2 = 120000 - 50000 = 70000 (least)
    expect(r.rentExcess).toBe(70000);
    expect(r.hraExemption).toBe(70000);
    expect(r.taxableHRA).toBe(130000);
    expect(r.rules.find((x) => x.key === "rentExcess")!.isWinner).toBe(true);
  });

  it("metro uses 50%, non-metro uses 40% of basic", () => {
    const metro = calculateHRA(make({ isMetro: true }));
    const nonMetro = calculateHRA(make({ isMetro: false }));
    expect(metro.metroRate).toBe(METRO_RATE);
    expect(metro.percentOfBasic).toBe(300000); // 50% of 6L
    expect(nonMetro.metroRate).toBe(NON_METRO_RATE);
    expect(nonMetro.percentOfBasic).toBe(240000); // 40% of 6L
  });

  it("exactly one rule is flagged as the winner", () => {
    const r = calculateHRA({
      annualSalary: 1500000,
      basicSalary: 700000,
      hraReceived: 300000,
      rentPaid: 250000,
      isMetro: false,
    });
    expect(r.rules.filter((x) => x.isWinner)).toHaveLength(1);
  });
});

describe("calculateHRA — boundary conditions", () => {
  it("no rent paid → zero exemption, all HRA taxable", () => {
    const r = calculateHRA(make({ rentPaid: 0 }));
    expect(r.rentExcess).toBe(0);
    expect(r.hraExemption).toBe(0);
    expect(r.taxableHRA).toBe(240000);
    expect(r.exemptPercentOfHRA).toBe(0);
  });

  it("rent below 10% of basic → zero rent-excess → zero exemption", () => {
    const r = calculateHRA(make({ rentPaid: 40000 })); // 10% of 6L = 60000
    expect(r.rentExcess).toBe(0);
    expect(r.hraExemption).toBe(0);
  });

  it("no HRA received → zero exemption", () => {
    const r = calculateHRA(make({ hraReceived: 0 }));
    expect(r.actualHRA).toBe(0);
    expect(r.hraExemption).toBe(0);
    expect(r.taxableHRA).toBe(0);
  });

  it("zero basic salary → rent-excess = full rent, 0% rule wins", () => {
    const r = calculateHRA(make({ basicSalary: 0 }));
    expect(r.percentOfBasic).toBe(0);
    expect(r.hraExemption).toBe(0);
  });

  it("fully exempt when HRA is the least and rent is high", () => {
    const r = calculateHRA({
      annualSalary: 2000000,
      basicSalary: 1000000,
      hraReceived: 200000,
      rentPaid: 600000,
      isMetro: true,
    });
    // rule1 = 200000, rule2 = 600000 - 100000 = 500000, rule3 = 500000 → exemption 200000
    expect(r.hraExemption).toBe(200000);
    expect(r.taxableHRA).toBe(0);
    expect(r.exemptPercentOfHRA).toBe(100);
  });
});

// ── Randomized property tests ───────────────────────────────────────────────────

describe("calculateHRA — 1000 randomized scenarios (seed 0x27a)", () => {
  it("invariants hold", () => {
    const rng = lcg(0x27a);
    let fail = 0;
    for (let i = 0; i < 1000; i++) {
      const basicSalary = Math.round(rng(2_000_000, 0));
      const input: HRAInput = {
        annualSalary: basicSalary + Math.round(rng(2_000_000, 0)),
        basicSalary,
        hraReceived: Math.round(rng(800_000, 0)),
        rentPaid: Math.round(rng(1_200_000, 0)),
        isMetro: rng(1) > 0.5,
      };
      const r = calculateHRA(input);

      // exemption is non-negative and never exceeds any of the three rules or HRA received
      if (r.hraExemption < 0) fail++;
      if (r.hraExemption > r.actualHRA + 1) fail++;
      if (r.hraExemption > r.rentExcess + 1) fail++;
      if (r.hraExemption > r.percentOfBasic + 1) fail++;
      if (r.hraExemption > input.hraReceived + 1) fail++;

      // exemption equals the least of the three rules (within rounding)
      const least = Math.min(r.actualHRA, r.rentExcess, r.percentOfBasic);
      if (Math.abs(r.hraExemption - least) > 1) fail++;

      // taxable HRA identity: received = exemption + taxable
      if (Math.abs(input.hraReceived - (r.hraExemption + r.taxableHRA)) > 1) fail++;

      // remaining taxable salary identity
      if (Math.abs(r.remainingTaxableSalary - (input.annualSalary - r.hraExemption)) > 1) fail++;

      // exactly one winner
      if (r.rules.filter((x) => x.isWinner).length !== 1) fail++;

      // percent within [0, 100]
      if (r.exemptPercentOfHRA < 0 || r.exemptPercentOfHRA > 100.01) fail++;

      // monthly × 12 ≈ annual exemption
      if (Math.abs(r.monthlyExemption * 12 - r.annualExemption) > 12) fail++;
    }
    expect(fail).toBe(0);
  });

  it("more rent paid never decreases the exemption (monotonic in rent)", () => {
    let prev = -1;
    for (let rent = 0; rent <= 1_500_000; rent += 25_000) {
      const r = calculateHRA(make({ rentPaid: rent }));
      expect(r.hraExemption).toBeGreaterThanOrEqual(prev);
      prev = r.hraExemption;
    }
  });
});

// ── Validation ──────────────────────────────────────────────────────────────────

describe("validateHRAInputs", () => {
  const ok = { annualSalary: 1200000, basicSalary: 600000, hraReceived: 240000, rentPaid: 300000 };

  it("valid inputs → no errors", () => {
    expect(validateHRAInputs(ok)).toEqual({});
  });
  it("zero salary → error", () => {
    expect(validateHRAInputs({ ...ok, annualSalary: 0 }).annualSalary).toBeDefined();
  });
  it("negative salary → error", () => {
    expect(validateHRAInputs({ ...ok, annualSalary: -1 }).annualSalary).toBeDefined();
  });
  it("basic > annual salary → error", () => {
    expect(validateHRAInputs({ ...ok, basicSalary: 1300000 }).basicSalary).toBeDefined();
  });
  it("HRA > annual salary → error", () => {
    expect(validateHRAInputs({ ...ok, hraReceived: 1300000 }).hraReceived).toBeDefined();
  });
  it("negative rent → error", () => {
    expect(validateHRAInputs({ ...ok, rentPaid: -1 }).rentPaid).toBeDefined();
  });
});

// ── CSV ──────────────────────────────────────────────────────────────────────────

describe("resultToCSV", () => {
  it("includes the three rules and key outputs", () => {
    const input = make();
    const csv = resultToCSV(input, calculateHRA(input));
    expect(csv).toContain("HRA Exemption");
    expect(csv).toContain("Taxable HRA");
    expect(csv).toContain("Remaining Taxable Salary");
    expect(csv).toContain("Monthly HRA Exemption");
    expect(csv).toContain("Metro");
    expect(csv.split("\n").length).toBeGreaterThan(10);
  });
});

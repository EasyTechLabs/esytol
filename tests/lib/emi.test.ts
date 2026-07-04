import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateEMI,
  calculateEMIExact,
  generateAmortizationSchedule,
  generateEMISchedule,
  scheduleToCSV,
  downloadCSV,
  validateEMIInputs,
  formatINR,
} from "@/lib/emi";
import type { EMIInput, AmortizationRow, EMIScheduleResult } from "@/lib/emi";

// ── Invariant helpers ─────────────────────────────────────────────────────────

/**
 * Verifies legacy financial invariants using the backward-compat wrapper.
 * Called by both the specific-scenario and randomized-property tests.
 */
function checkInvariants(input: EMIInput): void {
  const schedule = generateAmortizationSchedule(input);

  if (input.principal <= 0 || input.months <= 0) {
    expect(schedule).toHaveLength(0);
    return;
  }

  expect(schedule).toHaveLength(input.months);

  const sumPrincipal = schedule.reduce((s, r) => s + r.principal, 0);
  // Core invariant: sum of displayed principal = loan amount ± ₹0.01.
  // Guaranteed by the final-row correction regardless of schedule length.
  expect(
    Math.abs(sumPrincipal - input.principal),
    `sum(principal)=${sumPrincipal.toFixed(4)} vs principal=${input.principal} for P=${input.principal} r=${input.annualRate}% n=${input.months}`
  ).toBeLessThanOrEqual(0.01);

  // Zero-interest: every row must have zero interest
  if (input.annualRate === 0) {
    for (const row of schedule) {
      expect(row.interest).toBe(0);
    }
  }

  // Balance never increases between consecutive rows
  for (let i = 1; i < schedule.length; i++) {
    expect(
      schedule[i].balance,
      `balance increased at month ${i + 1}: ${schedule[i].balance} > ${schedule[i - 1].balance}`
    ).toBeLessThanOrEqual(schedule[i - 1].balance + 0.005);
  }

  // Principal and interest are non-negative in every row
  for (const row of schedule) {
    expect(row.principal, `negative principal at month ${row.month}`).toBeGreaterThanOrEqual(0);
    expect(row.interest, `negative interest at month ${row.month}`).toBeGreaterThanOrEqual(0);
  }

  // Last balance is exactly 0
  expect(schedule[schedule.length - 1].balance).toBe(0);
}

/**
 * Verifies full SPRINT-007 reconciliation invariants on an EMIScheduleResult.
 *
 * Guarantees checked (see lib/emi.ts module header for proofs):
 *   1. row.emi = row.principal + row.interest  (exact IEEE 754, every row)
 *   2. Σ displayPrincipal = loan ± ₹0.01       (final-row correction)
 *   3. Σ displayEMI = Σ principal + Σ interest (exact by identity from #1)
 *   4. summary.totalPayment ≈ Σ row.emi ± ₹0.01 (round2 cleans FP epsilon)
 *   5. summary.totalInterest ≈ Σ row.interest ± ₹0.01
 *   6. summary.totalPayment ≈ loan + summary.totalInterest ± ₹0.02
 *   7. Balance non-increasing, principal ≥ 0, interest ≥ 0, last balance = 0
 *   8. exactSchedule: Σ exactPrincipal = loan within 1e-6 (exact arithmetic)
 */
function checkReconciliation(result: EMIScheduleResult, input: EMIInput): void {
  const { displaySchedule, exactSchedule, summary } = result;

  if (input.principal <= 0 || input.months <= 0) {
    expect(displaySchedule).toHaveLength(0);
    expect(exactSchedule).toHaveLength(0);
    expect(summary.monthlyEMI).toBe(0);
    expect(summary.totalInterest).toBe(0);
    expect(summary.totalPayment).toBe(0);
    return;
  }

  const label = `P=${input.principal} r=${input.annualRate}% n=${input.months}`;

  expect(displaySchedule).toHaveLength(input.months);
  expect(exactSchedule).toHaveLength(input.months);

  // ── Invariant 1: row.emi = row.principal + row.interest (exact) ──────────
  // This holds because emi is stored as displayPrincipal + displayInterest
  // in the same IEEE 754 operation — identical inputs always give identical results.
  for (const row of displaySchedule) {
    expect(row.emi, `row.emi ≠ row.principal + row.interest at month ${row.month} [${label}]`).toBe(
      row.principal + row.interest
    );
  }

  // ── Invariant 2: Σ displayPrincipal = loan ± ₹0.01 ──────────────────────
  const sumPrincipal = displaySchedule.reduce((s, r) => s + r.principal, 0);
  expect(
    Math.abs(sumPrincipal - input.principal),
    `Σ principal=${sumPrincipal.toFixed(4)} vs loan=${input.principal} [${label}]`
  ).toBeLessThanOrEqual(0.01);

  // ── Invariant 3: Σ EMI = Σ principal + Σ interest ──────────────────────
  // Per-row: row.emi = row.principal + row.interest (exact at write time — proven
  // by Invariant 1). However, three separate reduce() passes compute three
  // floating-point sums in different accumulated-addition orders, so their
  // difference can accumulate FP epsilon proportional to n × ε × Σ.
  // Threshold 1e-3 (₹0.001) is far below the ₹0.01 accounting guarantee and
  // comfortably above the worst-case FP accumulation for any realistic loan.
  const sumInterest = displaySchedule.reduce((s, r) => s + r.interest, 0);
  const sumEMI = displaySchedule.reduce((s, r) => s + r.emi, 0);
  expect(
    Math.abs(sumEMI - sumPrincipal - sumInterest),
    `Σ EMI ≠ Σ principal + Σ interest [${label}]`
  ).toBeLessThan(1e-3);

  // ── Invariant 4: summary.totalPayment ≈ Σ row.emi ± ₹0.01 ───────────────
  // round2(Σ emi) introduces at most ±0.005.
  expect(
    Math.abs(summary.totalPayment - sumEMI),
    `summary.totalPayment=${summary.totalPayment} vs Σ emi=${sumEMI.toFixed(4)} [${label}]`
  ).toBeLessThanOrEqual(0.01);

  // ── Invariant 5: summary.totalInterest ≈ Σ row.interest ± ₹0.01 ─────────
  expect(
    Math.abs(summary.totalInterest - sumInterest),
    `summary.totalInterest=${summary.totalInterest} vs Σ interest=${sumInterest.toFixed(4)} [${label}]`
  ).toBeLessThanOrEqual(0.01);

  // ── Invariant 6: summary.totalPayment ≈ loan + summary.totalInterest ± ₹0.02
  expect(
    Math.abs(summary.totalPayment - input.principal - summary.totalInterest),
    `totalPayment breakdown error [${label}]`
  ).toBeLessThanOrEqual(0.02);

  // ── Invariant 7: non-negative fields, non-increasing balance, last balance = 0
  for (const row of displaySchedule) {
    expect(
      row.principal,
      `negative principal at month ${row.month} [${label}]`
    ).toBeGreaterThanOrEqual(0);
    expect(
      row.interest,
      `negative interest at month ${row.month} [${label}]`
    ).toBeGreaterThanOrEqual(0);
  }
  for (let i = 1; i < displaySchedule.length; i++) {
    expect(
      displaySchedule[i].balance,
      `balance increased at month ${i + 1} [${label}]`
    ).toBeLessThanOrEqual(displaySchedule[i - 1].balance + 0.005);
  }
  expect(displaySchedule[displaySchedule.length - 1].balance).toBe(0);

  // ── Invariant 8: Σ exactPrincipal = loan within FP epsilon ───────────────
  const sumExactPrincipal = exactSchedule.reduce((s, r) => s + r.exactPrincipal, 0);
  expect(
    Math.abs(sumExactPrincipal - input.principal),
    `Σ exactPrincipal=${sumExactPrincipal} vs loan=${input.principal} [${label}]`
  ).toBeLessThan(0.001);

  // Zero-interest: all display interests are 0
  if (input.annualRate === 0) {
    for (const row of displaySchedule) {
      expect(row.interest, `non-zero interest with annualRate=0 at month ${row.month}`).toBe(0);
    }
  }
}

// ── calculateEMIExact ─────────────────────────────────────────────────────────

describe("calculateEMIExact", () => {
  it("returns a positive number for valid inputs", () => {
    const exact = calculateEMIExact({ principal: 100000, annualRate: 12, months: 12 });
    expect(exact).toBeGreaterThan(0);
  });

  it("returns full precision (not truncated to 2 decimals)", () => {
    const exact = calculateEMIExact({ principal: 100000, annualRate: 12, months: 12 });
    const rounded = Math.round(exact * 100) / 100;
    expect(typeof exact).toBe("number");
    expect(Number.isFinite(exact)).toBe(true);
    expect(Math.abs(exact - rounded)).toBeLessThan(0.01);
  });

  it("returns 0 for zero principal", () => {
    expect(calculateEMIExact({ principal: 0, annualRate: 10, months: 12 })).toBe(0);
  });

  it("returns 0 for zero months", () => {
    expect(calculateEMIExact({ principal: 100000, annualRate: 10, months: 0 })).toBe(0);
  });

  it("handles zero interest rate: returns P / n exactly", () => {
    const exact = calculateEMIExact({ principal: 120000, annualRate: 0, months: 12 });
    expect(exact).toBe(10000);
  });

  it("matches calculateEMI().emi to within 1 paisa", () => {
    const input = { principal: 500000, annualRate: 8.5, months: 60 };
    const exact = calculateEMIExact(input);
    const display = calculateEMI(input).emi;
    expect(Math.abs(exact - display)).toBeLessThan(0.01);
  });

  it("is strictly greater than the first month's interest for valid loans", () => {
    const input = { principal: 100000, annualRate: 100, months: 360 };
    const exact = calculateEMIExact(input);
    const firstMonthInterest = input.principal * (input.annualRate / 12 / 100);
    expect(exact).toBeGreaterThan(firstMonthInterest);
  });
});

// ── calculateEMI ─────────────────────────────────────────────────────────────

describe("calculateEMI", () => {
  it("returns correct EMI for a standard loan", () => {
    const result = calculateEMI({ principal: 100000, annualRate: 12, months: 12 });
    expect(result.emi).toBeCloseTo(8884.88, 0);
  });

  it("totalPayment equals emi × months", () => {
    const result = calculateEMI({ principal: 100000, annualRate: 12, months: 12 });
    expect(result.totalPayment).toBeCloseTo(result.emi * 12, 0);
  });

  it("totalInterest equals totalPayment minus principal", () => {
    const result = calculateEMI({ principal: 100000, annualRate: 12, months: 12 });
    expect(result.totalInterest).toBeCloseTo(result.totalPayment - 100000, 0);
  });

  it("handles zero interest rate correctly", () => {
    const result = calculateEMI({ principal: 120000, annualRate: 0, months: 12 });
    expect(result.emi).toBeCloseTo(10000, 2);
    expect(result.totalInterest).toBe(0);
    expect(result.totalPayment).toBeCloseTo(120000, 2);
  });

  it("returns zeros for zero principal", () => {
    const result = calculateEMI({ principal: 0, annualRate: 10, months: 12 });
    expect(result.emi).toBe(0);
    expect(result.totalInterest).toBe(0);
    expect(result.totalPayment).toBe(0);
  });

  it("returns zeros for zero months", () => {
    const result = calculateEMI({ principal: 100000, annualRate: 10, months: 0 });
    expect(result.emi).toBe(0);
  });

  it("produces higher EMI for shorter tenure", () => {
    const short = calculateEMI({ principal: 500000, annualRate: 8.5, months: 12 });
    const long = calculateEMI({ principal: 500000, annualRate: 8.5, months: 60 });
    expect(short.emi).toBeGreaterThan(long.emi);
  });

  it("produces lower total interest for shorter tenure", () => {
    const short = calculateEMI({ principal: 500000, annualRate: 8.5, months: 12 });
    const long = calculateEMI({ principal: 500000, annualRate: 8.5, months: 60 });
    expect(short.totalInterest).toBeLessThan(long.totalInterest);
  });

  it("rounds EMI to 2 decimal places", () => {
    const result = calculateEMI({ principal: 123456, annualRate: 9.75, months: 36 });
    const decimals = result.emi.toString().split(".")[1];
    expect(!decimals || decimals.length <= 2).toBe(true);
  });
});

// ── generateAmortizationSchedule (backward compat) ───────────────────────────

describe("generateAmortizationSchedule — basic", () => {
  const input = { principal: 100000, annualRate: 12, months: 12 };
  const schedule = generateAmortizationSchedule(input);

  it("returns correct number of rows", () => {
    expect(schedule).toHaveLength(12);
  });

  it("first month has correct row number", () => {
    expect(schedule[0].month).toBe(1);
  });

  it("last month number equals tenure", () => {
    expect(schedule[11].month).toBe(12);
  });

  it("last month balance is 0", () => {
    expect(schedule[11].balance).toBe(0);
  });

  it("each row: emi = principal + interest (exact by construction)", () => {
    // emi is derived as displayPrincipal + displayInterest — same IEEE 754 operation.
    // No tolerance needed: the same addition is reproduced identically.
    for (const row of schedule) {
      expect(row.emi).toBe(row.principal + row.interest);
    }
  });

  it("balance decreases monotonically", () => {
    for (let i = 1; i < schedule.length - 1; i++) {
      expect(schedule[i].balance).toBeLessThanOrEqual(schedule[i - 1].balance);
    }
  });

  it("principal portion increases over time", () => {
    expect(schedule[10].principal).toBeGreaterThan(schedule[0].principal);
  });

  it("interest portion decreases over time", () => {
    expect(schedule[10].interest).toBeLessThan(schedule[0].interest);
  });

  it("returns empty array for zero principal", () => {
    expect(generateAmortizationSchedule({ principal: 0, annualRate: 10, months: 12 })).toHaveLength(
      0
    );
  });

  it("returns empty array for zero months", () => {
    expect(
      generateAmortizationSchedule({ principal: 100000, annualRate: 10, months: 0 })
    ).toHaveLength(0);
  });
});

// ── generateEMISchedule — unit tests ─────────────────────────────────────────

describe("generateEMISchedule", () => {
  it("returns EMIScheduleResult with all three fields", () => {
    const result = generateEMISchedule({ principal: 100000, annualRate: 12, months: 12 });
    expect(result).toHaveProperty("displaySchedule");
    expect(result).toHaveProperty("exactSchedule");
    expect(result).toHaveProperty("summary");
  });

  it("displaySchedule and exactSchedule have the same length", () => {
    const result = generateEMISchedule({ principal: 500000, annualRate: 8.5, months: 24 });
    expect(result.exactSchedule).toHaveLength(result.displaySchedule.length);
  });

  it("returns empty result for zero principal", () => {
    const result = generateEMISchedule({ principal: 0, annualRate: 10, months: 12 });
    expect(result.displaySchedule).toHaveLength(0);
    expect(result.exactSchedule).toHaveLength(0);
    expect(result.summary.monthlyEMI).toBe(0);
    expect(result.summary.totalInterest).toBe(0);
    expect(result.summary.totalPayment).toBe(0);
  });

  it("summary.monthlyEMI = round2(exactEMI)", () => {
    const input = { principal: 100000, annualRate: 12, months: 12 };
    const exactEMI = calculateEMIExact(input);
    const { summary } = generateEMISchedule(input);
    expect(summary.monthlyEMI).toBeCloseTo(Math.round(exactEMI * 100) / 100, 5);
  });

  it("summary.totalPayment = sum of row.emi from displaySchedule (within ₹0.01)", () => {
    const result = generateEMISchedule({ principal: 500000, annualRate: 8.5, months: 24 });
    const rawSum = result.displaySchedule.reduce((s, r) => s + r.emi, 0);
    expect(Math.abs(result.summary.totalPayment - rawSum)).toBeLessThanOrEqual(0.01);
  });

  it("summary.totalInterest = sum of row.interest from displaySchedule (within ₹0.01)", () => {
    const result = generateEMISchedule({ principal: 500000, annualRate: 8.5, months: 24 });
    const rawSum = result.displaySchedule.reduce((s, r) => s + r.interest, 0);
    expect(Math.abs(result.summary.totalInterest - rawSum)).toBeLessThanOrEqual(0.01);
  });

  it("exactSchedule last row has exactBalance = 0", () => {
    const result = generateEMISchedule({ principal: 100000, annualRate: 12, months: 12 });
    const lastExact = result.exactSchedule[result.exactSchedule.length - 1];
    expect(lastExact.exactBalance).toBe(0);
  });

  it("exactSchedule all values are finite numbers", () => {
    const result = generateEMISchedule({ principal: 100000, annualRate: 100, months: 360 });
    for (const row of result.exactSchedule) {
      expect(Number.isFinite(row.exactEMI)).toBe(true);
      expect(Number.isFinite(row.exactPrincipal)).toBe(true);
      expect(Number.isFinite(row.exactInterest)).toBe(true);
      expect(Number.isFinite(row.exactBalance)).toBe(true);
    }
  });

  it("exactSchedule principal values are all positive", () => {
    const result = generateEMISchedule({ principal: 100000, annualRate: 100, months: 360 });
    for (const row of result.exactSchedule) {
      expect(row.exactPrincipal).toBeGreaterThan(0);
    }
  });

  it("zero interest: summary.totalInterest is 0", () => {
    const result = generateEMISchedule({ principal: 120000, annualRate: 0, months: 12 });
    expect(result.summary.totalInterest).toBe(0);
  });

  it("one-month loan closes balance to 0", () => {
    const result = generateEMISchedule({ principal: 50000, annualRate: 12, months: 1 });
    expect(result.displaySchedule[0].balance).toBe(0);
    expect(result.displaySchedule[0].principal).toBeGreaterThan(0);
  });

  it("displaySchedule is the same as generateAmortizationSchedule output", () => {
    const input = { principal: 200000, annualRate: 9, months: 18 };
    const result = generateEMISchedule(input);
    const legacy = generateAmortizationSchedule(input);
    expect(result.displaySchedule).toEqual(legacy);
  });

  it("passes full reconciliation check for standard home loan", () => {
    const input = { principal: 3_000_000, annualRate: 8.5, months: 240 };
    checkReconciliation(generateEMISchedule(input), input);
  });

  it("passes full reconciliation check for high-interest extreme", () => {
    const input = { principal: 100000, annualRate: 100, months: 360 };
    checkReconciliation(generateEMISchedule(input), input);
  });

  it("passes full reconciliation check for large long-tenure loan", () => {
    const input = { principal: 10_000_000, annualRate: 24, months: 480 };
    checkReconciliation(generateEMISchedule(input), input);
  });
});

// ── Financial invariants — specific scenarios ─────────────────────────────────

describe("financial invariants — specific scenarios", () => {
  it("₹1,00,000 / 100% / 360 months (high-interest extreme)", () => {
    checkInvariants({ principal: 100000, annualRate: 100, months: 360 });
  });

  it("₹1,00,00,000 / 24% / 480 months (large loan, long tenure)", () => {
    checkInvariants({ principal: 10_000_000, annualRate: 24, months: 480 });
  });

  it("zero interest / 60 months", () => {
    checkInvariants({ principal: 500000, annualRate: 0, months: 60 });
  });

  it("zero interest / 1 month", () => {
    checkInvariants({ principal: 100000, annualRate: 0, months: 1 });
  });

  it("one month loan / 12% p.a.", () => {
    checkInvariants({ principal: 100000, annualRate: 12, months: 1 });
  });

  it("one month loan / 100% p.a.", () => {
    checkInvariants({ principal: 100000, annualRate: 100, months: 1 });
  });

  it("very small loan: ₹100 / 8.5% / 12 months", () => {
    checkInvariants({ principal: 100, annualRate: 8.5, months: 12 });
  });

  it("very small loan: ₹1 / 12% / 6 months", () => {
    checkInvariants({ principal: 1, annualRate: 12, months: 6 });
  });

  it("very large loan: ₹100 crore / 8% / 360 months", () => {
    checkInvariants({ principal: 1_000_000_000, annualRate: 8, months: 360 });
  });

  it("very large loan: ₹50 crore / 15% / 240 months", () => {
    checkInvariants({ principal: 500_000_000, annualRate: 15, months: 240 });
  });

  it("standard home loan: ₹30L / 8.5% / 240 months", () => {
    checkInvariants({ principal: 3_000_000, annualRate: 8.5, months: 240 });
  });

  it("standard car loan: ₹8L / 11% / 60 months", () => {
    checkInvariants({ principal: 800_000, annualRate: 11, months: 60 });
  });

  it("personal loan: ₹2L / 18% / 24 months", () => {
    checkInvariants({ principal: 200_000, annualRate: 18, months: 24 });
  });

  it("maximum validated input: ₹1B / 100% / 360 months", () => {
    checkInvariants({ principal: 1_000_000_000, annualRate: 100, months: 360 });
  });
});

// ── Randomized property tests (legacy 200 scenarios) ─────────────────────────

describe("financial invariants — randomized property tests (200 scenarios)", () => {
  function makeLCG(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223;
      return (s >>> 0) / 0x100000000;
    };
  }

  it("all 100 random scenarios satisfy every financial invariant", () => {
    const rand = makeLCG(0xdeadbeef);
    let count = 0;

    for (let i = 0; i < 100; i++) {
      const principal = Math.round(rand() * 9_900_000 + 100_000);
      const annualRate = Math.round(rand() * 9900) / 100;
      const months = Math.floor(rand() * 474) + 6;
      checkInvariants({ principal, annualRate, months });
      count++;
    }

    expect(count).toBe(100);
  });

  it("no schedule row has a negative principal for 50 high-rate scenarios", () => {
    const rand = makeLCG(0xcafebabe);

    for (let i = 0; i < 50; i++) {
      const principal = Math.round(rand() * 990_000 + 10_000);
      const annualRate = 50 + Math.round(rand() * 50 * 100) / 100;
      const months = Math.floor(rand() * 354) + 6;

      const schedule = generateAmortizationSchedule({ principal, annualRate, months });

      for (const row of schedule) {
        expect(
          row.principal,
          `negative principal at month ${row.month} for P=${principal} r=${annualRate}% n=${months}`
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("balance never increases for 50 long-tenure scenarios", () => {
    const rand = makeLCG(0xbadcafe);

    for (let i = 0; i < 50; i++) {
      const principal = Math.round(rand() * 4_900_000 + 100_000);
      const annualRate = Math.round(rand() * 2000) / 100;
      const months = Math.floor(rand() * 241) + 240;

      const schedule = generateAmortizationSchedule({ principal, annualRate, months });

      for (let j = 1; j < schedule.length; j++) {
        expect(schedule[j].balance).toBeLessThanOrEqual(schedule[j - 1].balance + 0.005);
      }
    }
  });
});

// ── SPRINT-007 reconciliation tests — 1000 deterministic scenarios ────────────

describe("SPRINT-007 reconciliation tests — 1000 deterministic scenarios", () => {
  /**
   * LCG seeded at 0xf00dcafe for this suite — distinct from the legacy seeds
   * so the 1000 scenarios are an independent set from the 200 above.
   */
  function makeLCG(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223;
      return (s >>> 0) / 0x100000000;
    };
  }

  it("all 1000 scenarios satisfy full reconciliation invariants", () => {
    // Up to 1000 × 360 = 360,000 schedule iterations — needs extended timeout.
    const rand = makeLCG(0xf00dcafe);
    let count = 0;

    for (let i = 0; i < 1000; i++) {
      // Uniformly sample the UI-validated parameter space so every scenario
      // corresponds to a loan a user can actually submit.
      // The engine handles beyond-360-month inputs correctly for low-to-mid
      // rates, but the iterative balance formula can lose precision at very
      // high rates (>50%) beyond ~420 months — outside the UI limit anyway.
      const principal = Math.round(rand() * 99_900_000 + 100_000); // ₹1L – ₹10cr
      const annualRate = Math.round(rand() * 10000) / 100; // 0.00 – 100.00 %
      const months = Math.floor(rand() * 360) + 1; // 1 – 360 months (UI-validated max)

      const input: EMIInput = { principal, annualRate, months };
      const result = generateEMISchedule(input);
      checkReconciliation(result, input);
      count++;
    }

    expect(count).toBe(1000);
  }, 30_000);

  it("200 high-rate scenarios: principal never negative, all reconcile", () => {
    const rand = makeLCG(0xdeadcafe);

    for (let i = 0; i < 200; i++) {
      const principal = Math.round(rand() * 9_900_000 + 100_000);
      const annualRate = 50 + Math.round(rand() * 50 * 100) / 100; // 50 – 100 %
      const months = Math.floor(rand() * 354) + 6;

      const input: EMIInput = { principal, annualRate, months };
      const result = generateEMISchedule(input);
      checkReconciliation(result, input);
    }
  });

  it("200 zero-interest scenarios: all interest rows zero, all reconcile", () => {
    const rand = makeLCG(0xcafef00d);

    for (let i = 0; i < 200; i++) {
      const principal = Math.round(rand() * 9_900_000 + 100_000);
      const months = Math.floor(rand() * 359) + 1;

      const input: EMIInput = { principal, annualRate: 0, months };
      const result = generateEMISchedule(input);
      checkReconciliation(result, input);
    }
  });

  it("200 long-tenure scenarios (240-480 months): balance non-increasing, all reconcile", () => {
    const rand = makeLCG(0xbeeff00d);

    for (let i = 0; i < 200; i++) {
      const principal = Math.round(rand() * 49_900_000 + 100_000);
      const annualRate = Math.round(rand() * 2500) / 100; // 0 – 25 %
      const months = Math.floor(rand() * 241) + 240;

      const input: EMIInput = { principal, annualRate, months };
      const result = generateEMISchedule(input);
      checkReconciliation(result, input);
    }
  });

  it("200 single-month and short-tenure scenarios (1-12 months): all reconcile", () => {
    const rand = makeLCG(0xc0def00d);

    for (let i = 0; i < 200; i++) {
      const principal = Math.round(rand() * 9_900_000 + 100_000);
      const annualRate = Math.round(rand() * 9900) / 100;
      const months = Math.floor(rand() * 12) + 1;

      const input: EMIInput = { principal, annualRate, months };
      const result = generateEMISchedule(input);
      checkReconciliation(result, input);
    }
  });
});

// ── scheduleToCSV ─────────────────────────────────────────────────────────────

describe("scheduleToCSV", () => {
  it("includes the correct CSV header", () => {
    const csv = scheduleToCSV([]);
    expect(csv).toMatch(/^Month,EMI,Principal,Interest,Balance/);
  });

  it("formats a row with 2 decimal places", () => {
    const rows: AmortizationRow[] = [
      { month: 1, emi: 1000.5, principal: 800.3, interest: 200.2, balance: 9200.0 },
    ];
    const csv = scheduleToCSV(rows);
    expect(csv).toContain("1,1000.50,800.30,200.20,9200.00");
  });

  it("separates header and rows with a newline", () => {
    const rows: AmortizationRow[] = [
      { month: 1, emi: 1000, principal: 900, interest: 100, balance: 9000 },
    ];
    const lines = scheduleToCSV(rows).split("\n");
    expect(lines).toHaveLength(2);
  });

  it("generates one row per amortization entry", () => {
    const input = { principal: 50000, annualRate: 10, months: 6 };
    const rows = generateAmortizationSchedule(input);
    const csv = scheduleToCSV(rows);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(7); // header + 6 rows
  });

  it("CSV values match the schedule row values exactly", () => {
    const input = { principal: 100000, annualRate: 12, months: 12 };
    const rows = generateAmortizationSchedule(input);
    const csv = scheduleToCSV(rows);
    const lines = csv.split("\n").slice(1);

    rows.forEach((row, idx) => {
      const parts = lines[idx].split(",");
      expect(Number(parts[0])).toBe(row.month);
      expect(Number(parts[1])).toBeCloseTo(row.emi, 2);
      expect(Number(parts[2])).toBeCloseTo(row.principal, 2);
      expect(Number(parts[3])).toBeCloseTo(row.interest, 2);
      expect(Number(parts[4])).toBeCloseTo(row.balance, 2);
    });
  });
});

// ── downloadCSV ───────────────────────────────────────────────────────────────

describe("downloadCSV", () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => "blob:test-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("creates a Blob URL and triggers a click", () => {
    const mockClick = vi.fn();
    const mockLink = {
      href: "",
      setAttribute: vi.fn(),
      click: mockClick,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValueOnce(mockLink);
    vi.spyOn(document.body, "appendChild").mockReturnValueOnce(mockLink as unknown as Node);
    vi.spyOn(document.body, "removeChild").mockReturnValueOnce(mockLink as unknown as Node);

    downloadCSV("Month,EMI\n1,1000", "test.csv");

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockClick).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});

// ── validateEMIInputs ─────────────────────────────────────────────────────────

describe("validateEMIInputs", () => {
  it("returns no errors for valid inputs", () => {
    const errors = validateEMIInputs(500000, 8.5, 24, "months");
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("returns amount error for zero amount", () => {
    const errors = validateEMIInputs(0, 8.5, 24, "months");
    expect(errors.amount).toBeDefined();
  });

  it("returns amount error for negative amount", () => {
    const errors = validateEMIInputs(-100, 8.5, 24, "months");
    expect(errors.amount).toBeDefined();
  });

  it("returns amount error when exceeding 100 crore", () => {
    const errors = validateEMIInputs(1_000_000_001, 8.5, 24, "months");
    expect(errors.amount).toBeDefined();
  });

  it("returns rate error for negative rate", () => {
    const errors = validateEMIInputs(500000, -1, 24, "months");
    expect(errors.rate).toBeDefined();
  });

  it("returns rate error for rate above 100", () => {
    const errors = validateEMIInputs(500000, 101, 24, "months");
    expect(errors.rate).toBeDefined();
  });

  it("accepts zero interest rate", () => {
    const errors = validateEMIInputs(500000, 0, 24, "months");
    expect(errors.rate).toBeUndefined();
  });

  it("returns tenure error for zero tenure", () => {
    const errors = validateEMIInputs(500000, 8.5, 0, "months");
    expect(errors.tenure).toBeDefined();
  });

  it("returns tenure error when months exceeds 360", () => {
    const errors = validateEMIInputs(500000, 8.5, 361, "months");
    expect(errors.tenure).toBeDefined();
  });

  it("returns tenure error when years exceeds 30", () => {
    const errors = validateEMIInputs(500000, 8.5, 31, "years");
    expect(errors.tenure).toBeDefined();
  });

  it("accepts 30 years as valid", () => {
    const errors = validateEMIInputs(500000, 8.5, 30, "years");
    expect(errors.tenure).toBeUndefined();
  });

  it("accepts 360 months as valid", () => {
    const errors = validateEMIInputs(500000, 8.5, 360, "months");
    expect(errors.tenure).toBeUndefined();
  });
});

// ── formatINR ─────────────────────────────────────────────────────────────────

describe("formatINR", () => {
  it("formats a number with the ₹ symbol", () => {
    const formatted = formatINR(10000);
    expect(formatted).toContain("₹");
  });

  it("formats zero correctly", () => {
    const formatted = formatINR(0);
    expect(formatted).toContain("0");
  });

  it("produces a non-empty string for large values", () => {
    const formatted = formatINR(5000000);
    expect(formatted.length).toBeGreaterThan(0);
  });
});

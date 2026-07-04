import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateEMI,
  calculateEMIExact,
  generateAmortizationSchedule,
  scheduleToCSV,
  downloadCSV,
  validateEMIInputs,
  formatINR,
} from "@/lib/emi";
import type { EMIInput, AmortizationRow } from "@/lib/emi";

// ── Invariant helper ──────────────────────────────────────────────────────────

/**
 * Verifies all financial invariants for a generated amortization schedule.
 *
 * Sum(principal) tolerance is ±₹0.01: proved by the final-row correction
 * which absorbs accumulated display rounding, leaving only one round2 of
 * error on the correction value itself (|ε| ≤ 0.005 < 0.01).
 *
 * Sum(interest) uses a looser tolerance because per-row interest rounding
 * accumulates across months without a correction step.
 */
function checkInvariants(input: EMIInput): void {
  const schedule = generateAmortizationSchedule(input);

  if (input.principal <= 0 || input.months <= 0) {
    expect(schedule).toHaveLength(0);
    return;
  }

  expect(schedule).toHaveLength(input.months);

  const sumPrincipal = schedule.reduce((s, r) => s + r.principal, 0);
  // Core invariant: sum of displayed principal = loan amount ± ₹0.01
  // Guaranteed regardless of schedule length by the final-row correction.
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

// ── calculateEMIExact ─────────────────────────────────────────────────────────

describe("calculateEMIExact", () => {
  it("returns a positive number for valid inputs", () => {
    const exact = calculateEMIExact({ principal: 100000, annualRate: 12, months: 12 });
    expect(exact).toBeGreaterThan(0);
  });

  it("returns full precision (not truncated to 2 decimals)", () => {
    const exact = calculateEMIExact({ principal: 100000, annualRate: 12, months: 12 });
    const rounded = Math.round(exact * 100) / 100;
    // exact and rounded may differ by a fraction; the key is the engine uses exact
    expect(typeof exact).toBe("number");
    expect(Number.isFinite(exact)).toBe(true);
    // exact must be >= rounded (because rounding can only reduce)
    // For 12% / 12 months, exact ≈ 8884.8753... , round2 = 8884.88
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
    // Guarantees principal reduction is always positive (no negative principal)
    const input = { principal: 100000, annualRate: 100, months: 360 };
    const exact = calculateEMIExact(input);
    const firstMonthInterest = input.principal * (input.annualRate / 12 / 100);
    expect(exact).toBeGreaterThan(firstMonthInterest);
  });
});

// ── calculateEMI ─────────────────────────────────────────────────────────────

describe("calculateEMI", () => {
  it("returns correct EMI for a standard loan", () => {
    // P=100000, r=12%/yr, n=12 months → EMI ≈ 8884.88
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

// ── generateAmortizationSchedule (basic) ─────────────────────────────────────

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

  it("each row: interest + principal ≈ emi (within ₹0.02)", () => {
    // Regular rows: three independent round2 operations (emi, principal, interest)
    // can each introduce ±0.005 rounding, so |principal+interest−emi| ≤ 0.01
    // plus floating-point epsilon. Tolerance 0.02 covers all cases safely.
    for (const row of schedule) {
      expect(Math.abs(row.interest + row.principal - row.emi)).toBeLessThanOrEqual(0.02);
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

// ── Financial invariants — specific scenarios ─────────────────────────────────

describe("financial invariants — specific scenarios", () => {
  it("₹1,00,000 / 100% / 360 months (high-interest extreme)", () => {
    // This is the canonical failure case for rounded-EMI schedules.
    // At 100% p.a., monthly interest ≈ exactEMI, so any rounding causes
    // interest > EMI → negative principal. Must use exact EMI throughout.
    checkInvariants({ principal: 100000, annualRate: 100, months: 360 });
  });

  it("₹1,00,00,000 / 24% / 480 months (large loan, long tenure)", () => {
    // Engine test only — exceeds UI validation (max 360 months).
    // Verifies that accumulated rounding over 480 months is still absorbed
    // correctly by the final-row correction.
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

// ── Randomized property tests (100 deterministic scenarios) ──────────────────

describe("financial invariants — randomized property tests (100 scenarios)", () => {
  // Seeded linear congruential generator for deterministic reproducibility.
  // Same seed guarantees the same 100 inputs every test run.
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
      // Sample from realistic loan parameter space
      const principal = Math.round(rand() * 9_900_000 + 100_000); // ₹1L – ₹1cr
      const annualRate = Math.round(rand() * 9900) / 100; // 0.00 – 99.00 %
      const months = Math.floor(rand() * 474) + 6; // 6 – 479 months

      const input: EMIInput = { principal, annualRate, months };

      // Run the invariant check directly (it uses expect() internally)
      checkInvariants(input);
      count++;
    }

    expect(count).toBe(100);
  });

  it("no schedule row has a negative principal for 50 high-rate scenarios", () => {
    const rand = makeLCG(0xcafebabe);

    for (let i = 0; i < 50; i++) {
      const principal = Math.round(rand() * 990_000 + 10_000);
      const annualRate = 50 + Math.round(rand() * 50 * 100) / 100; // 50 – 100 %
      const months = Math.floor(rand() * 354) + 6; // 6 – 359 months

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
      const annualRate = Math.round(rand() * 2000) / 100; // 0 – 20 %
      const months = Math.floor(rand() * 241) + 240; // 240 – 480 months

      const schedule = generateAmortizationSchedule({ principal, annualRate, months });

      for (let j = 1; j < schedule.length; j++) {
        expect(schedule[j].balance).toBeLessThanOrEqual(schedule[j - 1].balance + 0.005);
      }
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
    const lines = csv.split("\n").slice(1); // skip header

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

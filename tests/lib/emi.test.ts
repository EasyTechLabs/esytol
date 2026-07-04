import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateEMI,
  generateAmortizationSchedule,
  scheduleToCSV,
  downloadCSV,
  validateEMIInputs,
  formatINR,
} from "@/lib/emi";

// ── calculateEMI ────────────────────────────────────────────────────────────

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

// ── generateAmortizationSchedule ────────────────────────────────────────────

describe("generateAmortizationSchedule", () => {
  const input = { principal: 100000, annualRate: 12, months: 12 };
  const emi = calculateEMI(input).emi;
  const schedule = generateAmortizationSchedule(input, emi);

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

  it("each row: interest + principal ≈ emi", () => {
    for (const row of schedule) {
      expect(row.interest + row.principal).toBeCloseTo(row.emi, 0);
    }
  });

  it("balance decreases monotonically", () => {
    for (let i = 1; i < schedule.length - 1; i++) {
      expect(schedule[i].balance).toBeLessThan(schedule[i - 1].balance);
    }
  });

  it("principal portion increases over time", () => {
    // In amortization, later payments have more principal and less interest
    expect(schedule[11].principal).toBeGreaterThan(schedule[0].principal);
  });

  it("interest portion decreases over time", () => {
    expect(schedule[11].interest).toBeLessThan(schedule[0].interest);
  });
});

// ── scheduleToCSV ────────────────────────────────────────────────────────────

describe("scheduleToCSV", () => {
  it("includes the correct CSV header", () => {
    const csv = scheduleToCSV([]);
    expect(csv).toMatch(/^Month,EMI,Principal,Interest,Balance/);
  });

  it("formats a row with 2 decimal places", () => {
    const rows = [{ month: 1, emi: 1000.5, principal: 800.3, interest: 200.2, balance: 9200.0 }];
    const csv = scheduleToCSV(rows);
    expect(csv).toContain("1,1000.50,800.30,200.20,9200.00");
  });

  it("separates header and rows with a newline", () => {
    const rows = [{ month: 1, emi: 1000, principal: 900, interest: 100, balance: 9000 }];
    const lines = scheduleToCSV(rows).split("\n");
    expect(lines).toHaveLength(2);
  });

  it("generates one row per amortization entry", () => {
    const input = { principal: 50000, annualRate: 10, months: 6 };
    const emi = calculateEMI(input).emi;
    const rows = generateAmortizationSchedule(input, emi);
    const csv = scheduleToCSV(rows);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(7); // header + 6 rows
  });
});

// ── downloadCSV ─────────────────────────────────────────────────────────────

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

// ── validateEMIInputs ────────────────────────────────────────────────────────

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

// ── formatINR ───────────────────────────────────────────────────────────────

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

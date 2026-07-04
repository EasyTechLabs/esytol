import { describe, it, expect } from "vitest";
import { calculateGST, validateGSTInputs, formatINR, GST_RATES } from "@/lib/gst";

// ── Exclusive mode (Add GST) ──────────────────────────────────────────────────

describe("calculateGST — exclusive mode (Add GST)", () => {
  it("calculates 18% GST on ₹1,000", () => {
    const r = calculateGST({ amount: 1000, rate: 18, mode: "exclusive" });
    expect(r.originalAmount).toBe(1000);
    expect(r.gstAmount).toBe(180);
    expect(r.totalAmount).toBe(1180);
    expect(r.cgst).toBe(90);
    expect(r.sgst).toBe(90);
    expect(r.igst).toBe(180);
    expect(r.effectiveRate).toBe(18);
  });

  it("calculates 5% GST on ₹2,000", () => {
    const r = calculateGST({ amount: 2000, rate: 5, mode: "exclusive" });
    expect(r.originalAmount).toBe(2000);
    expect(r.gstAmount).toBe(100);
    expect(r.totalAmount).toBe(2100);
    expect(r.cgst).toBe(50);
    expect(r.sgst).toBe(50);
  });

  it("calculates 12% GST on ₹500", () => {
    const r = calculateGST({ amount: 500, rate: 12, mode: "exclusive" });
    expect(r.gstAmount).toBe(60);
    expect(r.totalAmount).toBe(560);
    expect(r.cgst).toBe(30);
    expect(r.sgst).toBe(30);
  });

  it("calculates 28% GST on ₹5,000", () => {
    const r = calculateGST({ amount: 5000, rate: 28, mode: "exclusive" });
    expect(r.gstAmount).toBe(1400);
    expect(r.totalAmount).toBe(6400);
    expect(r.cgst).toBe(700);
    expect(r.sgst).toBe(700);
  });

  it("calculates 3% GST on ₹10,000 (gold/silver)", () => {
    const r = calculateGST({ amount: 10000, rate: 3, mode: "exclusive" });
    expect(r.gstAmount).toBe(300);
    expect(r.totalAmount).toBe(10300);
    expect(r.cgst).toBe(150);
    expect(r.sgst).toBe(150);
  });

  it("handles 0% GST (nil-rated goods)", () => {
    const r = calculateGST({ amount: 1000, rate: 0, mode: "exclusive" });
    expect(r.gstAmount).toBe(0);
    expect(r.totalAmount).toBe(1000);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
  });

  it("handles custom rate 12.5%", () => {
    const r = calculateGST({ amount: 1000, rate: 12.5, mode: "exclusive" });
    expect(r.gstAmount).toBe(125);
    expect(r.totalAmount).toBe(1125);
  });

  it("handles large amounts correctly", () => {
    const r = calculateGST({ amount: 1_000_000, rate: 18, mode: "exclusive" });
    expect(r.gstAmount).toBe(180000);
    expect(r.totalAmount).toBe(1180000);
  });

  it("rounds display amounts to 2 decimal places", () => {
    // 999.99 × 18 / 100 = 179.9982 → round2 = 180.00
    const r = calculateGST({ amount: 999.99, rate: 18, mode: "exclusive" });
    expect(r.originalAmount).toBe(999.99);
    expect(r.gstAmount).toBe(180);
  });

  it("produces 5 steps for exclusive mode", () => {
    const r = calculateGST({ amount: 1000, rate: 18, mode: "exclusive" });
    expect(r.steps).toHaveLength(5);
  });

  it("step[0] result equals originalAmount", () => {
    const r = calculateGST({ amount: 1000, rate: 18, mode: "exclusive" });
    expect(r.steps[0].result).toBe(r.originalAmount);
  });

  it("step[2] result equals totalAmount", () => {
    const r = calculateGST({ amount: 1000, rate: 18, mode: "exclusive" });
    expect(r.steps[2].result).toBe(r.totalAmount);
  });
});

// ── Inclusive mode (Remove GST) ───────────────────────────────────────────────

describe("calculateGST — inclusive mode (Remove GST)", () => {
  it("extracts 18% GST from ₹1,180", () => {
    const r = calculateGST({ amount: 1180, rate: 18, mode: "inclusive" });
    expect(r.totalAmount).toBe(1180);
    expect(r.originalAmount).toBe(1000);
    expect(r.gstAmount).toBe(180);
    expect(r.cgst).toBe(90);
    expect(r.sgst).toBe(90);
  });

  it("extracts 5% GST from ₹2,100", () => {
    const r = calculateGST({ amount: 2100, rate: 5, mode: "inclusive" });
    expect(r.totalAmount).toBe(2100);
    expect(r.originalAmount).toBe(2000);
    expect(r.gstAmount).toBe(100);
  });

  it("extracts 12% GST from ₹1,120", () => {
    const r = calculateGST({ amount: 1120, rate: 12, mode: "inclusive" });
    expect(r.totalAmount).toBe(1120);
    expect(r.originalAmount).toBe(1000);
    expect(r.gstAmount).toBe(120);
  });

  it("extracts 28% GST from ₹6,400", () => {
    const r = calculateGST({ amount: 6400, rate: 28, mode: "inclusive" });
    expect(r.totalAmount).toBe(6400);
    expect(r.originalAmount).toBe(5000);
    expect(r.gstAmount).toBe(1400);
  });

  it("extracts 3% GST from ₹10,300", () => {
    const r = calculateGST({ amount: 10300, rate: 3, mode: "inclusive" });
    expect(r.totalAmount).toBe(10300);
    expect(r.originalAmount).toBe(10000);
    expect(r.gstAmount).toBe(300);
  });

  it("handles 0% GST inclusive (full amount is original)", () => {
    const r = calculateGST({ amount: 1000, rate: 0, mode: "inclusive" });
    expect(r.originalAmount).toBe(1000);
    expect(r.gstAmount).toBe(0);
    expect(r.totalAmount).toBe(1000);
  });

  it("produces 5 steps for inclusive mode", () => {
    const r = calculateGST({ amount: 1180, rate: 18, mode: "inclusive" });
    expect(r.steps).toHaveLength(5);
  });

  it("step[0] result equals totalAmount", () => {
    const r = calculateGST({ amount: 1180, rate: 18, mode: "inclusive" });
    expect(r.steps[0].result).toBe(r.totalAmount);
  });

  it("step[1] result equals originalAmount", () => {
    const r = calculateGST({ amount: 1180, rate: 18, mode: "inclusive" });
    expect(r.steps[1].result).toBe(r.originalAmount);
  });
});

// ── Accounting invariants ─────────────────────────────────────────────────────

describe("calculateGST — accounting invariants", () => {
  it("exclusive: originalAmount + gstAmount === totalAmount (exact, IEEE 754)", () => {
    const r = calculateGST({ amount: 777.77, rate: 18, mode: "exclusive" });
    expect(r.originalAmount + r.gstAmount).toBe(r.totalAmount);
  });

  it("exclusive: cgst + sgst === gstAmount (exact, IEEE 754)", () => {
    const r = calculateGST({ amount: 1001, rate: 5, mode: "exclusive" });
    expect(r.cgst + r.sgst).toBe(r.gstAmount);
  });

  it("inclusive: originalAmount + gstAmount === totalAmount (exact, IEEE 754)", () => {
    const r = calculateGST({ amount: 1234.56, rate: 18, mode: "inclusive" });
    expect(r.originalAmount + r.gstAmount).toBe(r.totalAmount);
  });

  it("inclusive: cgst + sgst === gstAmount (exact, IEEE 754)", () => {
    const r = calculateGST({ amount: 555.55, rate: 12, mode: "inclusive" });
    expect(r.cgst + r.sgst).toBe(r.gstAmount);
  });

  it("exclusive: identity holds across all standard slab rates", () => {
    for (const rate of GST_RATES) {
      const r = calculateGST({ amount: 1000, rate, mode: "exclusive" });
      expect(r.originalAmount + r.gstAmount, `exclusive rate=${rate}%`).toBe(r.totalAmount);
      expect(r.cgst + r.sgst, `exclusive cgst+sgst rate=${rate}%`).toBe(r.gstAmount);
    }
  });

  it("inclusive: identity holds across all standard slab rates", () => {
    // Use amounts that are exact multiples of (100 + rate) for clean division
    const testAmounts: Record<number, number> = {
      3: 10300,
      5: 2100,
      12: 1120,
      18: 1180,
      28: 6400,
    };
    for (const rate of GST_RATES) {
      const r = calculateGST({ amount: testAmounts[rate], rate, mode: "inclusive" });
      expect(r.originalAmount + r.gstAmount, `inclusive rate=${rate}%`).toBe(r.totalAmount);
      expect(r.cgst + r.sgst, `inclusive cgst+sgst rate=${rate}%`).toBe(r.gstAmount);
    }
  });

  it("gstAmount is always non-negative", () => {
    for (const rate of GST_RATES) {
      const excl = calculateGST({ amount: 500, rate, mode: "exclusive" });
      const incl = calculateGST({ amount: 500, rate, mode: "inclusive" });
      expect(excl.gstAmount).toBeGreaterThanOrEqual(0);
      expect(incl.gstAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it("cgst and sgst are always non-negative", () => {
    for (const rate of GST_RATES) {
      const r = calculateGST({ amount: 1000, rate, mode: "exclusive" });
      expect(r.cgst).toBeGreaterThanOrEqual(0);
      expect(r.sgst).toBeGreaterThanOrEqual(0);
    }
  });

  it("igst always equals gstAmount", () => {
    for (const rate of GST_RATES) {
      const r = calculateGST({ amount: 1000, rate, mode: "exclusive" });
      expect(r.igst).toBe(r.gstAmount);
    }
  });

  // ── 300 randomised exclusive scenarios ────────────────────────────────────

  it("300 randomised exclusive scenarios — all accounting identities hold", () => {
    let s = 0xdeadc0de;
    function rand() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    }

    for (let i = 0; i < 300; i++) {
      const amount = Math.floor(rand() * 10_000_00) / 100 + 1; // ₹1 – ₹100,000
      const rate = Math.floor(rand() * 10001) / 100; // 0 – 100%
      if (rate > 100) continue;

      const r = calculateGST({ amount, rate, mode: "exclusive" });

      expect(r.originalAmount + r.gstAmount, `exclusive P=${amount} r=${rate}%`).toBe(
        r.totalAmount
      );

      expect(r.cgst + r.sgst, `exclusive CGST+SGST P=${amount} r=${rate}%`).toBe(r.gstAmount);

      expect(r.gstAmount).toBeGreaterThanOrEqual(0);
      expect(r.cgst).toBeGreaterThanOrEqual(0);
      expect(r.sgst).toBeGreaterThanOrEqual(0);
      expect(r.igst).toBe(r.gstAmount);
    }
  });

  // ── 300 randomised inclusive scenarios ────────────────────────────────────

  it("300 randomised inclusive scenarios — all accounting identities hold", () => {
    let s = 0xbadc0ffe;
    function rand() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    }

    for (let i = 0; i < 300; i++) {
      const amount = Math.floor(rand() * 10_000_00) / 100 + 1;
      // Use realistic GST rates (0–28%) to keep derived values meaningful
      const rate = Math.floor(rand() * 2801) / 100; // 0 – 28%

      const r = calculateGST({ amount, rate, mode: "inclusive" });

      expect(r.originalAmount + r.gstAmount, `inclusive P=${amount} r=${rate}%`).toBe(
        r.totalAmount
      );

      expect(r.cgst + r.sgst, `inclusive CGST+SGST P=${amount} r=${rate}%`).toBe(r.gstAmount);

      expect(r.gstAmount).toBeGreaterThanOrEqual(0);
      expect(r.originalAmount).toBeGreaterThanOrEqual(0);
      expect(r.igst).toBe(r.gstAmount);
    }
  });

  // ── 200 high-rate exclusive scenarios ─────────────────────────────────────

  it("200 high-rate exclusive scenarios (28–100%) — identities hold", () => {
    let s = 0xf00dcafe;
    function rand() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    }

    for (let i = 0; i < 200; i++) {
      const amount = Math.floor(rand() * 1_000_00) / 100 + 1;
      const rate = 28 + Math.floor(rand() * 7201) / 100; // 28–100%
      if (rate > 100) continue;

      const r = calculateGST({ amount, rate, mode: "exclusive" });

      expect(r.originalAmount + r.gstAmount).toBe(r.totalAmount);
      expect(r.cgst + r.sgst).toBe(r.gstAmount);
    }
  });
});

// ── validateGSTInputs ─────────────────────────────────────────────────────────

describe("validateGSTInputs", () => {
  it("returns no errors for valid inputs (₹1,000 @ 18%)", () => {
    expect(validateGSTInputs(1000, 18)).toEqual({});
  });

  it("returns no errors for 0% rate (nil-rated goods)", () => {
    expect(validateGSTInputs(1000, 0)).toEqual({});
  });

  it("returns no errors for rate = 100 (upper boundary)", () => {
    expect(validateGSTInputs(1000, 100)).toEqual({});
  });

  it("returns no errors for custom fractional rate (7.5%)", () => {
    expect(validateGSTInputs(5000, 7.5)).toEqual({});
  });

  it("returns error for amount = 0", () => {
    const err = validateGSTInputs(0, 18);
    expect(err.amount).toMatch(/greater than/i);
  });

  it("returns error for negative amount", () => {
    const err = validateGSTInputs(-100, 18);
    expect(err.amount).toMatch(/greater than/i);
  });

  it("returns error for amount exceeding ₹100 crore", () => {
    const err = validateGSTInputs(1_000_000_001, 18);
    expect(err.amount).toMatch(/cannot exceed/i);
  });

  it("returns error for NaN rate (empty custom rate)", () => {
    const err = validateGSTInputs(1000, NaN);
    expect(err.rate).toMatch(/valid/i);
  });

  it("returns error for negative rate", () => {
    const err = validateGSTInputs(1000, -1);
    expect(err.rate).toMatch(/cannot be negative/i);
  });

  it("returns error for rate exceeding 100%", () => {
    const err = validateGSTInputs(1000, 101);
    expect(err.rate).toMatch(/cannot exceed 100/i);
  });

  it("can return both amount and rate errors simultaneously", () => {
    const err = validateGSTInputs(0, -1);
    expect(err.amount).toBeDefined();
    expect(err.rate).toBeDefined();
  });
});

// ── formatINR ─────────────────────────────────────────────────────────────────

describe("formatINR", () => {
  it("includes the rupee symbol", () => {
    expect(formatINR(1000)).toContain("₹");
  });

  it("formats with 2 decimal places", () => {
    const result = formatINR(1000);
    expect(result).toMatch(/1,000\.00/);
  });

  it("formats paise precision correctly", () => {
    expect(formatINR(999.99)).toContain("999.99");
  });

  it("uses Indian numbering groups (lakhs)", () => {
    expect(formatINR(1234567.89)).toMatch(/12,34,567/);
  });

  it("formats zero as ₹0.00", () => {
    expect(formatINR(0)).toMatch(/0\.00/);
  });
});

// ── GST_RATES ─────────────────────────────────────────────────────────────────

describe("GST_RATES", () => {
  it("contains all five standard slab rates", () => {
    expect(GST_RATES).toContain(3);
    expect(GST_RATES).toContain(5);
    expect(GST_RATES).toContain(12);
    expect(GST_RATES).toContain(18);
    expect(GST_RATES).toContain(28);
  });

  it("has exactly 5 rates", () => {
    expect(GST_RATES).toHaveLength(5);
  });

  it("rates are in ascending order", () => {
    for (let i = 1; i < GST_RATES.length; i++) {
      expect(GST_RATES[i]).toBeGreaterThan(GST_RATES[i - 1]);
    }
  });
});

/**
 * Income Tax API contract tests — BUILD-001.
 *
 * The API boundary must validate untrusted input into a typed envelope (never
 * throw), stay decoupled from the UI model, and produce the same numbers as the
 * engine for equivalent input.
 */

import { describe, it, expect } from "vitest";
import { computeIncomeTax, API_VERSION } from "@/lib/incomeTaxApi";
import { calculateIncomeTax } from "@/lib/incomeTax";

describe("computeIncomeTax — success", () => {
  it("computes from a minimal request and matches the engine", () => {
    const res = computeIncomeTax({ income: { salary: 2000000 } });
    expect(res.ok).toBe(true);
    expect(res.apiVersion).toBe(API_VERSION);
    const engine = calculateIncomeTax({
      annualSalary: 2000000,
      otherIncome: 0,
      section80C: 0,
      section80D: 0,
      hraExemption: 0,
      homeLoanInterest: 0,
      professionalTax: 0,
      otherDeductions: 0,
    });
    expect(res.result!.new.totalTax).toBe(engine.new.totalTax);
    expect(res.result!.attribution.assessmentYear).toBe("2026-27");
  });

  it("maps deductions and honours the assessment year", () => {
    const res = computeIncomeTax({
      assessmentYear: "2025-26",
      income: { salary: 775000 },
    });
    expect(res.ok).toBe(true);
    expect(res.result!.new.totalTax).toBe(0);
    expect(res.result!.attribution.assessmentYear).toBe("2025-26");
  });

  it("stamps computedAt only when a clock is supplied", () => {
    const now = new Date("2026-07-18T00:00:00.000Z");
    const res = computeIncomeTax({ income: { salary: 1000000 } }, { now });
    expect(res.result!.attribution.computedAt).toBe(now.toISOString());
  });
});

describe("computeIncomeTax — validation (never throws)", () => {
  it("rejects an unsupported assessment year", () => {
    const res = computeIncomeTax({ assessmentYear: "1999-00", income: { salary: 100 } });
    expect(res.ok).toBe(false);
    expect(res.errors!.some((e) => e.code === "unsupported_assessment_year")).toBe(true);
  });

  it("rejects a non-numeric salary", () => {
    const res = computeIncomeTax({ income: { salary: "lots" as unknown as number } });
    expect(res.ok).toBe(false);
    expect(res.errors![0].field).toBe("income.salary");
  });

  it("rejects negative values", () => {
    const res = computeIncomeTax({ income: { salary: -1 }, deductions: { section80C: -5 } });
    expect(res.ok).toBe(false);
    expect(res.errors!.some((e) => e.code === "negative_value")).toBe(true);
  });

  it("rejects a non-finite number without throwing", () => {
    const res = computeIncomeTax({ income: { salary: Infinity } });
    expect(res.ok).toBe(false);
    expect(res.errors![0].code).toBe("invalid_number");
  });

  it("accepts a valid request with all deductions omitted", () => {
    const res = computeIncomeTax({ income: { salary: 500000 } });
    expect(res.ok).toBe(true);
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateAge,
  ageDifference,
  validateAgeInputs,
  resultToCSV,
  isLeapYear,
  daysInMonth,
  daysBetween,
  addMonths,
  birthdayInYear,
  isValidDate,
  parseDate,
  type DateParts,
} from "@/lib/age";

function lcg(seed: number) {
  let s = seed >>> 0;
  return (max: number, min = 0): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return Math.floor(min + (s / 0x100000000) * (max - min));
  };
}

const d = (year: number, month: number, day: number): DateParts => ({ year, month, day });

// ── Calendar primitives ───────────────────────────────────────────────────────

describe("calendar primitives", () => {
  it("isLeapYear follows the Gregorian rule", () => {
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
    expect(isLeapYear(1900)).toBe(false); // divisible by 100, not 400
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });

  it("daysInMonth is leap-aware for February", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
  });

  it("daysBetween counts leap days exactly", () => {
    expect(daysBetween(d(2000, 2, 28), d(2000, 3, 1))).toBe(2); // leap
    expect(daysBetween(d(2001, 2, 28), d(2001, 3, 1))).toBe(1); // common
  });

  it("addMonths clamps to month end", () => {
    expect(addMonths(d(2000, 1, 31), 1)).toEqual(d(2000, 2, 29)); // Jan 31 + 1m = Feb 29 (leap)
    expect(addMonths(d(2001, 1, 31), 1)).toEqual(d(2001, 2, 28));
    expect(addMonths(d(2020, 12, 15), 1)).toEqual(d(2021, 1, 15)); // year rollover
  });

  it("isValidDate rejects impossible dates", () => {
    expect(isValidDate(d(2023, 2, 29))).toBe(false);
    expect(isValidDate(d(2024, 2, 29))).toBe(true);
    expect(isValidDate(d(2024, 13, 1))).toBe(false);
    expect(isValidDate(d(2024, 4, 31))).toBe(false);
  });
});

// ── Known-value age ────────────────────────────────────────────────────────────

describe("calculateAge — known values", () => {
  it("standard age in y/m/d", () => {
    const r = calculateAge(d(1990, 5, 15), d(2026, 7, 7));
    expect([r.years, r.months, r.days]).toEqual([36, 1, 22]);
    expect(r.dayOfBirth).toBe("Tuesday");
  });

  it("month-end birth resolves correctly (Jan 31 → Mar 1)", () => {
    const r = calculateAge(d(2000, 1, 31), d(2000, 3, 1));
    expect([r.years, r.months, r.days]).toEqual([0, 1, 1]);
  });

  it("birthday today gives whole years and a same-day next birthday", () => {
    const r = calculateAge(d(2000, 7, 7), d(2026, 7, 7));
    expect([r.years, r.months, r.days]).toEqual([26, 0, 0]);
    expect(r.nextBirthday.isToday).toBe(true);
    expect(r.nextBirthday.daysUntil).toBe(0);
    expect(r.nextBirthday.turningAge).toBe(26);
  });

  it("total units are day-derived and leap-accurate", () => {
    const r = calculateAge(d(2000, 7, 7), d(2026, 7, 7));
    expect(r.totalDays).toBe(9496);
    expect(r.totalWeeks).toBe(Math.floor(9496 / 7));
    expect(r.totalHours).toBe(9496 * 24);
    expect(r.totalMinutes).toBe(9496 * 24 * 60);
    expect(r.totalSeconds).toBe(9496 * 24 * 60 * 60);
    expect(r.totalMonths).toBe(312);
  });

  it("Feb-29 birthday is observed on Mar 1 in common years", () => {
    const r = calculateAge(d(2004, 2, 29), d(2026, 2, 15));
    expect(r.nextBirthday.date).toEqual(d(2026, 3, 1));
    expect(r.nextBirthday.turningAge).toBe(22);
    expect(birthdayInYear(d(2004, 2, 29), 2024)).toEqual(d(2024, 2, 29)); // leap year keeps Feb 29
  });

  it("newborn (same day) is all zeros", () => {
    const r = calculateAge(d(2026, 7, 7), d(2026, 7, 7));
    expect([r.years, r.months, r.days, r.totalDays]).toEqual([0, 0, 0, 0]);
  });
});

// ── Age difference ──────────────────────────────────────────────────────────────

describe("ageDifference", () => {
  it("is symmetric and identifies the older date", () => {
    const a = ageDifference(d(1990, 5, 15), d(1993, 8, 20));
    const b = ageDifference(d(1993, 8, 20), d(1990, 5, 15));
    expect(a.older).toBe("first");
    expect(b.older).toBe("second");
    expect([a.years, a.months, a.days]).toEqual([b.years, b.months, b.days]);
    expect(a.totalDays).toBe(b.totalDays);
    expect(a.totalDays).toBe(1193);
  });

  it("reports 'same' for identical dates", () => {
    const r = ageDifference(d(2000, 1, 1), d(2000, 1, 1));
    expect(r.older).toBe("same");
    expect(r.totalDays).toBe(0);
  });
});

// ── Randomized property tests ────────────────────────────────────────────────────

describe("calculateAge — 2000 randomized scenarios (seed 0xa9e)", () => {
  it("invariants hold", () => {
    const rng = lcg(0xa9e);
    let fail = 0;
    for (let i = 0; i < 2000; i++) {
      const by = rng(2020, 1920);
      const bm = rng(13, 1);
      const bd = rng(daysInMonth(by, bm) + 1, 1);
      const birth = d(by, bm, bd);
      // asOf = birth + random offset days (guarantees asOf >= birth)
      const offset = rng(40000, 0);
      const t = new Date(Date.UTC(by, bm - 1, bd) + offset * 86_400_000);
      const asOf = d(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());

      const r = calculateAge(birth, asOf);

      if (r.years < 0 || r.months < 0 || r.months > 11 || r.days < 0 || r.days > 31) fail++;
      if (r.totalDays !== offset) fail++;
      if (r.totalDays !== daysBetween(birth, asOf)) fail++;
      if (r.totalHours !== r.totalDays * 24) fail++;
      if (r.totalMinutes !== r.totalDays * 1440) fail++;
      if (r.totalSeconds !== r.totalDays * 86400) fail++;
      if (r.totalWeeks !== Math.floor(r.totalDays / 7)) fail++;
      if (r.totalMonths !== r.years * 12 + r.months) fail++;
      // anchor + residual days reconstructs asOf exactly
      if (daysBetween(addMonths(birth, r.totalMonths), asOf) !== r.days) fail++;
      // next birthday
      const nb = r.nextBirthday;
      if (nb.daysUntil < 0 || nb.daysUntil > 366) fail++;
      if (nb.isToday ? nb.turningAge !== r.years : nb.turningAge !== r.years + 1) fail++;
    }
    expect(fail).toBe(0);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("validateAgeInputs", () => {
  const asOf = d(2026, 7, 7);
  it("valid inputs → no errors", () => {
    expect(validateAgeInputs(d(1990, 1, 1), asOf)).toEqual({});
  });
  it("missing dob → error", () => {
    expect(validateAgeInputs(null, asOf).dob).toBeDefined();
  });
  it("future dob → error", () => {
    expect(validateAgeInputs(d(2030, 1, 1), asOf).dob).toMatch(/future/i);
  });
  it("invalid second date in compare mode → error", () => {
    expect(validateAgeInputs(d(1990, 1, 1), asOf, null).dob2).toBeDefined();
  });
});

// ── Parsing + CSV ────────────────────────────────────────────────────────────────

describe("parseDate", () => {
  it("parses valid ISO dates and rejects invalid ones", () => {
    expect(parseDate("1990-05-15")).toEqual(d(1990, 5, 15));
    expect(parseDate("2023-02-29")).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
  });
});

describe("resultToCSV", () => {
  it("includes the key rows", () => {
    const birth = d(1990, 5, 15);
    const asOf = d(2026, 7, 7);
    const csv = resultToCSV(birth, asOf, calculateAge(birth, asOf));
    expect(csv).toContain("Date of Birth");
    expect(csv).toContain("Total Days");
    expect(csv).toContain("Next Birthday");
    expect(csv.split("\n").length).toBeGreaterThan(10);
  });
});

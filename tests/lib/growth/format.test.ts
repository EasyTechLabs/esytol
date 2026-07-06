// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatPercent,
  formatPosition,
  formatDurationSec,
  relativeTime,
  hashString,
  seededInt,
  seededUnit,
} from "@/lib/growth/format";

describe("format helpers", () => {
  it("formats compact numbers", () => {
    expect(formatNumber(950)).toBe("950");
    expect(formatNumber(12_300)).toBe("12.3K");
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });

  it("formats percent, position and duration", () => {
    expect(formatPercent(0.0412)).toBe("4.1%");
    expect(formatPosition(18.36)).toBe("18.4");
    expect(formatDurationSec(83)).toBe("1m 23s");
    expect(formatDurationSec(45)).toBe("45s");
  });

  it("formats relative time", () => {
    const now = new Date("2026-07-06T12:00:00Z");
    expect(relativeTime("2026-07-06T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-07-06T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-07-04T12:00:00Z", now)).toBe("2d ago");
  });
});

describe("deterministic seeds", () => {
  it("hashString is stable and unsigned", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).toBeGreaterThanOrEqual(0);
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  it("seededUnit is in [0,1] and seededInt within range", () => {
    for (const s of ["/", "/tools/emi", "x", "learn"]) {
      const u = seededUnit(s, "salt");
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      const n = seededInt(s, 5, 10, "salt");
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(10);
    }
  });
});

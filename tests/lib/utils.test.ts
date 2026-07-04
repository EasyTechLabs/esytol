import { describe, it, expect } from "vitest";
import { slugToTitle, truncate, formatNumber } from "@/lib/utils";

describe("slugToTitle()", () => {
  it("converts a single-word slug", () => {
    expect(slugToTitle("tools")).toBe("Tools");
  });

  it("converts a multi-word slug", () => {
    expect(slugToTitle("json-formatter")).toBe("Json Formatter");
  });
});

describe("truncate()", () => {
  it("leaves short text unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long text and appends ellipsis", () => {
    const result = truncate("hello world", 7);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(8);
  });
});

describe("formatNumber()", () => {
  it("formats thousands with a comma", () => {
    expect(formatNumber(5000)).toBe("5,000");
  });

  it("formats small numbers without separators", () => {
    expect(formatNumber(42)).toBe("42");
  });
});

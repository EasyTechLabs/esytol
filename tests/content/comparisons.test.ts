/**
 * Comparison dataset tests (REVENUE-001).
 *
 * The honesty contract is asserted, not remembered:
 * - every option has real cons and a real "avoid if" — an option that suits
 *   everyone is an advert;
 * - every comparison carries a disclosure;
 * - no sponsored/affiliate links exist until a real partnership does;
 * - every placement slug is a real article.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { comparisonsBySlug, comparisonsFor } from "@/content/comparisons";

const allComparisons = Object.values(comparisonsBySlug).flat();
const uniqueComparisons = [...new Map(allComparisons.map((c) => [c.id, c])).values()];

describe("comparison placements", () => {
  it("every placement slug is a real article", () => {
    const articleDir = path.join(process.cwd(), "content", "articles");
    for (const slug of Object.keys(comparisonsBySlug)) {
      expect(fs.existsSync(path.join(articleDir, `${slug}.md`)), slug).toBe(true);
    }
  });

  it("returns an empty list for slugs without comparisons", () => {
    expect(comparisonsFor("what-is-epf")).toEqual([]);
    expect(comparisonsFor("nonexistent")).toEqual([]);
  });

  it("only appears on commercial/decision pages, never pure explainers", () => {
    const explainers = ["what-is-epf", "what-is-nps", "what-is-hra", "what-is-gratuity"];
    for (const slug of explainers) {
      expect(comparisonsFor(slug), slug).toHaveLength(0);
    }
  });
});

describe("the honesty contract", () => {
  it.each(uniqueComparisons.map((c) => [c.id, c] as const))(
    "%s: every option carries pros, cons, bestFor and avoidIf",
    (_id, comparison) => {
      expect(comparison.options.length).toBeGreaterThanOrEqual(2);
      for (const option of comparison.options) {
        expect(option.pros.length, option.name).toBeGreaterThan(0);
        expect(option.cons.length, `${option.name} must have cons`).toBeGreaterThan(0);
        expect(option.bestFor.length, option.name).toBeGreaterThan(10);
        expect(
          option.avoidIf.length,
          `${option.name} must say who should avoid it`
        ).toBeGreaterThan(10);
      }
    }
  );

  it("every comparison has criteria and a disclosure", () => {
    for (const comparison of uniqueComparisons) {
      expect(comparison.criteria.length, comparison.id).toBeGreaterThanOrEqual(3);
      expect(comparison.disclosure).toMatch(/sponsor|partner/i);
    }
  });

  it("has NO affiliate or sponsored links until a real partnership exists", () => {
    for (const comparison of uniqueComparisons) {
      for (const option of comparison.options) {
        expect(option.link, `${comparison.id}/${option.name}`).toBeUndefined();
      }
    }
  });

  it("pricing fields state only structural facts (free/statutory/regulation)", () => {
    for (const comparison of uniqueComparisons) {
      for (const option of comparison.options) {
        if (option.pricing) {
          expect(option.pricing).toMatch(/free|statutory|regulation|mandate/i);
        }
      }
    }
  });
});

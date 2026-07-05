import { describe, it, expect } from "vitest";
import { methodology, getMethodology } from "@/content/methodology";
import { getLiveTools } from "@/registry";

const LIVE_CALCULATOR_SLUGS = getLiveTools()
  .filter((t) => t.category === "calculator")
  .map((t) => t.slug);

describe("methodology dataset", () => {
  it("covers every live calculator", () => {
    for (const slug of LIVE_CALCULATOR_SLUGS) {
      expect(getMethodology(slug), `missing methodology for ${slug}`).toBeDefined();
    }
  });

  it("every entry has a complete, non-empty structure", () => {
    for (const [slug, m] of Object.entries(methodology)) {
      expect(m.formula.trim().length, `${slug} formula`).toBeGreaterThan(0);
      expect(m.method.trim().length, `${slug} method`).toBeGreaterThan(0);
      expect(m.reviewedBy.trim().length, `${slug} reviewedBy`).toBeGreaterThan(0);
      expect(m.sources.length, `${slug} sources`).toBeGreaterThan(0);
      expect(m.assumptions.length, `${slug} assumptions`).toBeGreaterThan(0);
      expect(m.limitations.length, `${slug} limitations`).toBeGreaterThan(0);
      for (const s of m.sources) {
        expect(s.label.trim().length, `${slug} source label`).toBeGreaterThan(0);
        if (s.url) expect(s.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("references official regulators/authorities where relevant", () => {
    const emi = getMethodology("emi-calculator")!;
    expect(emi.sources.some((s) => s.label.includes("RBI"))).toBe(true);
    const sip = getMethodology("sip-calculator")!;
    expect(sip.sources.some((s) => s.label.includes("AMFI"))).toBe(true);
    const gst = getMethodology("gst-calculator")!;
    expect(gst.sources.some((s) => /GST|CBIC/.test(s.label))).toBe(true);
  });

  it("returns undefined for an unknown slug", () => {
    expect(getMethodology("does-not-exist")).toBeUndefined();
  });
});

/**
 * Domain tests.
 *
 * The important one is coverage: a live tool matching no domain is **invisible** on
 * the homepage while looking perfectly healthy everywhere else. That is a silent
 * failure, so it gets an assertion rather than a code review. (It already happened
 * once — FD and RD carry "savings"/"bank" but no "finance" tag.)
 */

import { describe, it, expect } from "vitest";
import { DOMAINS, getLiveDomains, toolsInDomain, domainForTool } from "@/registry/domains";
import { getLiveTools } from "@/registry";

describe("Domains", () => {
  it("places every live tool in exactly one browsable domain", () => {
    const unmatched = getLiveTools().filter((t) => domainForTool(t) === null);
    expect(unmatched.map((t) => t.slug)).toEqual([]);
  });

  it("never shows a domain with no live tools", () => {
    for (const d of getLiveDomains()) expect(d.toolCount).toBeGreaterThan(0);
  });

  it("counts add up to the live tool count", () => {
    const total = getLiveDomains().reduce((s, d) => s + d.toolCount, 0);
    // Domains partition the live tools: first match wins, so no double counting.
    expect(total).toBe(getLiveTools().length);
  });

  it("surfaces Finance and Everyday today", () => {
    const names = getLiveDomains().map((d) => d.name);
    expect(names).toContain("Finance");
    expect(names).toContain("Everyday");
  });

  it("ranks Finance first — it is the strongest category", () => {
    expect(getLiveDomains()[0].name).toBe("Finance");
  });

  it("leaves the format taxonomy untouched", () => {
    // Domains are a view, not a migration. If this fails, someone retagged tools and
    // the E-E-A-T trust surface (gated on category === "calculator") is now missing.
    expect(getLiveTools().every((t) => t.category === "calculator")).toBe(true);
  });

  it("keeps the Age Calculator out of Finance", () => {
    expect(domainForTool(getLiveTools().find((t) => t.slug === "age-calculator")!)?.slug).toBe(
      "everyday"
    );
  });

  it("puts FD and RD in Finance despite having no 'finance' tag", () => {
    const finance = DOMAINS.find((d) => d.slug === "finance")!;
    const slugs = toolsInDomain(finance).map((t) => t.slug);
    expect(slugs).toContain("fd-calculator");
    expect(slugs).toContain("rd-calculator");
  });
});

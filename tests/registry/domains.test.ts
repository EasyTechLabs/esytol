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

  it("surfaces Finance, Everyday and Developer today", () => {
    const names = getLiveDomains().map((d) => d.name);
    expect(names).toContain("Finance");
    expect(names).toContain("Everyday");
    // PLATFORM-003 made Developer the platform's second major category.
    expect(names).toContain("Developer");
  });

  it("ranks Finance first — it is the strongest category", () => {
    expect(getLiveDomains()[0].name).toBe("Finance");
  });

  it("keeps every Finance tool a calculator (protects the E-E-A-T trust surface)", () => {
    // Domains are a view, not a migration. The finance trust surface is gated on
    // category === "calculator"; if a finance tool ever loses that category it
    // silently loses methodology, sources, reviewer and disclaimer. Developer
    // tools (PLATFORM-003) intentionally carry other categories and their own
    // trust surface, so the invariant is scoped to the Finance domain.
    const financeTools = toolsInDomain(DOMAINS.find((d) => d.slug === "finance")!);
    expect(financeTools.length).toBeGreaterThan(0);
    expect(financeTools.every((t) => t.category === "calculator")).toBe(true);
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

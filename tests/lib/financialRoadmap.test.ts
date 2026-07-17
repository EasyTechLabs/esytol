/**
 * Financial Roadmap engine tests (PROJECT-002).
 *
 * Profiles cover the realistic spread: fresh graduates, indebted households,
 * protected-but-behind families, and the fully-sorted. Invariants pin the
 * properties that make the tool trustworthy: determinism, the canonical order,
 * gating, honest gaps computed from the user's own numbers, and never a
 * fabricated projection.
 */

import { describe, it, expect } from "vitest";
import {
  buildRoadmap,
  validateRoadmapInputs,
  EMERGENCY_MONTHS_TARGET,
  SAVINGS_RATE_TARGET,
  type RoadmapInput,
  type ActionId,
} from "@/lib/financialRoadmap";

const ORDER: ActionId[] = [
  "emergency-fund",
  "health-insurance",
  "life-insurance",
  "high-interest-debt",
  "tax-optimisation",
  "investing",
  "retirement",
  "wealth-building",
];

function profile(over: Partial<RoadmapInput> = {}): RoadmapInput {
  return {
    age: 30,
    monthlyIncome: 100_000,
    hasPartner: false,
    dependants: 0,
    emergencyFund: 0,
    monthlyExpenses: 50_000,
    monthlyEmi: 0,
    highInterestDebt: 0,
    hasHealthInsurance: false,
    healthCoverLakh: 0,
    hasTermInsurance: false,
    termCoverLakh: 0,
    monthlyInvesting: 0,
    retirementCorpus: 0,
    primaryGoal: "stability",
    ...over,
  };
}

// ── Realistic profiles ───────────────────────────────────────────────────────

const PROFILES: Array<[string, Partial<RoadmapInput>, Partial<Record<string, unknown>>]> = [
  ["fresh graduate, nothing set up", {}, { risk: "high", current: "emergency-fund" }],
  [
    "graduate with 2 months saved",
    { emergencyFund: 100_000 },
    { risk: "high", current: "emergency-fund" },
  ],
  [
    "emergency done, no insurance",
    { emergencyFund: 300_000 },
    { risk: "high", current: "health-insurance" },
  ],
  [
    "single, insured, no debt → tax step",
    { emergencyFund: 300_000, hasHealthInsurance: true, healthCoverLakh: 10 },
    { risk: "medium", current: "tax-optimisation" },
  ],
  [
    "family, health insured, NO term cover",
    {
      hasPartner: true,
      dependants: 2,
      emergencyFund: 300_000,
      hasHealthInsurance: true,
      healthCoverLakh: 10,
    },
    { risk: "high", current: "life-insurance" },
  ],
  [
    "family fully protected, card debt",
    {
      hasPartner: true,
      dependants: 1,
      emergencyFund: 300_000,
      hasHealthInsurance: true,
      healthCoverLakh: 10,
      hasTermInsurance: true,
      termCoverLakh: 120,
      highInterestDebt: 200_000,
    },
    { risk: "high", current: "high-interest-debt" },
  ],
  [
    "protected, debt-free, not yet investing",
    {
      emergencyFund: 300_000,
      hasHealthInsurance: true,
      healthCoverLakh: 10,
    },
    { current: "tax-optimisation" },
  ],
  [
    "strong saver behind on retirement",
    {
      age: 45,
      emergencyFund: 400_000,
      monthlyExpenses: 60_000,
      hasHealthInsurance: true,
      healthCoverLakh: 15,
      hasPartner: true,
      dependants: 2,
      hasTermInsurance: true,
      termCoverLakh: 150,
      monthlyInvesting: 25_000,
      retirementCorpus: 500_000, // far below 3× annual at 45
    },
    { current: "tax-optimisation" },
  ],
  [
    "over-leveraged EMIs",
    {
      emergencyFund: 300_000,
      hasHealthInsurance: true,
      healthCoverLakh: 10,
      monthlyEmi: 55_000,
    },
    {},
  ],
  [
    "young high earner, everything nearly done",
    {
      age: 28,
      monthlyIncome: 300_000,
      emergencyFund: 1_200_000,
      monthlyExpenses: 100_000,
      hasHealthInsurance: true,
      healthCoverLakh: 25,
      monthlyInvesting: 90_000,
      retirementCorpus: 4_000_000,
    },
    { risk: "low" }, // fully protected + funded: low risk (the pending tax step is a ritual, not a risk)
  ],
];

describe("realistic profiles", () => {
  it.each(PROFILES)("%s", (_name, over, expected) => {
    const result = buildRoadmap(profile(over));
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    if (expected.risk) expect(result.riskLevel).toBe(expected.risk);
    if (expected.current) expect(result.currentActionId).toBe(expected.current);
  });
});

// ── Ordering invariants ──────────────────────────────────────────────────────

describe("ordering", () => {
  it("always emits all eight steps in the canonical order", () => {
    const result = buildRoadmap(profile());
    expect(result.actions.map((a) => a.id)).toEqual(ORDER);
    expect(result.actions.map((a) => a.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("current action is always the FIRST pending applicable step", () => {
    for (const [, over] of PROFILES) {
      const result = buildRoadmap(profile(over));
      const firstPending = result.actions.find((a) => a.status === "pending");
      expect(result.currentActionId).toBe(firstPending?.id ?? null);
    }
  });

  it("dependencies only ever point at earlier steps", () => {
    const result = buildRoadmap(profile());
    for (const action of result.actions) {
      for (const dep of action.dependencies) {
        expect(ORDER.indexOf(dep)).toBeLessThan(ORDER.indexOf(action.id));
      }
    }
  });
});

// ── Gating and applicability ────────────────────────────────────────────────

describe("gating", () => {
  it("term life is not-applicable with no partner and no dependants", () => {
    const result = buildRoadmap(profile({ hasPartner: false, dependants: 0 }));
    const term = result.actions.find((a) => a.id === "life-insurance")!;
    expect(term.status).toBe("not-applicable");
    expect(term.notApplicableReason).toMatch(/depends on your income/i);
  });

  it("term life becomes pending the moment there are dependants", () => {
    const result = buildRoadmap(profile({ dependants: 1 }));
    expect(result.actions.find((a) => a.id === "life-insurance")!.status).toBe("pending");
  });

  it("not-applicable steps are excluded from completion arithmetic", () => {
    const single = buildRoadmap(profile());
    expect(single.applicableCount).toBe(7); // 8 minus term life
    const family = buildRoadmap(profile({ dependants: 1 }));
    expect(family.applicableCount).toBe(8);
  });

  it("emergency fund completes exactly at the target multiple", () => {
    const at = buildRoadmap(profile({ emergencyFund: 50_000 * EMERGENCY_MONTHS_TARGET }));
    expect(at.actions[0].status).toBe("done");
    const below = buildRoadmap(profile({ emergencyFund: 50_000 * EMERGENCY_MONTHS_TARGET - 1 }));
    expect(below.actions[0].status).toBe("pending");
  });

  it("investing completes at the savings-rate benchmark", () => {
    const result = buildRoadmap(profile({ monthlyInvesting: 100_000 * SAVINGS_RATE_TARGET }));
    expect(result.actions.find((a) => a.id === "investing")!.status).toBe("done");
  });
});

// ── Honesty invariants ──────────────────────────────────────────────────────

describe("honesty", () => {
  it("is deterministic: same input, same output", () => {
    const input = profile({ dependants: 2, emergencyFund: 123_456, highInterestDebt: 42_000 });
    expect(buildRoadmap(input)).toEqual(buildRoadmap(input));
  });

  it("gap amounts derive from the user's own numbers", () => {
    const result = buildRoadmap(profile({ emergencyFund: 100_000, monthlyExpenses: 50_000 }));
    expect(result.actions[0].gapAmount).toBe(50_000 * EMERGENCY_MONTHS_TARGET - 100_000);
  });

  it("never emits a percentage-return projection", () => {
    for (const [, over] of PROFILES) {
      const result = buildRoadmap(profile(over));
      for (const action of result.actions) {
        // No "12% returns", "grow to ₹X by 20YY" style claims anywhere.
        expect(action.expectedBenefit).not.toMatch(/\d+\s*%\s*(return|growth|cagr)/i);
        expect(action.whyItMatters).not.toMatch(/will (grow|become|reach)/i);
      }
    }
  });

  it("never names a product or fund", () => {
    const result = buildRoadmap(profile({ dependants: 1, highInterestDebt: 50_000 }));
    const text = JSON.stringify(result.actions);
    expect(text).not.toMatch(/HDFC|ICICI|SBI|Nippon|Axis|Zerodha|Groww/i);
  });

  it("every action explains why, benefit, effort, and dependencies", () => {
    const result = buildRoadmap(profile({ dependants: 1 }));
    for (const action of result.actions) {
      expect(action.whyItMatters.length).toBeGreaterThan(40);
      expect(action.expectedBenefit.length).toBeGreaterThan(20);
      expect(["S", "M", "L"]).toContain(action.effort);
      expect(Array.isArray(action.dependencies)).toBe(true);
      expect(action.links.length).toBeGreaterThan(0);
    }
  });

  it("every link points inside the platform", () => {
    const result = buildRoadmap(profile({ dependants: 1 }));
    for (const action of result.actions) {
      for (const link of action.links) {
        expect(link.href).toMatch(/^\/(tools|learn)\//);
      }
    }
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("completion never reaches 100% (tax is a yearly ritual; wealth is ongoing)", () => {
    const everything = buildRoadmap(
      profile({
        emergencyFund: 10_000_000,
        hasHealthInsurance: true,
        healthCoverLakh: 50,
        monthlyInvesting: 50_000,
        retirementCorpus: 50_000_000,
      })
    );
    expect(everything.completionPct).toBeLessThan(100);
    expect(everything.currentActionId).toBe("tax-optimisation");
  });

  it("zero emergency fund with debt and dependants is high risk from every angle", () => {
    const result = buildRoadmap(
      profile({ dependants: 3, highInterestDebt: 500_000, emergencyFund: 0 })
    );
    expect(result.riskLevel).toBe("high");
    expect(result.healthScore).toBeLessThan(30);
  });

  it("validation rejects impossible inputs", () => {
    const bad = validateRoadmapInputs(profile({ age: 12, monthlyIncome: 0, emergencyFund: -5 }));
    expect(bad.age).toBeTruthy();
    expect(bad.monthlyIncome).toBeTruthy();
    expect(bad.emergencyFund).toBeTruthy();
  });

  it("validation flags expenses wildly above income", () => {
    const bad = validateRoadmapInputs(profile({ monthlyExpenses: 600_000 }));
    expect(bad.monthlyExpenses).toMatch(/check/i);
  });

  it("clean inputs validate clean", () => {
    expect(validateRoadmapInputs(profile())).toEqual({});
  });

  it("age bands shift the retirement target ladder", () => {
    const young = buildRoadmap(profile({ age: 25, retirementCorpus: 1_200_000 }));
    const older = buildRoadmap(profile({ age: 55, retirementCorpus: 1_200_000 }));
    const youngRet = young.actions.find((a) => a.id === "retirement")!;
    const olderRet = older.actions.find((a) => a.id === "retirement")!;
    expect(youngRet.status).toBe("done"); // 1× annual at ≤30
    expect(olderRet.status).toBe("pending"); // 8× annual at ≤60
    expect(olderRet.gapAmount).toBe(100_000 * 12 * 8 - 1_200_000);
  });

  it("timeline is an effort range, never 'complete' while tax remains", () => {
    const result = buildRoadmap(profile());
    expect(result.estimatedTimeline).toMatch(/weeks|months|ongoing/);
  });
});

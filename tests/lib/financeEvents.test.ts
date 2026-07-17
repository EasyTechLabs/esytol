/**
 * Unified finance event model tests (PLATFORM-002).
 *
 * These pin the platform's core promise: every number originates from one
 * engine, deltas mutate exactly one field, projections never write, and the
 * before/after a user sees comes from the same buildRoadmap() the dashboard
 * renders. Everything runs through the real localStorage store (jsdom).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  describeEvent,
  recordEvent,
  proposeDelta,
  applyEventDelta,
  eventInsights,
  nextSteps,
  type FinanceEvent,
} from "@/lib/financeEvents";
import { buildRoadmap, EMI_RATIO_CEILING, type RoadmapInput } from "@/lib/financialRoadmap";
import { saveProfile, readStore } from "@/lib/localFinance";

const PROFILE: RoadmapInput = {
  age: 35,
  monthlyIncome: 100_000,
  hasPartner: true,
  dependants: 1,
  emergencyFund: 200_000,
  monthlyExpenses: 50_000,
  monthlyEmi: 10_000,
  highInterestDebt: 0,
  hasHealthInsurance: true,
  healthCoverLakh: 10,
  hasTermInsurance: true,
  termCoverLakh: 100,
  monthlyInvesting: 10_000,
  retirementCorpus: 1_000_000,
  primaryGoal: "wealth",
};

const LOAN: FinanceEvent = {
  type: "LoanCalculated",
  slug: "emi-calculator",
  name: "EMI Calculator",
  emi: 25_000,
  principal: 1_200_000,
  annualRate: 9,
  months: 60,
};

const SIP: FinanceEvent = {
  type: "InvestmentCalculated",
  slug: "sip-calculator",
  name: "SIP Calculator",
  monthlyInvestment: 30_000,
  maturityValue: 5_000_000,
  months: 120,
};

const TAX: FinanceEvent = {
  type: "TaxCompared",
  slug: "income-tax-calculator",
  name: "Income Tax Calculator",
  annualIncome: 1_800_000,
  recommended: "new",
  totalTax: 210_000,
  taxSaved: 15_000,
};

const FD: FinanceEvent = {
  type: "GrowthProjected",
  slug: "fd-calculator",
  name: "FD Calculator",
  invested: 500_000,
  maturityValue: 700_000,
  months: 60,
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("describeEvent — history figures", () => {
  it("states the loan figures without judgement", () => {
    const figs = describeEvent(LOAN);
    expect(figs.find((f) => f.label === "EMI")?.value).toMatch(/25,000\/mo/);
    expect(figs.find((f) => f.label === "Tenure")?.value).toBe("5 yr");
  });

  it("records into history newest-first, deduped by slug", () => {
    recordEvent(LOAN);
    recordEvent(SIP);
    recordEvent({ ...LOAN, emi: 30_000 });
    const calcs = readStore().lastCalculations;
    expect(calcs.map((c) => c.slug)).toEqual(["emi-calculator", "sip-calculator"]);
    expect(calcs[0].figures.find((f) => f.label === "EMI")?.value).toMatch(/30,000/);
  });
});

describe("proposeDelta — one field, explicit, projections never write", () => {
  it("loan proposes monthlyEmi only", () => {
    const d = proposeDelta(LOAN, PROFILE);
    expect(d?.field).toBe("monthlyEmi");
    expect(d?.value).toBe(25_000);
    expect(d?.currentValue).toBe(10_000);
  });

  it("SIP proposes monthlyInvesting only", () => {
    expect(proposeDelta(SIP, PROFILE)?.field).toBe("monthlyInvesting");
  });

  it("tax proposes monthlyIncome = round(annual/12)", () => {
    const d = proposeDelta(TAX, PROFILE);
    expect(d?.field).toBe("monthlyIncome");
    expect(d?.value).toBe(150_000);
  });

  it("a projection (FD/growth) proposes nothing — never writes", () => {
    expect(proposeDelta(FD, PROFILE)).toBeNull();
  });

  it("proposes nothing when the value already matches", () => {
    expect(proposeDelta({ ...LOAN, emi: 10_000 }, PROFILE)).toBeNull();
  });
});

describe("applyEventDelta — one engine, real before/after", () => {
  it("mutates exactly one profile field and leaves the rest intact", () => {
    saveProfile(PROFILE);
    applyEventDelta(LOAN);
    const after = readStore().profile!;
    expect(after.monthlyEmi).toBe(25_000);
    expect({ ...after, monthlyEmi: PROFILE.monthlyEmi }).toEqual(PROFILE);
  });

  it("reports the same score buildRoadmap would compute after the change", () => {
    saveProfile(PROFILE);
    const outcome = applyEventDelta(LOAN)!;
    const expected = buildRoadmap({ ...PROFILE, monthlyEmi: 25_000 });
    expect(outcome.after.healthScore).toBe(expected.healthScore);
    expect(outcome.before.healthScore).toBe(buildRoadmap(PROFILE).healthScore);
  });

  it("emits a score-change notification when the score moves", () => {
    saveProfile(PROFILE);
    const outcome = applyEventDelta(LOAN)!;
    const scoreNote = outcome.notifications.find((n) => n.text.includes("Health Score"));
    expect(scoreNote).toBeDefined();
    expect(scoreNote!.text).toMatch(/\d+ → \d+/);
  });

  it("is a no-op without a saved profile (never invents one)", () => {
    expect(applyEventDelta(LOAN)).toBeNull();
    expect(readStore().profile).toBeNull();
  });
});

describe("eventInsights — deterministic, engine constants only", () => {
  it("flags an EMI above the engine's ratio ceiling", () => {
    saveProfile(PROFILE);
    const insights = eventInsights(LOAN, readStore()); // 25k / 100k = 25%
    const highEmi: FinanceEvent = { ...LOAN, emi: 60_000 }; // 60% > 40%
    const bad = eventInsights(highEmi, readStore());
    expect(bad.some((i) => i.tone === "bad" && /ceiling/.test(i.text))).toBe(true);
    // 25% is under the ceiling, so no "above the ceiling" bad insight
    expect(insights.some((i) => /above the/.test(i.text))).toBe(false);
    expect(EMI_RATIO_CEILING).toBe(0.4);
  });

  it("returns nothing without a profile — never judges against assumptions", () => {
    expect(eventInsights(LOAN, readStore())).toEqual([]);
  });

  it("insights are stable for identical inputs (deterministic)", () => {
    saveProfile(PROFILE);
    expect(eventInsights(SIP, readStore())).toEqual(eventInsights(SIP, readStore()));
  });
});

describe("nextSteps — routes forward, never to self", () => {
  it("without a profile, points to the roadmap", () => {
    const steps = nextSteps(readStore(), "emi-calculator");
    expect(steps[0].href).toBe("/tools/financial-roadmap");
  });

  it("with a profile, surfaces the current milestone and the dashboard", () => {
    saveProfile(PROFILE);
    const steps = nextSteps(readStore(), "emi-calculator");
    expect(steps.some((s) => s.href === "/tools/financial-dashboard")).toBe(true);
    expect(steps.every((s) => s.href !== "/tools/emi-calculator")).toBe(true);
  });

  it("dedupes repeated hrefs", () => {
    saveProfile(PROFILE);
    const steps = nextSteps(readStore(), "sip-calculator");
    const hrefs = steps.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("consistency — no source disagrees", () => {
  it("history capture does not touch the profile or score", () => {
    saveProfile(PROFILE);
    const before = buildRoadmap(readStore().profile!).healthScore;
    recordEvent(LOAN);
    recordEvent(SIP);
    expect(readStore().profile).toEqual(PROFILE);
    expect(buildRoadmap(readStore().profile!).healthScore).toBe(before);
  });

  it("performance: 1000 record+propose cycles stay well under budget", () => {
    saveProfile(PROFILE);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      proposeDelta({ ...LOAN, emi: 20_000 + i }, readStore().profile!);
      recordEvent({ ...LOAN, emi: 20_000 + i });
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

/**
 * Local finance store tests (PROJECT-003).
 *
 * The store is the persistence layer for the personal dashboard, so the tests
 * pin exactly the properties the mission demands: persistence, cross-tool
 * updates, reset, and the edges where browsers get hostile (corrupt JSON,
 * quota errors, wrong versions, no window).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readStore,
  saveProfile,
  recordToolUse,
  recordCalculation,
  applyProfileFields,
  markReviewed,
  reviewDue,
  daysUntilReview,
  clearStore,
  RECENT_LIMIT,
  REVIEW_INTERVAL_DAYS,
  FINANCE_STORAGE_KEY,
} from "@/lib/localFinance";
import type { RoadmapInput } from "@/lib/financialRoadmap";

const NOW = new Date("2026-07-17T10:00:00.000Z");

const PROFILE: RoadmapInput = {
  age: 30,
  monthlyIncome: 100_000,
  hasPartner: false,
  dependants: 0,
  emergencyFund: 300_000,
  monthlyExpenses: 50_000,
  monthlyEmi: 0,
  highInterestDebt: 0,
  hasHealthInsurance: true,
  healthCoverLakh: 10,
  hasTermInsurance: false,
  termCoverLakh: 0,
  monthlyInvesting: 20_000,
  retirementCorpus: 1_000_000,
  primaryGoal: "stability",
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("persistence", () => {
  it("round-trips the profile", () => {
    expect(saveProfile(PROFILE, NOW)).toBe(true);
    const store = readStore();
    expect(store.profile).toEqual(PROFILE);
    expect(store.profileSavedAt).toBe(NOW.toISOString());
  });

  it("reads empty when nothing was ever saved", () => {
    const store = readStore();
    expect(store.profile).toBeNull();
    expect(store.recentTools).toEqual([]);
    expect(store.lastReviewAt).toBeNull();
  });

  it("survives corrupt JSON by reading empty, never throwing", () => {
    window.localStorage.setItem(FINANCE_STORAGE_KEY, "{not json!!");
    expect(() => readStore()).not.toThrow();
    expect(readStore().profile).toBeNull();
  });

  it("treats a wrong version as empty (no partial migrations)", () => {
    window.localStorage.setItem(
      FINANCE_STORAGE_KEY,
      JSON.stringify({ version: 999, profile: PROFILE })
    );
    expect(readStore().profile).toBeNull();
  });

  it("tolerates a throwing localStorage (quota) by returning false", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveProfile(PROFILE, NOW)).toBe(false);
    spy.mockRestore();
  });
});

describe("cross-tool synchronization (recent tools)", () => {
  it("records tool use newest-first", () => {
    recordToolUse("emi-calculator", "EMI Calculator", new Date("2026-07-17T09:00:00Z"));
    recordToolUse("sip-calculator", "SIP Calculator", new Date("2026-07-17T09:05:00Z"));
    const store = readStore();
    expect(store.recentTools.map((t) => t.slug)).toEqual(["sip-calculator", "emi-calculator"]);
  });

  it("dedupes by slug, moving a re-used tool to the front", () => {
    recordToolUse("emi-calculator", "EMI Calculator", NOW);
    recordToolUse("sip-calculator", "SIP Calculator", NOW);
    recordToolUse("emi-calculator", "EMI Calculator", NOW);
    const slugs = readStore().recentTools.map((t) => t.slug);
    expect(slugs).toEqual(["emi-calculator", "sip-calculator"]);
  });

  it("caps the list at RECENT_LIMIT", () => {
    for (let i = 0; i < RECENT_LIMIT + 5; i++) {
      recordToolUse(`tool-${i}`, `Tool ${i}`, NOW);
    }
    expect(readStore().recentTools).toHaveLength(RECENT_LIMIT);
    expect(readStore().recentTools[0].slug).toBe(`tool-${RECENT_LIMIT + 4}`);
  });

  it("tool use does not clobber the saved profile", () => {
    saveProfile(PROFILE, NOW);
    recordToolUse("emi-calculator", "EMI Calculator", NOW);
    expect(readStore().profile).toEqual(PROFILE);
  });
});

describe("the 90-day review", () => {
  it("is not due with no profile", () => {
    expect(reviewDue(readStore(), NOW)).toBe(false);
  });

  it("is due immediately once a profile exists but no review was ever done", () => {
    saveProfile(PROFILE, NOW);
    expect(reviewDue(readStore(), NOW)).toBe(true);
  });

  it("marking reviewed defers it for the interval", () => {
    saveProfile(PROFILE, NOW);
    markReviewed(NOW);
    const store = readStore();
    expect(reviewDue(store, NOW)).toBe(false);
    expect(daysUntilReview(store, NOW)).toBe(REVIEW_INTERVAL_DAYS);
  });

  it("becomes due again after the interval passes", () => {
    saveProfile(PROFILE, NOW);
    markReviewed(NOW);
    const later = new Date(NOW.getTime() + (REVIEW_INTERVAL_DAYS + 1) * 86_400_000);
    expect(reviewDue(readStore(), later)).toBe(true);
    expect(daysUntilReview(readStore(), later)).toBeLessThanOrEqual(0);
  });
});

describe("calculation history (PLATFORM-002)", () => {
  const FIGS = [{ label: "EMI", value: "₹25,000/mo" }];

  it("records a calculation newest-first, deduped by slug, capped", () => {
    for (let i = 0; i < RECENT_LIMIT + 3; i++) {
      recordCalculation(`tool-${i}`, `Tool ${i}`, FIGS, NOW);
    }
    const calcs = readStore().lastCalculations;
    expect(calcs).toHaveLength(RECENT_LIMIT);
    expect(calcs[0].slug).toBe(`tool-${RECENT_LIMIT + 2}`);
  });

  it("re-recording a tool moves it to the front with fresh figures", () => {
    recordCalculation("emi-calculator", "EMI", [{ label: "EMI", value: "₹10,000" }], NOW);
    recordCalculation("sip-calculator", "SIP", FIGS, NOW);
    recordCalculation("emi-calculator", "EMI", [{ label: "EMI", value: "₹20,000" }], NOW);
    const calcs = readStore().lastCalculations;
    expect(calcs.map((c) => c.slug)).toEqual(["emi-calculator", "sip-calculator"]);
    expect(calcs[0].figures[0].value).toBe("₹20,000");
  });

  it("recording a calculation does not disturb the saved profile", () => {
    saveProfile(PROFILE, NOW);
    recordCalculation("emi-calculator", "EMI", FIGS, NOW);
    expect(readStore().profile).toEqual(PROFILE);
  });
});

describe("applyProfileFields (PLATFORM-002)", () => {
  it("merges one field and refreshes the saved timestamp", () => {
    saveProfile(PROFILE, NOW);
    const later = new Date(NOW.getTime() + 1000);
    expect(applyProfileFields({ monthlyEmi: 25_000 }, later)).toBe(true);
    const store = readStore();
    expect(store.profile!.monthlyEmi).toBe(25_000);
    expect(store.profile!.monthlyIncome).toBe(PROFILE.monthlyIncome);
    expect(store.profileSavedAt).toBe(later.toISOString());
  });

  it("is a no-op without a saved profile (a delta cannot invent one)", () => {
    expect(applyProfileFields({ monthlyEmi: 25_000 }, NOW)).toBe(false);
    expect(readStore().profile).toBeNull();
  });
});

describe("reset", () => {
  it("clearStore erases everything, including calculation history", () => {
    saveProfile(PROFILE, NOW);
    recordToolUse("emi-calculator", "EMI Calculator", NOW);
    recordCalculation("emi-calculator", "EMI Calculator", [{ label: "EMI", value: "₹1" }], NOW);
    markReviewed(NOW);
    expect(clearStore()).toBe(true);
    const store = readStore();
    expect(store.profile).toBeNull();
    expect(store.recentTools).toEqual([]);
    expect(store.lastCalculations).toEqual([]);
    expect(store.lastReviewAt).toBeNull();
    expect(window.localStorage.getItem(FINANCE_STORAGE_KEY)).toBeNull();
  });
});

/**
 * Dashboard component tests (PROJECT-003): the success criterion is that a
 * returning visitor sees their position instead of starting from scratch —
 * so the tests exercise empty → populated → review-due → reset, all through
 * real localStorage (jsdom).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FinancialDashboard } from "@/features/tools/financial-dashboard/FinancialDashboard";
import { saveProfile, markReviewed, readStore, recordToolUse } from "@/lib/localFinance";
import type { RoadmapInput } from "@/lib/financialRoadmap";

const PROFILE: RoadmapInput = {
  age: 35,
  monthlyIncome: 150_000,
  hasPartner: true,
  dependants: 2,
  emergencyFund: 900_000, // 6 months of 150k? expenses below: 6 * 90k = 540k → done
  monthlyExpenses: 90_000,
  monthlyEmi: 30_000,
  highInterestDebt: 0,
  hasHealthInsurance: true,
  healthCoverLakh: 15,
  hasTermInsurance: false, // dependants + no term → bad insight expected
  termCoverLakh: 0,
  monthlyInvesting: 35_000,
  retirementCorpus: 2_000_000,
  primaryGoal: "children-education",
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("FinancialDashboard", () => {
  it("shows the empty state with a roadmap CTA when nothing is saved", () => {
    render(<FinancialDashboard />);
    expect(screen.getByText(/dashboard is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /build my roadmap/i })).toHaveAttribute(
      "href",
      "/tools/financial-roadmap"
    );
  });

  it("a returning visitor sees their position immediately", () => {
    saveProfile(PROFILE);
    render(<FinancialDashboard />);
    expect(screen.getByText("Financial Health Score")).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
    expect(screen.getByText("Emergency fund")).toBeInTheDocument();
    expect(screen.getByText(/10\.0 mo/)).toBeInTheDocument(); // 900k / 90k
    expect(screen.getByText("Monthly savings")).toBeInTheDocument();
    expect(screen.getByText(/23%/)).toBeInTheDocument(); // 35k / 150k
  });

  it("derives deterministic insights from the profile", () => {
    saveProfile(PROFILE);
    render(<FinancialDashboard />);
    expect(screen.getByText("Emergency fund complete.")).toBeInTheDocument();
    expect(screen.getByText(/Term life cover missing/)).toBeInTheDocument();
    expect(screen.getByText("Debt ratio healthy.")).toBeInTheDocument();
    expect(screen.getByText(/Retirement savings below target/)).toBeInTheDocument();
  });

  it("tracked net worth uses only tracked figures", () => {
    saveProfile({ ...PROFILE, highInterestDebt: 100_000 });
    render(<FinancialDashboard />);
    // 900k + 2,000k − 100k = 2,800,000
    expect(screen.getByText("₹28,00,000")).toBeInTheDocument();
  });

  it("shows the review banner when due and defers it on 'Mark reviewed'", () => {
    saveProfile(PROFILE); // never reviewed → due
    render(<FinancialDashboard />);
    expect(screen.getByText(/Time for your financial review/)).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /mark reviewed/i }));
    });
    expect(screen.queryByText(/Time for your financial review/)).not.toBeInTheDocument();
    expect(readStore().lastReviewAt).not.toBeNull();
  });

  it("hides the review banner when recently reviewed", () => {
    saveProfile(PROFILE);
    markReviewed();
    render(<FinancialDashboard />);
    expect(screen.queryByText(/Time for your financial review/)).not.toBeInTheDocument();
  });

  it("lists recently used tools as links", () => {
    saveProfile(PROFILE);
    recordToolUse("emi-calculator", "EMI Calculator");
    render(<FinancialDashboard />);
    expect(screen.getByRole("link", { name: "EMI Calculator" })).toHaveAttribute(
      "href",
      "/tools/emi-calculator"
    );
  });

  it("reset requires confirmation, then erases and returns to empty state", () => {
    saveProfile(PROFILE);
    render(<FinancialDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /clear my data/i }));
    expect(screen.getByText(/Erase everything on this device/)).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /yes, erase/i }));
    });
    expect(screen.getByText(/dashboard is empty/i)).toBeInTheDocument();
    expect(readStore().profile).toBeNull();
  });

  it("shows the current roadmap step in the milestone timeline", () => {
    saveProfile(PROFILE);
    render(<FinancialDashboard />);
    // dependants + no term cover → life insurance is the current step
    expect(screen.getByText(/▶ life insurance/)).toBeInTheDocument();
  });
});

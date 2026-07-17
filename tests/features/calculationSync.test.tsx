/**
 * CalculationSync + ToolIntelligence integration tests (PLATFORM-002).
 *
 * These prove the cross-tool experience end to end through real localStorage:
 * insights render from a saved profile, the explicit "Update my plan" tap
 * mutates one field and shows the engine's real before/after, and the
 * journey strip reflects the same score everywhere.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CalculationSync } from "@/features/tool/CalculationSync";
import { ToolIntelligence } from "@/features/tool/ToolIntelligence";
import { buildRoadmap, type RoadmapInput } from "@/lib/financialRoadmap";
import type { FinanceEvent } from "@/lib/financeEvents";
import { saveProfile, readStore } from "@/lib/localFinance";

const PROFILE: RoadmapInput = {
  age: 35,
  monthlyIncome: 100_000,
  hasPartner: true,
  dependants: 1,
  emergencyFund: 150_000,
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

beforeEach(() => {
  window.localStorage.clear();
});

describe("CalculationSync", () => {
  it("renders nothing without a saved profile", () => {
    const { container } = render(<CalculationSync event={LOAN} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no event", () => {
    saveProfile(PROFILE);
    const { container } = render(<CalculationSync event={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows deterministic insights against the saved profile", () => {
    saveProfile(PROFILE);
    render(<CalculationSync event={LOAN} />);
    // 25k EMI / 100k income = 25% — under the 40% ceiling, mentions ceiling
    expect(screen.getByText(/25% of your monthly income/)).toBeInTheDocument();
  });

  it("the explicit tap updates one field and shows the engine's before/after", () => {
    saveProfile(PROFILE);
    render(<CalculationSync event={LOAN} />);
    const before = buildRoadmap(PROFILE).healthScore;
    const after = buildRoadmap({ ...PROFILE, monthlyEmi: 25_000 }).healthScore;

    const button = screen.getByRole("button", { name: /update my plan/i });
    act(() => {
      fireEvent.click(button);
    });

    expect(readStore().profile!.monthlyEmi).toBe(25_000);
    expect(readStore().profile!.monthlyIncome).toBe(PROFILE.monthlyIncome);
    expect(screen.getByText(new RegExp(`Health Score ${before} → ${after}`))).toBeInTheDocument();
    expect(screen.getByText(/Dashboard updated/)).toBeInTheDocument();
  });

  it("offers no update when the value already matches the profile", () => {
    saveProfile(PROFILE);
    render(<CalculationSync event={{ ...LOAN, emi: 10_000 }} />);
    expect(screen.queryByRole("button", { name: /update my plan/i })).not.toBeInTheDocument();
  });
});

describe("ToolIntelligence", () => {
  it("shows a CTA to the roadmap when no profile exists", () => {
    render(<ToolIntelligence slug="emi-calculator" />);
    expect(screen.getByRole("link", { name: /Build your Financial Roadmap/i })).toHaveAttribute(
      "href",
      "/tools/financial-roadmap"
    );
  });

  it("shows the engine's health score with a saved profile", () => {
    saveProfile(PROFILE);
    render(<ToolIntelligence slug="emi-calculator" />);
    const score = buildRoadmap(PROFILE).healthScore;
    expect(screen.getByText(`Health Score ${score}/100`)).toBeInTheDocument();
  });

  it("renders nothing on the dashboard and roadmap themselves (no self-reference)", () => {
    saveProfile(PROFILE);
    const { container: dash } = render(<ToolIntelligence slug="financial-dashboard" />);
    expect(dash).toBeEmptyDOMElement();
    const { container: road } = render(<ToolIntelligence slug="financial-roadmap" />);
    expect(road).toBeEmptyDOMElement();
  });

  it("never links to the tool the user is currently on", () => {
    saveProfile(PROFILE);
    render(<ToolIntelligence slug="sip-calculator" />);
    const links = screen.getAllByRole("link");
    expect(links.every((l) => l.getAttribute("href") !== "/tools/sip-calculator")).toBe(true);
  });
});

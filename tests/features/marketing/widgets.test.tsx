import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PriorityBadge, AgentStatusBadge } from "@/features/marketing/PriorityBadge";
import { ScoreMeter } from "@/features/marketing/ScoreMeter";
import { RecommendationCard } from "@/features/marketing/RecommendationCard";
import type { Recommendation } from "@/lib/marketing-agent/types";

const rec: Recommendation = {
  id: "seo-ctr-/tools/income-tax-calculator",
  agent: "seo",
  category: "seo",
  priority: "critical",
  title: "Rewrite title & meta — /tools/income-tax-calculator",
  reason: "Ranks #3.0 with 30,000 impressions but only 1.0% CTR.",
  expectedImpact: "≈ +2,700 clicks/month at the same ranking.",
  impactClicks: 2700,
  effort: "S",
  confidence: 0.8,
  owner: "SEO",
  deadline: "2026-07-23",
  score: 72,
  evidence: [
    { label: "Impressions", value: "30,000" },
    { label: "CTR", value: "1.0%" },
  ],
  page: "/tools/income-tax-calculator",
};

describe("marketing widgets", () => {
  it("PriorityBadge renders each band", () => {
    const { rerender } = render(<PriorityBadge priority="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    rerender(<PriorityBadge priority="low" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("AgentStatusBadge distinguishes active from planned", () => {
    const { rerender } = render(<AgentStatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    rerender(<AgentStatusBadge status="planned" />);
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("ScoreMeter shows the score and is accessible", () => {
    render(<ScoreMeter score={72} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /opportunity score 72 of 100/i })).toBeInTheDocument();
  });

  it("ScoreMeter clamps out-of-range scores", () => {
    const { rerender } = render(<ScoreMeter score={150} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    rerender(<ScoreMeter score={-20} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("RecommendationCard shows decision, evidence, impact and commitment", () => {
    render(<RecommendationCard rec={rec} rank={1} />);
    expect(screen.getByRole("heading", { name: /rewrite title & meta/i })).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText(/2,700 clicks\/month/)).toBeInTheDocument();
    expect(screen.getByText(/Ranks #3.0/)).toBeInTheDocument();
    // evidence
    expect(screen.getByText("30,000")).toBeInTheDocument();
    // commitment
    expect(screen.getByText("Small")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("SEO")).toBeInTheDocument();
    expect(screen.getByText("2026-07-23")).toBeInTheDocument();
  });

  it("RecommendationCard renders without a rank", () => {
    render(<RecommendationCard rec={rec} />);
    expect(screen.queryByText("#1")).not.toBeInTheDocument();
  });
});

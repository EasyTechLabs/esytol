import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComparisonSection } from "@/features/learn/ComparisonSection";
import type { Comparison } from "@/content/comparisons";

const COMPARISON: Comparison = {
  id: "test-comparison",
  title: "Route A or Route B?",
  intro: "Two honest routes.",
  criteria: ["Cost", "Support", "Exit terms"],
  options: [
    {
      name: "Route A",
      summary: "The cheap route.",
      pros: ["Cheapest"],
      cons: ["No support"],
      bestFor: "Self-directed people who read documentation.",
      avoidIf: "You need a human to call when things break.",
      pricing: "Free (statutory).",
    },
    {
      name: "Route B",
      summary: "The supported route.",
      pros: ["Great support"],
      cons: ["Costs more"],
      bestFor: "People who value hand-holding over cost.",
      avoidIf: "Cost matters and you never use the support.",
      link: { href: "https://example.com", label: "Visit Route B", sponsored: true },
    },
  ],
  disclosure: "Test disclosure: sponsored placements are marked.",
};

describe("ComparisonSection", () => {
  beforeEach(() => {
    window.gtag = vi.fn();
  });
  afterEach(() => {
    delete (window as { gtag?: unknown }).gtag;
  });

  it("renders title, criteria, and both options", () => {
    render(<ComparisonSection comparison={COMPARISON} />);
    expect(screen.getByText("Route A or Route B?")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByText("Route A")).toBeInTheDocument();
    expect(screen.getByText("Route B")).toBeInTheDocument();
  });

  it("renders cons and avoid-if with the same prominence as pros", () => {
    render(<ComparisonSection comparison={COMPARISON} />);
    expect(screen.getByText("No support")).toBeInTheDocument();
    expect(screen.getByText("You need a human to call when things break.")).toBeInTheDocument();
  });

  it("always renders the disclosure", () => {
    render(<ComparisonSection comparison={COMPARISON} />);
    expect(screen.getByText(/Test disclosure/)).toBeInTheDocument();
  });

  it("marks sponsored links with a visible tag and rel=sponsored", () => {
    render(<ComparisonSection comparison={COMPARISON} />);
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Visit Route B/ });
    expect(link.getAttribute("rel")).toContain("sponsored");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("fires a comparison_cta_click event with the affiliate flag on link click", () => {
    render(<ComparisonSection comparison={COMPARISON} />);
    fireEvent.click(screen.getByRole("link", { name: /Visit Route B/ }));
    expect(window.gtag).toHaveBeenCalledWith("event", "comparison_cta_click", {
      comparison_id: "test-comparison",
      option: "Route B",
      affiliate: "yes",
    });
  });

  it("does not crash when gtag is absent (analytics unconfigured)", () => {
    delete (window as { gtag?: unknown }).gtag;
    render(<ComparisonSection comparison={COMPARISON} />);
    fireEvent.click(screen.getByRole("link", { name: /Visit Route B/ }));
    expect(screen.getByText("Route B")).toBeInTheDocument();
  });

  it("renders pricing only when provided", () => {
    render(<ComparisonSection comparison={COMPARISON} />);
    expect(screen.getByText("Free (statutory).")).toBeInTheDocument();
    // Route B has no pricing field — exactly one Pricing label should exist.
    expect(screen.getAllByText("Pricing")).toHaveLength(1);
  });
});

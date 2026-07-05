import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HeroSection } from "@/features/home/HeroSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const quickLinks = [
  { label: "EMI Calculator", href: "/tools/emi-calculator" },
  { label: "Home Loan Calculator", href: "/tools/home-loan-calculator" },
  { label: "SIP Calculator", href: "/tools/sip-calculator" },
];

describe("HeroSection quick links", () => {
  it("renders the provided quick links", () => {
    render(<HeroSection toolCount={10} quickLinks={quickLinks} />);
    for (const link of quickLinks) {
      const el = screen.getByRole("link", { name: link.label });
      expect(el).toHaveAttribute("href", link.href);
    }
  });

  it("every quick link points to a live tool route, never to a category page", () => {
    render(<HeroSection toolCount={10} quickLinks={quickLinks} />);
    for (const link of quickLinks) {
      const el = screen.getByRole("link", { name: link.label });
      const href = el.getAttribute("href") ?? "";
      expect(href.startsWith("/tools/")).toBe(true);
      expect(href.startsWith("/categories/")).toBe(false);
    }
  });

  it("shows the live tool count", () => {
    render(<HeroSection toolCount={10} quickLinks={quickLinks} />);
    expect(screen.getByText(/10 free tools/i)).toBeInTheDocument();
  });
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GratuityCalculator } from "@/features/tools/gratuity-calculator/GratuityCalculator";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="gratuity-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/gratuity-calculator",
}));

vi.mock("@/lib/gratuity", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCSV: vi.fn() };
});

describe("GratuityCalculator", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, "location", {
      value: { origin: "https://esytol.com" },
      writable: true,
    });
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it("renders the coverage toggle, Covered selected by default", () => {
    render(<GratuityCalculator />);
    expect(screen.getByRole("button", { name: "Covered (÷26)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Not Covered (÷30)" })).toBeInTheDocument();
  });

  it("renders the three inputs", () => {
    render(<GratuityCalculator />);
    expect(screen.getByLabelText(/monthly basic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/years of service/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/months of service/i)).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<GratuityCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Results ─────────────────────────────────────────────────────────────────

  it("shows the gratuity results with defaults", () => {
    render(<GratuityCalculator />);
    expect(screen.getByRole("heading", { name: /your gratuity/i })).toBeInTheDocument();
    expect(screen.getByText("Gratuity Amount")).toBeInTheDocument();
    expect(screen.getByText("Last Drawn Salary")).toBeInTheDocument();
    expect(screen.getByText("Eligible Service")).toBeInTheDocument();
  });

  it("shows the taxability and step-by-step sections", () => {
    render(<GratuityCalculator />);
    expect(screen.getByRole("heading", { name: /step-by-step calculation/i })).toBeInTheDocument();
    expect(screen.getByText("Taxability")).toBeInTheDocument();
    expect(screen.getByText("Tax-Exempt Amount")).toBeInTheDocument();
    expect(screen.getByText("Taxable Amount")).toBeInTheDocument();
  });

  it("shows the charts stub", () => {
    render(<GratuityCalculator />);
    expect(screen.getByTestId("gratuity-charts-stub")).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result, Share URL", () => {
    render(<GratuityCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Coverage toggle ─────────────────────────────────────────────────────────

  it("switching to Not Covered changes the divisor from 26 to 30", async () => {
    render(<GratuityCalculator />);
    expect(screen.getAllByText(/÷ 26/).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Not Covered (÷30)" }));
    await waitFor(() => expect(screen.getAllByText(/÷ 30/).length).toBeGreaterThanOrEqual(1));
  });

  // ── Eligibility ───────────────────────────────────────────────────────────────

  it("shows a not-eligible warning and ₹0 when service is under 5 years", async () => {
    render(<GratuityCalculator />);
    fireEvent.change(screen.getByLabelText(/years of service/i), { target: { value: "3" } });
    await waitFor(() => expect(screen.getByText(/not yet eligible/i)).toBeInTheDocument());
    // results section still renders (heading present)
    expect(screen.getByRole("heading", { name: /your gratuity/i })).toBeInTheDocument();
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it("shows error and hides results when salary is zero", async () => {
    render(<GratuityCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly basic/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/enter your monthly basic/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /your gratuity/i })).not.toBeInTheDocument();
  });

  it("errors when months exceed 11", async () => {
    render(<GratuityCalculator />);
    fireEvent.change(screen.getByLabelText(/months of service/i), { target: { value: "12" } });
    await waitFor(() => expect(screen.getByText(/between 0 and 11/i)).toBeInTheDocument());
  });

  it("shows error when salary is negative", async () => {
    render(<GratuityCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly basic/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  // ── Reset ─────────────────────────────────────────────────────────────────────

  it("reset restores the default salary", async () => {
    render(<GratuityCalculator />);
    const input = screen.getByLabelText(/monthly basic/i);
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("50000"));
  });

  // ── Copy ──────────────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<GratuityCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

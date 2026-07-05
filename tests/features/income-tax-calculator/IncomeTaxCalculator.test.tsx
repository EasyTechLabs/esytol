import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncomeTaxCalculator } from "@/features/tools/income-tax-calculator/IncomeTaxCalculator";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="income-tax-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/income-tax-calculator",
}));

vi.mock("@/lib/incomeTax", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCSV: vi.fn() };
});

describe("IncomeTaxCalculator", () => {
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

  it("renders both regime toggle buttons, New selected by default", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByRole("button", { name: /new regime/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /old regime/i })).toBeInTheDocument();
  });

  it("renders income and deduction inputs", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByLabelText(/annual salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/other income/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/section 80c/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/section 80d/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/home loan interest/i)).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Results ─────────────────────────────────────────────────────────────────

  it("shows results with defaults", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
    expect(screen.getByText(/taxable income/i)).toBeInTheDocument();
    expect(screen.getByText(/total tax/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly tax/i)).toBeInTheDocument();
  });

  it("shows regime comparison and a recommendation", () => {
    render(<IncomeTaxCalculator />);
    // "Best" badge marks the cheaper regime
    expect(screen.getByText(/^best$/i)).toBeInTheDocument();
    expect(screen.getByText(/saves you/i)).toBeInTheDocument();
  });

  it("shows the effective tax rate and cess", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByText(/effective tax rate/i)).toBeInTheDocument();
    expect(screen.getByText(/health & education cess/i)).toBeInTheDocument();
  });

  it("shows the charts stub and slab breakdown", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByTestId("income-tax-charts-stub")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /slab-wise breakdown/i })).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result, Share URL", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Regime toggle ─────────────────────────────────────────────────────────────

  it("switching to Old Regime updates the results heading", async () => {
    render(<IncomeTaxCalculator />);
    // default results heading reads "Results — New Regime"
    expect(screen.getByRole("heading", { name: /^results/i }).textContent).toMatch(/new/i);
    fireEvent.click(screen.getByRole("button", { name: /old regime/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /^results/i }).textContent).toMatch(/old/i)
    );
  });

  it("New Regime shows the 'deductions not allowed' note", () => {
    render(<IncomeTaxCalculator />);
    expect(screen.getByText(/new regime does not allow/i)).toBeInTheDocument();
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it("shows the 'cannot be negative' error when salary is negative but income is positive", async () => {
    render(<IncomeTaxCalculator />);
    fireEvent.change(screen.getByLabelText(/other income/i), { target: { value: "500000" } });
    fireEvent.change(screen.getByLabelText(/annual salary/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /^results/i })).not.toBeInTheDocument();
  });

  it("hides results when income is zero", async () => {
    render(<IncomeTaxCalculator />);
    fireEvent.change(screen.getByLabelText(/annual salary/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /^results/i })).not.toBeInTheDocument()
    );
  });

  // ── Reset ─────────────────────────────────────────────────────────────────────

  it("reset restores default salary", async () => {
    render(<IncomeTaxCalculator />);
    const input = screen.getByLabelText(/annual salary/i);
    fireEvent.change(input, { target: { value: "9999999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("1200000"));
  });

  // ── Copy ──────────────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<IncomeTaxCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

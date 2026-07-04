import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeLoanCalculator } from "@/features/tools/home-loan-calculator/HomeLoanCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="home-loan-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/home-loan-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/homeLoan", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── HomeLoanCalculator component tests ────────────────────────────────────────

describe("HomeLoanCalculator", () => {
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

  it("renders Loan Amount input", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByLabelText(/loan amount/i)).toBeInTheDocument();
  });

  it("renders Interest Rate input", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
  });

  it("renders Loan Tenure input", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByLabelText(/loan tenure/i)).toBeInTheDocument();
  });

  it("renders Processing Fee input", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByLabelText(/processing fee/i)).toBeInTheDocument();
  });

  it("renders Down Payment input", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByLabelText(/down payment/i)).toBeInTheDocument();
  });

  it("renders Years and Months unit buttons", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Monthly EMI card", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/monthly emi/i)).toBeInTheDocument();
  });

  it("shows Total Interest card", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/total interest/i)).toBeInTheDocument();
  });

  it("shows Total Payment card", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/total payment/i)).toBeInTheDocument();
  });

  it("shows Principal card", () => {
    render(<HomeLoanCalculator />);
    // "Principal" is both the result-card label and the amortization column header.
    expect(screen.getAllByText("Principal").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Processing Fee card", () => {
    render(<HomeLoanCalculator />);
    // Appears in the input label and the result card.
    expect(screen.getAllByText(/processing fee/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Total Initial Cost card", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/total initial cost/i)).toBeInTheDocument();
  });

  // ── Insights ──────────────────────────────────────────────────────────────────

  it("shows Loan-to-Value (LTV) insight", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/loan-to-value/i)).toBeInTheDocument();
  });

  it("shows Interest as % of Principal insight", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/interest as % of principal/i)).toBeInTheDocument();
  });

  it("shows Effective Cost of Borrowing insight", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/effective cost of borrowing/i)).toBeInTheDocument();
  });

  it("shows Total Years insight", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText(/total years/i)).toBeInTheDocument();
  });

  it("LTV is 100% with no down payment (default)", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByText("100.00%")).toBeInTheDocument();
  });

  // ── Charts & schedule ─────────────────────────────────────────────────────────

  it("shows the chart stub", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByTestId("home-loan-charts-stub")).toBeInTheDocument();
  });

  it("shows Amortization Schedule heading", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByRole("heading", { name: /amortization schedule/i })).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result and Share URL buttons", () => {
    render(<HomeLoanCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when loan amount is 0", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/loan amount/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when loan amount is invalid", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/loan amount/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when tenure exceeds 30 years", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/loan tenure/i), { target: { value: "40" } });
    await waitFor(() =>
      expect(screen.getByText(/maximum tenure is 30 years/i)).toBeInTheDocument()
    );
  });

  it("shows error when processing fee exceeds 5%", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/processing fee/i), { target: { value: "10" } });
    await waitFor(() => expect(screen.getByText(/cannot exceed 5%/i)).toBeInTheDocument());
  });

  it("shows error when down payment is negative", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/down payment/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  // ── Down payment affects LTV ────────────────────────────────────────────────

  it("adding a down payment lowers LTV below 100%", async () => {
    render(<HomeLoanCalculator />);
    // Default loan 50L; add 50L down → property 1Cr → LTV 50%.
    fireEvent.change(screen.getByLabelText(/down payment/i), { target: { value: "5000000" } });
    await waitFor(() => expect(screen.getByText("50.00%")).toBeInTheDocument());
  });

  // ── Period unit toggle ────────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default loan amount (5000000)", async () => {
    render(<HomeLoanCalculator />);
    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("5000000"));
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<HomeLoanCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

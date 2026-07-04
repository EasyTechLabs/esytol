import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PersonalLoanCalculator } from "@/features/tools/personal-loan-calculator/PersonalLoanCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="personal-loan-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/personal-loan-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/personalLoan", async (importOriginal) => {
  const actual = await importOriginal<typeof PersonalLoanModule>();
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── PersonalLoanCalculator component tests ────────────────────────────────────

describe("PersonalLoanCalculator", () => {
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
    render(<PersonalLoanCalculator />);
    expect(screen.getByLabelText(/loan amount/i)).toBeInTheDocument();
  });

  it("renders Interest Rate input", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
  });

  it("renders Loan Tenure input", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByLabelText(/loan tenure/i)).toBeInTheDocument();
  });

  it("renders Processing Fee input", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByLabelText(/processing fee/i)).toBeInTheDocument();
  });

  it("renders Years and Months unit buttons", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Monthly EMI card", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByText(/monthly emi/i)).toBeInTheDocument();
  });

  it("shows Total Interest card", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByText(/total interest/i)).toBeInTheDocument();
  });

  it("shows Total Payment card", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByText(/total payment/i)).toBeInTheDocument();
  });

  it("shows Principal card", () => {
    render(<PersonalLoanCalculator />);
    // "Principal" is both the result-card label and the amortization column header.
    expect(screen.getAllByText("Principal").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Processing Fee card", () => {
    render(<PersonalLoanCalculator />);
    // Appears in the input label and the result card.
    expect(screen.getAllByText(/processing fee/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Total Borrowing Cost", () => {
    render(<PersonalLoanCalculator />);
    // Appears as a result card and in the insights row.
    expect(screen.getAllByText(/total borrowing cost/i).length).toBeGreaterThanOrEqual(1);
  });

  // ── Insights ──────────────────────────────────────────────────────────────────

  it("shows Interest as % of Principal insight", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByText(/interest as % of principal/i)).toBeInTheDocument();
  });

  it("shows Effective Cost insight", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByText(/effective cost/i)).toBeInTheDocument();
  });

  it("shows Total Years insight", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByText(/total years/i)).toBeInTheDocument();
  });

  // ── Charts & schedule ─────────────────────────────────────────────────────────

  it("shows the chart stub", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByTestId("personal-loan-charts-stub")).toBeInTheDocument();
  });

  it("shows Amortization Schedule heading", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByRole("heading", { name: /amortization schedule/i })).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result and Share URL buttons", () => {
    render(<PersonalLoanCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when loan amount is 0", async () => {
    render(<PersonalLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/loan amount/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when loan amount is invalid", async () => {
    render(<PersonalLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/loan amount/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when tenure exceeds 7 years", async () => {
    render(<PersonalLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/loan tenure/i), { target: { value: "10" } });
    await waitFor(() => expect(screen.getByText(/maximum tenure is 7 years/i)).toBeInTheDocument());
  });

  it("shows error when processing fee exceeds 5%", async () => {
    render(<PersonalLoanCalculator />);
    fireEvent.change(screen.getByLabelText(/processing fee/i), { target: { value: "10" } });
    await waitFor(() => expect(screen.getByText(/cannot exceed 5%/i)).toBeInTheDocument());
  });

  // ── Period unit toggle ────────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<PersonalLoanCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default loan amount (500000)", async () => {
    render(<PersonalLoanCalculator />);
    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("500000"));
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<PersonalLoanCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

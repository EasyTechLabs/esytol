import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EMICalculator } from "@/features/tools/emi-calculator/EMICalculator";
import { AmortizationTable } from "@/features/tools/emi-calculator/AmortizationTable";
import type { AmortizationRow } from "@/lib/emi";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="emi-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/emi-calculator",
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockRows: AmortizationRow[] = Array.from({ length: 24 }, (_, i) => ({
  month: i + 1,
  emi: 22677,
  principal: 19000 + i * 100,
  interest: 3677 - i * 100,
  balance: Math.max(0, 500000 - 19000 * (i + 1)),
}));

// ── EMICalculator component tests ────────────────────────────────────────────

describe("EMICalculator", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, "location", {
      value: { origin: "https://esytol.com" },
      writable: true,
    });
  });

  it("renders Loan Amount input", () => {
    render(<EMICalculator />);
    expect(screen.getByLabelText(/loan amount/i)).toBeInTheDocument();
  });

  it("renders Interest Rate input", () => {
    render(<EMICalculator />);
    expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
  });

  it("renders Loan Tenure input", () => {
    render(<EMICalculator />);
    expect(screen.getByLabelText(/loan tenure/i)).toBeInTheDocument();
  });

  it("renders tenure unit toggle buttons", () => {
    render(<EMICalculator />);
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<EMICalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("shows results section with default valid inputs", () => {
    render(<EMICalculator />);
    expect(screen.getByText(/monthly emi/i)).toBeInTheDocument();
    expect(screen.getByText(/total interest/i)).toBeInTheDocument();
    expect(screen.getByText(/total payment/i)).toBeInTheDocument();
  });

  it("shows Copy result button when results are visible", () => {
    render(<EMICalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
  });

  it("shows Share URL button when results are visible", () => {
    render(<EMICalculator />);
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  it("shows the chart stub (from dynamic mock)", () => {
    render(<EMICalculator />);
    expect(screen.getByTestId("emi-charts-stub")).toBeInTheDocument();
  });

  it("shows amortization table with default inputs", () => {
    render(<EMICalculator />);
    expect(screen.getByRole("heading", { name: /amortization schedule/i })).toBeInTheDocument();
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it("shows error when loan amount is 0", async () => {
    render(<EMICalculator />);
    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument());
  });

  it("hides results when loan amount is invalid", async () => {
    render(<EMICalculator />);
    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: "-1" } });
    await waitFor(() => expect(screen.queryByText(/monthly emi/i)).not.toBeInTheDocument());
  });

  it("shows error when interest rate is negative", async () => {
    render(<EMICalculator />);
    const input = screen.getByLabelText(/interest rate/i);
    fireEvent.change(input, { target: { value: "-1" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  it("shows error when interest rate exceeds 100", async () => {
    render(<EMICalculator />);
    const input = screen.getByLabelText(/interest rate/i);
    fireEvent.change(input, { target: { value: "101" } });
    await waitFor(() => expect(screen.getByText(/cannot exceed 100/i)).toBeInTheDocument());
  });

  it("shows error when tenure is 0", async () => {
    render(<EMICalculator />);
    const input = screen.getByLabelText(/loan tenure/i);
    fireEvent.change(input, { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/minimum tenure/i)).toBeInTheDocument());
  });

  // ── Reset ───────────────────────────────────────────────────────────────

  it("reset button restores default amount value", async () => {
    render(<EMICalculator />);
    const amountInput = screen.getByLabelText(/loan amount/i);
    fireEvent.change(amountInput, { target: { value: "999" } });
    const resetBtn = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(resetBtn);
    await waitFor(() => expect((amountInput as HTMLInputElement).value).toBe("500000"));
  });

  it("reset button restores default rate value", async () => {
    render(<EMICalculator />);
    const rateInput = screen.getByLabelText(/interest rate/i);
    fireEvent.change(rateInput, { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((rateInput as HTMLInputElement).value).toBe("8.5"));
  });

  // ── Copy result ─────────────────────────────────────────────────────────

  it("copy result button calls clipboard.writeText", async () => {
    render(<EMICalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

// ── AmortizationTable component tests ────────────────────────────────────────

describe("AmortizationTable", () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => "blob:test");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders table column headers", () => {
    render(<AmortizationTable rows={mockRows} />);
    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByText("EMI")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Interest")).toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
  });

  it("renders the Download CSV button", () => {
    render(<AmortizationTable rows={mockRows} />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("shows only first 12 rows by default when more exist", () => {
    render(<AmortizationTable rows={mockRows} />);
    // 12 data rows + 1 header = 13 tr elements
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(13);
  });

  it("shows 'Show all' button when rows exceed 12", () => {
    render(<AmortizationTable rows={mockRows} />);
    expect(screen.getByRole("button", { name: /show all/i })).toBeInTheDocument();
  });

  it("shows all rows after clicking 'Show all'", async () => {
    render(<AmortizationTable rows={mockRows} />);
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(mockRows.length + 1); // +1 for header
    });
  });

  it("collapses rows after clicking 'Show first 12'", async () => {
    render(<AmortizationTable rows={mockRows} />);
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    await waitFor(() => screen.getByRole("button", { name: /show first/i }));
    fireEvent.click(screen.getByRole("button", { name: /show first/i }));
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(13);
    });
  });

  it("does not render show-more button when rows ≤ 12", () => {
    const shortRows = mockRows.slice(0, 5);
    render(<AmortizationTable rows={shortRows} />);
    expect(screen.queryByRole("button", { name: /show all/i })).toBeNull();
  });

  it("Download CSV triggers createObjectURL", async () => {
    render(<AmortizationTable rows={mockRows} />);
    fireEvent.click(screen.getByRole("button", { name: /download csv/i }));
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob)));
  });
});

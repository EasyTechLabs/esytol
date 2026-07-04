import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SIPCalculator } from "@/features/tools/sip-calculator/SIPCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="sip-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/sip-calculator",
}));

// ProjectionTable is a real import but its Download CSV triggers browser API.
// We mock downloadCSV to avoid JSDOM blob errors.
vi.mock("@/lib/sip", async (importOriginal) => {
  const actual = await importOriginal<typeof SipModule>();
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── SIPCalculator component tests ─────────────────────────────────────────────

describe("SIPCalculator", () => {
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

  it("renders Monthly Investment input", () => {
    render(<SIPCalculator />);
    expect(screen.getByLabelText(/monthly investment/i)).toBeInTheDocument();
  });

  it("renders Expected Annual Return input", () => {
    render(<SIPCalculator />);
    expect(screen.getByLabelText(/expected annual return/i)).toBeInTheDocument();
  });

  it("renders Investment Period input", () => {
    render(<SIPCalculator />);
    expect(screen.getByLabelText(/investment period/i)).toBeInTheDocument();
  });

  it("renders Years unit button", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
  });

  it("renders Months unit button", () => {
    render(<SIPCalculator />);
    // Exact name "months" to avoid matching "Show all N months" in projection table
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Total Invested result card", () => {
    render(<SIPCalculator />);
    // "Total Invested" appears in the result card label AND the projection table header
    expect(screen.getAllByText(/total invested/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Estimated Returns result card", () => {
    render(<SIPCalculator />);
    expect(screen.getByText(/estimated returns/i)).toBeInTheDocument();
  });

  it("shows Total Value result card", () => {
    render(<SIPCalculator />);
    // "Total Value" may appear in result card
    expect(screen.getAllByText(/total value/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Wealth Gained info", () => {
    render(<SIPCalculator />);
    expect(screen.getByText(/wealth gained/i)).toBeInTheDocument();
  });

  it("shows CAGR info for default 10-year period", () => {
    render(<SIPCalculator />);
    expect(screen.getByText(/cagr/i)).toBeInTheDocument();
  });

  it("shows chart stub when returns > 0 (default 12%)", () => {
    render(<SIPCalculator />);
    expect(screen.getByTestId("sip-charts-stub")).toBeInTheDocument();
  });

  it("shows Month-wise Projection heading", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("heading", { name: /month-wise projection/i })).toBeInTheDocument();
  });

  it("shows Download CSV button", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("shows Copy result button", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
  });

  it("shows Share URL button", () => {
    render(<SIPCalculator />);
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when monthly investment is 0", async () => {
    render(<SIPCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly investment/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when amount is invalid", async () => {
    render(<SIPCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly investment/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("hides projection table when amount is invalid", async () => {
    render(<SIPCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly investment/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /month-wise projection/i })
      ).not.toBeInTheDocument()
    );
  });

  it("shows error when annual return is negative", async () => {
    render(<SIPCalculator />);
    fireEvent.change(screen.getByLabelText(/expected annual return/i), {
      target: { value: "-1" },
    });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  // ── Period unit toggle ──────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<SIPCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("switching back to Years marks the button as pressed", async () => {
    render(<SIPCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: "years" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default amount (1000)", async () => {
    render(<SIPCalculator />);
    const input = screen.getByLabelText(/monthly investment/i);
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("1000"));
  });

  it("reset restores default rate (12)", async () => {
    render(<SIPCalculator />);
    const input = screen.getByLabelText(/expected annual return/i);
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("12"));
  });

  it("reset restores Years unit", async () => {
    render(<SIPCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<SIPCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  // ── Projection table ─────────────────────────────────────────────────────────

  it("projection table shows Month column header", () => {
    render(<SIPCalculator />);
    // The "Month" column header is in the table
    const headers = screen.getAllByText(/^month$/i);
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it("projection table shows Total Invested column header", () => {
    render(<SIPCalculator />);
    expect(screen.getAllByText(/total invested/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Show all N months' toggle for period > 12 months", () => {
    render(<SIPCalculator />);
    // Default is 10 years = 120 months, so toggle should appear
    expect(screen.getByText(/show all \d+ months/i)).toBeInTheDocument();
  });

  it("'Show all' toggle expands the projection table", async () => {
    render(<SIPCalculator />);
    fireEvent.click(screen.getByText(/show all \d+ months/i));
    await waitFor(() => expect(screen.getByText(/show first 12 months/i)).toBeInTheDocument());
  });

  // ── Zero rate edge case ──────────────────────────────────────────────────────

  it("hides chart when annual return is 0% (no returns to display)", async () => {
    render(<SIPCalculator />);
    fireEvent.change(screen.getByLabelText(/expected annual return/i), {
      target: { value: "0" },
    });
    await waitFor(() => expect(screen.queryByTestId("sip-charts-stub")).not.toBeInTheDocument());
  });

  it("hides CAGR info for period < 12 months", async () => {
    render(<SIPCalculator />);
    // Switch to months unit, then set period to 6
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.change(screen.getByLabelText(/investment period/i), { target: { value: "6" } });
    await waitFor(() => {
      // CAGR should not be shown for < 12 months
      expect(screen.queryByText(/cagr/i)).not.toBeInTheDocument();
    });
  });
});

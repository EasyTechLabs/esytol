import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CAGRCalculator } from "@/features/tools/cagr-calculator/CAGRCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="cagr-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/cagr-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/cagr", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── CAGRCalculator component tests ────────────────────────────────────────────

describe("CAGRCalculator", () => {
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

  it("renders Beginning Value input", () => {
    render(<CAGRCalculator />);
    expect(screen.getByLabelText(/beginning value/i)).toBeInTheDocument();
  });

  it("renders Ending Value input", () => {
    render(<CAGRCalculator />);
    expect(screen.getByLabelText(/ending value/i)).toBeInTheDocument();
  });

  it("renders Investment Period input", () => {
    render(<CAGRCalculator />);
    expect(screen.getByLabelText(/investment period/i)).toBeInTheDocument();
  });

  it("renders Years and Months unit buttons", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows CAGR result card", () => {
    render(<CAGRCalculator />);
    // "CAGR" appears in the card label and the explanatory note
    expect(screen.getAllByText(/cagr/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows the correct default CAGR (~14.87%)", () => {
    render(<CAGRCalculator />);
    // 100000 → 200000 over 5 years. 14.87% also appears in each Growth % row.
    expect(screen.getAllByText(/14\.87%/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Absolute Return card", () => {
    render(<CAGRCalculator />);
    // "Absolute Return" appears in the card label and the explanatory note.
    expect(screen.getAllByText(/absolute return/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Investment Multiple card", () => {
    render(<CAGRCalculator />);
    expect(screen.getByText(/investment multiple/i)).toBeInTheDocument();
  });

  it("shows Total Profit / Loss card", () => {
    render(<CAGRCalculator />);
    expect(screen.getByText(/total profit/i)).toBeInTheDocument();
  });

  it("shows Annualized Growth card", () => {
    render(<CAGRCalculator />);
    expect(screen.getByText(/annualized growth/i)).toBeInTheDocument();
  });

  it("shows the chart stub", () => {
    render(<CAGRCalculator />);
    expect(screen.getByTestId("cagr-charts-stub")).toBeInTheDocument();
  });

  it("shows Year-wise Projection heading", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("heading", { name: /year-wise projection/i })).toBeInTheDocument();
  });

  it("shows Download CSV button", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("shows Copy result and Share URL buttons", () => {
    render(<CAGRCalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when beginning value is 0", async () => {
    render(<CAGRCalculator />);
    fireEvent.change(screen.getByLabelText(/beginning value/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when beginning value is invalid", async () => {
    render(<CAGRCalculator />);
    fireEvent.change(screen.getByLabelText(/beginning value/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when ending value is negative", async () => {
    render(<CAGRCalculator />);
    fireEvent.change(screen.getByLabelText(/ending value/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  it("allows ending value of 0 (total loss) and shows −100% CAGR", async () => {
    render(<CAGRCalculator />);
    fireEvent.change(screen.getByLabelText(/ending value/i), { target: { value: "0" } });
    // Both CAGR and Absolute Return read −100.00% for a total loss.
    await waitFor(() => expect(screen.getAllByText(/-100\.00%/).length).toBeGreaterThanOrEqual(1));
  });

  // ── Negative return ───────────────────────────────────────────────────────────

  it("negative return: 100000 → 50000 over 2 years shows negative CAGR", async () => {
    render(<CAGRCalculator />);
    fireEvent.change(screen.getByLabelText(/ending value/i), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText(/investment period/i), { target: { value: "2" } });
    // −29.29% shows in the CAGR card and in each Growth % row.
    await waitFor(() => expect(screen.getAllByText(/-29\.29%/).length).toBeGreaterThanOrEqual(1));
  });

  // ── Period unit toggle ────────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<CAGRCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default beginning value (100000)", async () => {
    render(<CAGRCalculator />);
    const input = screen.getByLabelText(/beginning value/i);
    fireEvent.change(input, { target: { value: "55555" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("100000"));
  });

  it("reset restores Years unit", async () => {
    render(<CAGRCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<CAGRCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

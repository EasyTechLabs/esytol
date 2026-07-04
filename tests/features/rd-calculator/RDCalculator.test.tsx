import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RDCalculator } from "@/features/tools/rd-calculator/RDCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="rd-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/rd-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/rd", async (importOriginal) => {
  const actual = await importOriginal<typeof RdModule>();
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── RDCalculator component tests ──────────────────────────────────────────────

describe("RDCalculator", () => {
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

  it("renders Monthly Deposit input", () => {
    render(<RDCalculator />);
    expect(screen.getByLabelText(/monthly deposit/i)).toBeInTheDocument();
  });

  it("renders Annual Interest Rate input", () => {
    render(<RDCalculator />);
    expect(screen.getByLabelText(/annual interest rate/i)).toBeInTheDocument();
  });

  it("renders Tenure input", () => {
    render(<RDCalculator />);
    // Exact "Tenure" to avoid also matching the "Tenure unit" toggle group.
    expect(screen.getByLabelText("Tenure")).toBeInTheDocument();
  });

  it("renders Years unit button", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
  });

  it("renders Months unit button", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("shows a note about quarterly compounding", () => {
    render(<RDCalculator />);
    expect(screen.getByText(/compounded quarterly/i)).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Total Deposited result card", () => {
    render(<RDCalculator />);
    expect(screen.getAllByText(/total deposited/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Interest Earned result card", () => {
    render(<RDCalculator />);
    expect(screen.getAllByText(/interest earned/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Maturity Amount result card", () => {
    render(<RDCalculator />);
    expect(screen.getByText(/maturity amount/i)).toBeInTheDocument();
  });

  it("shows Effective Annual Yield", () => {
    render(<RDCalculator />);
    expect(screen.getByText(/effective annual yield/i)).toBeInTheDocument();
  });

  it("shows Total Growth", () => {
    render(<RDCalculator />);
    expect(screen.getByText(/total growth/i)).toBeInTheDocument();
  });

  it("shows chart stub when interest > 0", () => {
    render(<RDCalculator />);
    expect(screen.getByTestId("rd-charts-stub")).toBeInTheDocument();
  });

  it("shows Month-wise Growth heading", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("heading", { name: /month-wise growth/i })).toBeInTheDocument();
  });

  it("shows Download CSV button", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("shows Copy result button", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
  });

  it("shows Share URL button", () => {
    render(<RDCalculator />);
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when monthly deposit is 0", async () => {
    render(<RDCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly deposit/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when deposit is invalid", async () => {
    render(<RDCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly deposit/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("hides growth schedule when deposit is invalid", async () => {
    render(<RDCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly deposit/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /month-wise growth/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when interest rate is negative", async () => {
    render(<RDCalculator />);
    fireEvent.change(screen.getByLabelText(/annual interest rate/i), { target: { value: "-1" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  // ── Tenure unit toggle ────────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<RDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("switching back to Years marks the button as pressed", async () => {
    render(<RDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: "years" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default deposit (5000)", async () => {
    render(<RDCalculator />);
    const input = screen.getByLabelText(/monthly deposit/i);
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("5000"));
  });

  it("reset restores Years unit", async () => {
    render(<RDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<RDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  // ── Zero rate edge case ──────────────────────────────────────────────────────

  it("hides chart when interest rate is 0% (no interest to display)", async () => {
    render(<RDCalculator />);
    fireEvent.change(screen.getByLabelText(/annual interest rate/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.queryByTestId("rd-charts-stub")).not.toBeInTheDocument());
  });

  // ── Projection table ─────────────────────────────────────────────────────────

  it("shows 'Show all N months' toggle for tenure > 12 months", () => {
    render(<RDCalculator />);
    // Default 5 years = 60 months
    expect(screen.getByText(/show all \d+ months/i)).toBeInTheDocument();
  });

  it("'Show all' toggle expands the projection table", async () => {
    render(<RDCalculator />);
    fireEvent.click(screen.getByText(/show all \d+ months/i));
    await waitFor(() => expect(screen.getByText(/show first 12 months/i)).toBeInTheDocument());
  });
});

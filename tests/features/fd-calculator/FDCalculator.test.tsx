import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FDCalculator } from "@/features/tools/fd-calculator/FDCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="fd-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/fd-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/fd", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── FDCalculator component tests ──────────────────────────────────────────────

describe("FDCalculator", () => {
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

  it("renders Principal input", () => {
    render(<FDCalculator />);
    expect(screen.getByLabelText(/principal amount/i)).toBeInTheDocument();
  });

  it("renders Annual Interest Rate input", () => {
    render(<FDCalculator />);
    expect(screen.getByLabelText(/annual interest rate/i)).toBeInTheDocument();
  });

  it("renders Investment Period input", () => {
    render(<FDCalculator />);
    expect(screen.getByLabelText(/investment period/i)).toBeInTheDocument();
  });

  it("renders Compounding Frequency select", () => {
    render(<FDCalculator />);
    expect(screen.getByLabelText(/compounding frequency/i)).toBeInTheDocument();
  });

  it("compounding select defaults to Quarterly", () => {
    render(<FDCalculator />);
    const select = screen.getByLabelText(/compounding frequency/i) as HTMLSelectElement;
    expect(select.value).toBe("quarterly");
  });

  it("compounding select offers all four options", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("option", { name: "Yearly" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Half-Yearly" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quarterly" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Monthly" })).toBeInTheDocument();
  });

  it("renders Years unit button", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
  });

  it("renders Months unit button", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Principal result card", () => {
    render(<FDCalculator />);
    expect(screen.getAllByText(/^principal$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Interest Earned result card", () => {
    render(<FDCalculator />);
    expect(screen.getAllByText(/interest earned/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Maturity Amount result card", () => {
    render(<FDCalculator />);
    expect(screen.getByText(/maturity amount/i)).toBeInTheDocument();
  });

  it("shows Effective Annual Yield", () => {
    render(<FDCalculator />);
    expect(screen.getByText(/effective annual yield/i)).toBeInTheDocument();
  });

  it("shows Total Growth", () => {
    render(<FDCalculator />);
    expect(screen.getByText(/total growth/i)).toBeInTheDocument();
  });

  it("shows chart stub when interest > 0", () => {
    render(<FDCalculator />);
    expect(screen.getByTestId("fd-charts-stub")).toBeInTheDocument();
  });

  it("shows growth schedule heading", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("heading", { name: /-wise growth/i })).toBeInTheDocument();
  });

  it("shows Download CSV button", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("shows Copy result button", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
  });

  it("shows Share URL button", () => {
    render(<FDCalculator />);
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when principal is 0", async () => {
    render(<FDCalculator />);
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when principal is invalid", async () => {
    render(<FDCalculator />);
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("hides growth schedule when principal is invalid", async () => {
    render(<FDCalculator />);
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /-wise growth/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when interest rate is negative", async () => {
    render(<FDCalculator />);
    fireEvent.change(screen.getByLabelText(/annual interest rate/i), { target: { value: "-1" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  // ── Compounding frequency ─────────────────────────────────────────────────────

  it("changing compounding frequency to Monthly updates the select", async () => {
    render(<FDCalculator />);
    const select = screen.getByLabelText(/compounding frequency/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "monthly" } });
    await waitFor(() => expect(select.value).toBe("monthly"));
  });

  it("monthly compounding relabels the schedule to Month-wise", async () => {
    render(<FDCalculator />);
    const select = screen.getByLabelText(/compounding frequency/i);
    fireEvent.change(select, { target: { value: "monthly" } });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /month-wise growth/i })).toBeInTheDocument()
    );
  });

  // ── Period unit toggle ──────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<FDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default principal (100000)", async () => {
    render(<FDCalculator />);
    const input = screen.getByLabelText(/principal amount/i);
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("100000"));
  });

  it("reset restores Quarterly compounding", async () => {
    render(<FDCalculator />);
    const select = screen.getByLabelText(/compounding frequency/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "monthly" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect(select.value).toBe("quarterly"));
  });

  it("reset restores Years unit", async () => {
    render(<FDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<FDCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  // ── Zero rate edge case ──────────────────────────────────────────────────────

  it("hides chart when interest rate is 0% (no interest to display)", async () => {
    render(<FDCalculator />);
    fireEvent.change(screen.getByLabelText(/annual interest rate/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.queryByTestId("fd-charts-stub")).not.toBeInTheDocument());
  });
});

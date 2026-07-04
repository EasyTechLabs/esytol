import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PPFCalculator } from "@/features/tools/ppf-calculator/PPFCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="ppf-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/ppf-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/ppf", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── PPFCalculator component tests ─────────────────────────────────────────────

describe("PPFCalculator", () => {
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

  it("renders Yearly Contribution input", () => {
    render(<PPFCalculator />);
    expect(screen.getByLabelText(/yearly contribution/i)).toBeInTheDocument();
  });

  it("renders Investment Period input", () => {
    render(<PPFCalculator />);
    expect(screen.getByLabelText(/investment period/i)).toBeInTheDocument();
  });

  it("renders Interest Rate input", () => {
    render(<PPFCalculator />);
    expect(screen.getByLabelText(/interest rate/i)).toBeInTheDocument();
  });

  it("renders optional Opening Balance input", () => {
    render(<PPFCalculator />);
    expect(screen.getByLabelText(/opening balance/i)).toBeInTheDocument();
  });

  it("Interest Rate defaults to 7.1", () => {
    render(<PPFCalculator />);
    const rate = screen.getByLabelText(/interest rate/i) as HTMLInputElement;
    expect(rate.value).toBe("7.1");
  });

  it("Investment Period defaults to 15", () => {
    render(<PPFCalculator />);
    const years = screen.getByLabelText(/investment period/i) as HTMLInputElement;
    expect(years.value).toBe("15");
  });

  it("renders Reset button", () => {
    render(<PPFCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<PPFCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Total Contribution result card", () => {
    render(<PPFCalculator />);
    expect(screen.getByText(/total contribution/i)).toBeInTheDocument();
  });

  it("shows Total Interest Earned result card", () => {
    render(<PPFCalculator />);
    expect(screen.getByText(/total interest earned/i)).toBeInTheDocument();
  });

  it("shows Maturity Value result card", () => {
    render(<PPFCalculator />);
    expect(screen.getByText(/maturity value/i)).toBeInTheDocument();
  });

  it("shows Wealth Gain", () => {
    render(<PPFCalculator />);
    expect(screen.getByText(/wealth gain/i)).toBeInTheDocument();
  });

  it("shows chart stub when interest > 0", () => {
    render(<PPFCalculator />);
    expect(screen.getByTestId("ppf-charts-stub")).toBeInTheDocument();
  });

  it("shows Year-wise Growth heading", () => {
    render(<PPFCalculator />);
    expect(screen.getByRole("heading", { name: /year-wise growth/i })).toBeInTheDocument();
  });

  it("shows Download CSV button", () => {
    render(<PPFCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
  });

  it("shows Copy result button", () => {
    render(<PPFCalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
  });

  it("shows Share URL button", () => {
    render(<PPFCalculator />);
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  it("15-year projection shows no 'show all' toggle (fits one term)", () => {
    render(<PPFCalculator />);
    expect(screen.queryByText(/show all \d+ years/i)).not.toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when contribution is below ₹500", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/yearly contribution/i), { target: { value: "100" } });
    await waitFor(() =>
      expect(screen.getByText(/minimum yearly contribution/i)).toBeInTheDocument()
    );
  });

  it("shows error when contribution exceeds ₹1.5L", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/yearly contribution/i), {
      target: { value: "200000" },
    });
    await waitFor(() =>
      expect(screen.getByText(/maximum yearly contribution/i)).toBeInTheDocument()
    );
  });

  it("shows error when period below 15 years", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/investment period/i), { target: { value: "10" } });
    await waitFor(() =>
      expect(screen.getByText(/minimum lock-in of 15 years/i)).toBeInTheDocument()
    );
  });

  it("hides results when contribution is invalid", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/yearly contribution/i), { target: { value: "100" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("hides growth schedule when period is invalid", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/investment period/i), { target: { value: "5" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /year-wise growth/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when rate exceeds 15%", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: "20" } });
    await waitFor(() => expect(screen.getByText(/cannot exceed 15%/i)).toBeInTheDocument());
  });

  it("shows error when opening balance is negative", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/opening balance/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  it("empty opening balance is treated as valid (0)", () => {
    render(<PPFCalculator />);
    // Default opening is empty; results should still render.
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  // ── Extension ─────────────────────────────────────────────────────────────────

  it("20-year period shows a 'show all' toggle (extension beyond 15)", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/investment period/i), { target: { value: "20" } });
    await waitFor(() => expect(screen.getByText(/show all 20 years/i)).toBeInTheDocument());
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default contribution (150000)", async () => {
    render(<PPFCalculator />);
    const input = screen.getByLabelText(/yearly contribution/i);
    fireEvent.change(input, { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("150000"));
  });

  it("reset restores default rate (7.1)", async () => {
    render(<PPFCalculator />);
    const input = screen.getByLabelText(/interest rate/i);
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("7.1"));
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<PPFCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  // ── Zero rate edge case ──────────────────────────────────────────────────────

  it("hides chart when rate is 0% (no interest to display)", async () => {
    render(<PPFCalculator />);
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.queryByTestId("ppf-charts-stub")).not.toBeInTheDocument());
  });
});

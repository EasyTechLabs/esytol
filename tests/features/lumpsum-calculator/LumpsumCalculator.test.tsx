import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LumpsumCalculator } from "@/features/tools/lumpsum-calculator/LumpsumCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="lumpsum-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/lumpsum-calculator",
}));

// Mock downloadCSV to avoid JSDOM blob/URL errors.
vi.mock("@/lib/lumpsum", async (importOriginal) => {
  const actual = await importOriginal<typeof LumpsumModule>();
  return {
    ...actual,
    downloadCSV: vi.fn(),
  };
});

// ── LumpsumCalculator component tests ─────────────────────────────────────────

describe("LumpsumCalculator", () => {
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

  it("renders Initial Investment input", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByLabelText(/initial investment/i)).toBeInTheDocument();
  });

  it("renders Expected Annual Return input", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByLabelText(/expected annual return/i)).toBeInTheDocument();
  });

  it("renders Investment Period input", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByLabelText(/investment period/i)).toBeInTheDocument();
  });

  it("renders Years and Months unit buttons", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "months" })).toBeInTheDocument();
  });

  it("Years is selected by default", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true");
  });

  it("renders Reset button", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results heading with default valid inputs", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Initial Investment result card", () => {
    render(<LumpsumCalculator />);
    // Appears in the input label and the result card.
    expect(screen.getAllByText(/initial investment/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Estimated Returns result card", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByText(/estimated returns/i)).toBeInTheDocument();
  });

  it("shows Maturity Value result card", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByText(/maturity value/i)).toBeInTheDocument();
  });

  it("shows Wealth Gain, CAGR and Investment Multiple", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByText(/wealth gain/i)).toBeInTheDocument();
    expect(screen.getByText(/cagr/i)).toBeInTheDocument();
    expect(screen.getByText(/investment multiple/i)).toBeInTheDocument();
  });

  it("shows the correct default CAGR (12%)", () => {
    render(<LumpsumCalculator />);
    // Default 12% p.a.
    expect(screen.getByText(/12\.00% p\.a\./)).toBeInTheDocument();
  });

  it("shows the chart stub", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByTestId("lumpsum-charts-stub")).toBeInTheDocument();
  });

  it("shows Year-wise Projection heading", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByRole("heading", { name: /year-wise projection/i })).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result and Share URL buttons", () => {
    render(<LumpsumCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when initial investment is 0", async () => {
    render(<LumpsumCalculator />);
    fireEvent.change(screen.getByLabelText(/initial investment/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when investment is invalid", async () => {
    render(<LumpsumCalculator />);
    fireEvent.change(screen.getByLabelText(/initial investment/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("shows error when return is below −100%", async () => {
    render(<LumpsumCalculator />);
    fireEvent.change(screen.getByLabelText(/expected annual return/i), {
      target: { value: "-150" },
    });
    await waitFor(() => expect(screen.getByText(/cannot be less than/i)).toBeInTheDocument());
  });

  it("shows error when return exceeds 100%", async () => {
    render(<LumpsumCalculator />);
    fireEvent.change(screen.getByLabelText(/expected annual return/i), {
      target: { value: "150" },
    });
    await waitFor(() => expect(screen.getByText(/cannot exceed 100%/i)).toBeInTheDocument());
  });

  // ── Negative / loss scenario ──────────────────────────────────────────────────

  it("negative return produces a negative CAGR display", async () => {
    render(<LumpsumCalculator />);
    fireEvent.change(screen.getByLabelText(/expected annual return/i), {
      target: { value: "-10" },
    });
    await waitFor(() => expect(screen.getByText(/-10\.00% p\.a\./)).toBeInTheDocument());
  });

  // ── Period unit toggle ────────────────────────────────────────────────────────

  it("switching to Months marks the button as pressed", async () => {
    render(<LumpsumCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "months" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default investment (100000)", async () => {
    render(<LumpsumCalculator />);
    const input = screen.getByLabelText(/initial investment/i);
    fireEvent.change(input, { target: { value: "55555" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("100000"));
  });

  it("reset restores Years unit", async () => {
    render(<LumpsumCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "months" }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "years" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<LumpsumCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

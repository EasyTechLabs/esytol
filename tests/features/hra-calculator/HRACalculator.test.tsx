import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HRACalculator } from "@/features/tools/hra-calculator/HRACalculator";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="hra-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/hra-calculator",
}));

vi.mock("@/lib/hra", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCSV: vi.fn() };
});

describe("HRACalculator", () => {
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

  it("renders the metro/non-metro toggle, Metro selected by default", () => {
    render(<HRACalculator />);
    expect(screen.getByRole("button", { name: "Metro (50%)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Non-Metro (40%)" })).toBeInTheDocument();
  });

  it("renders all four inputs", () => {
    render(<HRACalculator />);
    expect(screen.getByLabelText(/annual salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/basic salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hra received/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rent paid/i)).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<HRACalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Results ─────────────────────────────────────────────────────────────────

  it("shows the exemption results with defaults", () => {
    render(<HRACalculator />);
    expect(screen.getByRole("heading", { name: /your hra exemption/i })).toBeInTheDocument();
    expect(screen.getByText("HRA Exemption")).toBeInTheDocument();
    expect(screen.getByText("Taxable HRA")).toBeInTheDocument();
    expect(screen.getByText("Remaining Taxable Salary")).toBeInTheDocument();
  });

  it("shows monthly/annual exemption and exempt-% insights", () => {
    render(<HRACalculator />);
    expect(screen.getByText("Monthly HRA Exemption")).toBeInTheDocument();
    expect(screen.getByText("Annual HRA Exemption")).toBeInTheDocument();
    expect(screen.getByText(/exempt % of hra/i)).toBeInTheDocument();
  });

  it("shows all three rules step-by-step with one winner flagged", () => {
    render(<HRACalculator />);
    expect(
      screen.getByRole("heading", { name: /step-by-step — the three hra rules/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/actual hra received/i)).toBeInTheDocument();
    // the winning rule label appears in both the table and the explanation banner
    expect(screen.getAllByText(/rent paid − 10% of basic/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/50% of basic salary/i)).toBeInTheDocument();
    // exactly one "Exempt" badge marks the winning (least) rule
    expect(screen.getByText("Exempt")).toBeInTheDocument();
  });

  it("explains why the least value wins", () => {
    render(<HRACalculator />);
    expect(screen.getByText(/lowest/i)).toBeInTheDocument();
  });

  it("shows the charts stub", () => {
    render(<HRACalculator />);
    expect(screen.getByTestId("hra-charts-stub")).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result, Share URL", () => {
    render(<HRACalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── City toggle ───────────────────────────────────────────────────────────────

  it("switching to Non-Metro changes the 50% rule to 40%", async () => {
    render(<HRACalculator />);
    expect(screen.getByText(/50% of basic salary/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Non-Metro (40%)" }));
    await waitFor(() => expect(screen.getByText(/40% of basic salary/i)).toBeInTheDocument());
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it("shows error and hides results when salary is negative", async () => {
    render(<HRACalculator />);
    fireEvent.change(screen.getByLabelText(/annual salary/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /your hra exemption/i })).not.toBeInTheDocument();
  });

  it("hides results when salary is zero", async () => {
    render(<HRACalculator />);
    fireEvent.change(screen.getByLabelText(/annual salary/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /your hra exemption/i })).not.toBeInTheDocument()
    );
  });

  it("errors when basic salary exceeds annual salary", async () => {
    render(<HRACalculator />);
    fireEvent.change(screen.getByLabelText(/basic salary/i), { target: { value: "9999999" } });
    await waitFor(() =>
      expect(screen.getByText(/cannot exceed annual salary/i)).toBeInTheDocument()
    );
  });

  // ── Reset ─────────────────────────────────────────────────────────────────────

  it("reset restores default salary", async () => {
    render(<HRACalculator />);
    const input = screen.getByLabelText(/annual salary/i);
    fireEvent.change(input, { target: { value: "5000000" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("1200000"));
  });

  // ── Copy ──────────────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<HRACalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

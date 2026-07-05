import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EPFCalculator } from "@/features/tools/epf-calculator/EPFCalculator";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="epf-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/epf-calculator",
}));

vi.mock("@/lib/epf", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCSV: vi.fn() };
});

describe("EPFCalculator", () => {
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

  it("renders all six inputs", () => {
    render(<EPFCalculator />);
    expect(screen.getByLabelText(/monthly basic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/retirement age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current epf balance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/annual salary increase/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/epf interest rate/i)).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<EPFCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Results ─────────────────────────────────────────────────────────────────

  it("shows the maturity results with defaults", () => {
    render(<EPFCalculator />);
    expect(screen.getByRole("heading", { name: /epf at age/i })).toBeInTheDocument();
    expect(screen.getByText("Maturity Balance")).toBeInTheDocument();
    expect(screen.getByText("Total Interest Earned")).toBeInTheDocument();
    expect(screen.getByText("Total Contribution")).toBeInTheDocument();
  });

  it("shows the contribution split insights incl. EPS", () => {
    render(<EPFCalculator />);
    expect(screen.getByText("Monthly Contribution to EPF")).toBeInTheDocument();
    expect(screen.getByText("Monthly EPS (Pension)")).toBeInTheDocument();
    expect(screen.getByText("Employee Contribution (12%)")).toBeInTheDocument();
    expect(screen.getByText("Employer EPF Contribution")).toBeInTheDocument();
  });

  it("shows the charts stub and the year-wise projection", () => {
    render(<EPFCalculator />);
    expect(screen.getByTestId("epf-charts-stub")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /year-wise projection/i })).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result, Share URL", () => {
    render(<EPFCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Reactivity ────────────────────────────────────────────────────────────────

  it("updates the results heading when retirement age changes", async () => {
    render(<EPFCalculator />);
    expect(screen.getByRole("heading", { name: /epf at age 58/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/retirement age/i), { target: { value: "60" } });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /epf at age 60/i })).toBeInTheDocument()
    );
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it("shows error and hides results when wages are zero", async () => {
    render(<EPFCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly basic/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/enter your monthly basic/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /epf at age/i })).not.toBeInTheDocument();
  });

  it("errors when retirement age is not greater than current age", async () => {
    render(<EPFCalculator />);
    fireEvent.change(screen.getByLabelText(/retirement age/i), { target: { value: "25" } });
    await waitFor(() => expect(screen.getByText(/greater than current age/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /epf at age/i })).not.toBeInTheDocument();
  });

  it("shows error when wages are negative", async () => {
    render(<EPFCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly basic/i), { target: { value: "-100" } });
    await waitFor(() => expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument());
  });

  // ── Reset ─────────────────────────────────────────────────────────────────────

  it("reset restores default wages", async () => {
    render(<EPFCalculator />);
    const input = screen.getByLabelText(/monthly basic/i);
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("25000"));
  });

  // ── Copy ──────────────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<EPFCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

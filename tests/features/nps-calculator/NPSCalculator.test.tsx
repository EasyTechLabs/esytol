import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NPSCalculator } from "@/features/tools/nps-calculator/NPSCalculator";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="nps-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/nps-calculator",
}));

vi.mock("@/lib/nps", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCSV: vi.fn() };
});

describe("NPSCalculator", () => {
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
    render(<NPSCalculator />);
    expect(screen.getByLabelText(/current age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/retirement age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monthly contribution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expected annual return/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expected annuity rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lump sum withdrawal/i)).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<NPSCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Results ─────────────────────────────────────────────────────────────────

  it("shows the corpus, pension and lump-sum results with defaults", () => {
    render(<NPSCalculator />);
    expect(screen.getByRole("heading", { name: /nps at age/i })).toBeInTheDocument();
    expect(screen.getByText("Corpus at Retirement")).toBeInTheDocument();
    expect(screen.getByText("Monthly Pension")).toBeInTheDocument();
    expect(screen.getByText("Lump Sum Available")).toBeInTheDocument();
  });

  it("shows contributions, returns and annuity insights", () => {
    render(<NPSCalculator />);
    expect(screen.getByText("Total Contributions")).toBeInTheDocument();
    expect(screen.getByText("Estimated Returns")).toBeInTheDocument();
    expect(screen.getByText(/annuity corpus/i)).toBeInTheDocument();
  });

  it("shows the tax benefits block", () => {
    render(<NPSCalculator />);
    expect(screen.getByText("Tax Benefits")).toBeInTheDocument();
    expect(screen.getByText(/80ccd\(1b\)/i)).toBeInTheDocument();
  });

  it("shows the charts stub and growth projection", () => {
    render(<NPSCalculator />);
    expect(screen.getByTestId("nps-charts-stub")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /growth projection/i })).toBeInTheDocument();
  });

  it("shows Download CSV, Copy result, Share URL", () => {
    render(<NPSCalculator />);
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Reactivity ────────────────────────────────────────────────────────────────

  it("updates the results heading when retirement age changes", async () => {
    render(<NPSCalculator />);
    expect(screen.getByRole("heading", { name: /nps at age 60/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/retirement age/i), { target: { value: "65" } });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /nps at age 65/i })).toBeInTheDocument()
    );
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it("shows error and hides results when contribution is zero", async () => {
    render(<NPSCalculator />);
    fireEvent.change(screen.getByLabelText(/monthly contribution/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/greater than/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /nps at age/i })).not.toBeInTheDocument();
  });

  it("errors when lump sum exceeds 60%", async () => {
    render(<NPSCalculator />);
    fireEvent.change(screen.getByLabelText(/lump sum withdrawal/i), { target: { value: "70" } });
    await waitFor(() => expect(screen.getByText(/cannot exceed 60/i)).toBeInTheDocument());
  });

  it("errors when current age is below 18", async () => {
    render(<NPSCalculator />);
    fireEvent.change(screen.getByLabelText(/current age/i), { target: { value: "16" } });
    await waitFor(() => expect(screen.getByText(/at least 18/i)).toBeInTheDocument());
  });

  // ── Reset ─────────────────────────────────────────────────────────────────────

  it("reset restores the default contribution", async () => {
    render(<NPSCalculator />);
    const input = screen.getByLabelText(/monthly contribution/i);
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("5000"));
  });

  // ── Copy ──────────────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<NPSCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

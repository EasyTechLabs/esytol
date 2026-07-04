import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GSTCalculator } from "@/features/tools/gst-calculator/GSTCalculator";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub() {
      return <div data-testid="gst-charts-stub" />;
    },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/gst-calculator",
}));

// ── GSTCalculator component tests ─────────────────────────────────────────────

describe("GSTCalculator", () => {
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

  it("renders the Amount input", () => {
    render(<GSTCalculator />);
    expect(screen.getByLabelText(/base amount/i)).toBeInTheDocument();
  });

  it("renders Add GST mode button", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /add gst/i })).toBeInTheDocument();
  });

  it("renders Remove GST mode button", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /remove gst/i })).toBeInTheDocument();
  });

  it("Add GST is selected by default", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /add gst/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("renders standard GST rate buttons (3%, 5%, 12%, 18%, 28%)", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: "3%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "18%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "28%" })).toBeInTheDocument();
  });

  it("renders Custom rate button", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /custom/i })).toBeInTheDocument();
  });

  it("renders Reset button", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Default results ─────────────────────────────────────────────────────────

  it("shows Results section with default valid inputs", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("heading", { name: /results/i })).toBeInTheDocument();
  });

  it("shows Original Amount result card", () => {
    render(<GSTCalculator />);
    expect(screen.getByText(/original amount/i)).toBeInTheDocument();
  });

  it("shows GST Amount result card", () => {
    render(<GSTCalculator />);
    expect(screen.getByText(/gst amount/i)).toBeInTheDocument();
  });

  it("shows Total Amount result card", () => {
    render(<GSTCalculator />);
    // "Total Amount" appears in both the result card and the breakdown table
    expect(screen.getAllByText(/total amount/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows CGST breakdown", () => {
    render(<GSTCalculator />);
    // CGST appears in the tax components pill and in the breakdown table
    expect(screen.getAllByText(/cgst/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows SGST breakdown", () => {
    render(<GSTCalculator />);
    expect(screen.getAllByText(/sgst/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows IGST breakdown", () => {
    render(<GSTCalculator />);
    expect(screen.getAllByText(/igst/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Calculation Breakdown heading", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("heading", { name: /calculation breakdown/i })).toBeInTheDocument();
  });

  it("shows chart stub when GST > 0 (default 18%)", () => {
    render(<GSTCalculator />);
    expect(screen.getByTestId("gst-charts-stub")).toBeInTheDocument();
  });

  it("shows Copy result button", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
  });

  it("shows Share URL button", () => {
    render(<GSTCalculator />);
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("shows error when amount is 0", async () => {
    render(<GSTCalculator />);
    fireEvent.change(screen.getByLabelText(/base amount/i), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByText(/must be greater than/i)).toBeInTheDocument());
  });

  it("hides results when amount is invalid", async () => {
    render(<GSTCalculator />);
    fireEvent.change(screen.getByLabelText(/base amount/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /results/i })).not.toBeInTheDocument()
    );
  });

  it("hides breakdown when amount is invalid", async () => {
    render(<GSTCalculator />);
    fireEvent.change(screen.getByLabelText(/base amount/i), { target: { value: "0" } });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /calculation breakdown/i })
      ).not.toBeInTheDocument()
    );
  });

  it("shows custom rate input after clicking Custom", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /custom/i }));
    await waitFor(() => expect(screen.getByLabelText(/custom gst rate/i)).toBeInTheDocument());
  });

  it("Custom button becomes aria-pressed=true when selected", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /custom/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /custom/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
  });

  // ── Mode toggle ─────────────────────────────────────────────────────────────

  it("switching to Remove GST marks the button as pressed", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /remove gst/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /remove gst/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
  });

  it("switching to Remove GST changes the amount label", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /remove gst/i }));
    await waitFor(() => expect(screen.getByLabelText(/includes gst/i)).toBeInTheDocument());
  });

  // ── Rate selection ──────────────────────────────────────────────────────────

  it("clicking a rate button marks it as aria-pressed=true", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "5%" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "5%" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  it("selecting a preset rate deselects Custom mode", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /custom/i }));
    fireEvent.click(screen.getByRole("button", { name: "12%" }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/custom gst rate/i)).not.toBeInTheDocument()
    );
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores default amount (1000)", async () => {
    render(<GSTCalculator />);
    const input = screen.getByLabelText(/base amount/i);
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("1000"));
  });

  it("reset restores Add GST mode", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /remove gst/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add gst/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
  });

  it("reset closes custom rate input", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /custom/i }));
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() =>
      expect(screen.queryByLabelText(/custom gst rate/i)).not.toBeInTheDocument()
    );
  });

  // ── Copy result ─────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<GSTCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

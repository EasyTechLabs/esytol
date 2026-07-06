import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgeCalculator } from "@/features/tools/age-calculator/AgeCalculator";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/tools/age-calculator",
}));

vi.mock("@/lib/age", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCSV: vi.fn() };
});

describe("AgeCalculator", () => {
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

  it("renders the mode toggle with Age selected by default", () => {
    render(<AgeCalculator />);
    expect(screen.getByRole("button", { name: "Age (one date)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Compare (two dates)" })).toBeInTheDocument();
  });

  it("renders the DOB and 'age as of' inputs", () => {
    render(<AgeCalculator />);
    expect(screen.getByLabelText("Date of Birth")).toBeInTheDocument();
    expect(screen.getByLabelText(/age as of/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  // ── Single-mode results ─────────────────────────────────────────────────────

  it("computes age and the day of birth for a fixed 'as of' date", async () => {
    render(<AgeCalculator />);
    fireEvent.change(screen.getByLabelText(/age as of/i), { target: { value: "2026-07-07" } });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /your age/i })).toBeInTheDocument()
    );
    // 1 Jan 2000 fell on a Saturday
    expect(screen.getByText("Saturday")).toBeInTheDocument();
    expect(screen.getByText("Total days")).toBeInTheDocument();
    expect(screen.getByText("Total seconds")).toBeInTheDocument();
    expect(screen.getByText("Next birthday")).toBeInTheDocument();
  });

  it("shows the action buttons in single mode", async () => {
    render(<AgeCalculator />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /your age/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /download csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy result/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share url/i })).toBeInTheDocument();
  });

  // ── Compare mode ────────────────────────────────────────────────────────────

  it("switches to compare mode and shows an age difference", async () => {
    render(<AgeCalculator />);
    fireEvent.click(screen.getByRole("button", { name: "Compare (two dates)" }));
    expect(screen.getByLabelText(/first date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/second date of birth/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /age difference/i })).toBeInTheDocument()
    );
    // default first = 2000-01-01, second = 1995-06-15 → second is older
    const banner = screen.getByText(/older by/i);
    expect(banner.textContent).toMatch(/second date/i);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("rejects a future date of birth and hides the results", async () => {
    render(<AgeCalculator />);
    fireEvent.change(screen.getByLabelText("Date of Birth"), { target: { value: "2999-12-31" } });
    await waitFor(() => expect(screen.getByText(/future/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /your age/i })).not.toBeInTheDocument();
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  it("reset restores the default date of birth", async () => {
    render(<AgeCalculator />);
    const input = screen.getByLabelText("Date of Birth") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1980-03-10" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    await waitFor(() => expect(input.value).toBe("2000-01-01"));
  });

  // ── Copy ────────────────────────────────────────────────────────────────────

  it("Copy result calls clipboard.writeText", async () => {
    render(<AgeCalculator />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /your age/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /copy result/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });
});

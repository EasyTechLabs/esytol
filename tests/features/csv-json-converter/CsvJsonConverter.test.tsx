import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Component tests for the CSV ↔ JSON Converter. The engine is unit-tested separately; here we test
 * the UI wiring — conversion both directions, options, table preview, statistics, warnings, swap,
 * and the friendly validation error. EditorPanel/ResultViewer are mocked to plain elements.
 */

vi.mock("@/features/dev/EditorPanel", () => ({
  EditorPanel: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/features/dev/ResultViewer", () => ({
  ResultViewer: ({ value, label }: { value: string; label?: string }) => (
    <pre aria-label={label}>{value}</pre>
  ),
}));

import { CsvJsonConverter } from "@/features/tools/csv-json-converter/CsvJsonConverter";

const typeInput = (v: string) =>
  fireEvent.change(screen.getByLabelText(/input editor/i), { target: { value: v } });

describe("CsvJsonConverter", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("converts CSV → JSON with a header row", async () => {
    render(<CsvJsonConverter />);
    typeInput("name,age\nAlice,30");
    await waitFor(() =>
      expect(JSON.parse(screen.getByLabelText("JSON output").textContent || "[]")).toEqual([
        { name: "Alice", age: "30" },
      ])
    );
  });

  it("infers types when the toggle is on", async () => {
    render(<CsvJsonConverter />);
    typeInput("name,age,active\nAlice,30,true");
    fireEvent.click(screen.getByLabelText(/infer types/i));
    await waitFor(() =>
      expect(JSON.parse(screen.getByLabelText("JSON output").textContent || "[]")).toEqual([
        { name: "Alice", age: 30, active: true },
      ])
    );
  });

  it("shows CSV statistics", async () => {
    render(<CsvJsonConverter />);
    typeInput("a,b,c\n1,,3");
    await waitFor(() => expect(screen.getByLabelText("CSV statistics")).toBeInTheDocument());
  });

  it("renders the table preview", async () => {
    render(<CsvJsonConverter />);
    typeInput("city,zip\nPune,411001");
    await waitFor(() => expect(screen.getByRole("tab", { name: /table/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: /table/i }));
    const table = await screen.findByRole("table");
    expect(within(table).getByText("city")).toBeInTheDocument();
    expect(within(table).getByText("411001")).toBeInTheDocument();
  });

  it("reports a friendly validation error with a location", async () => {
    render(<CsvJsonConverter />);
    typeInput('a,b\n"oops');
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/never closed/i));
    expect(screen.queryByLabelText("CSV statistics")).not.toBeInTheDocument();
  });

  it("converts JSON → CSV and neutralises formula injection", async () => {
    render(<CsvJsonConverter />);
    fireEvent.click(screen.getByRole("tab", { name: /json → csv/i }));
    typeInput('[{"formula":"=1+1"},{"formula":"ok"}]');
    await waitFor(() =>
      expect(screen.getByLabelText("CSV output").textContent).toBe("formula\r\n'=1+1\r\nok")
    );
    expect(
      within(screen.getByLabelText("Conversion notes")).getByText(/formula injection/i)
    ).toBeInTheDocument();
  });

  it("swaps direction and feeds the output back in", async () => {
    render(<CsvJsonConverter />);
    typeInput("a,b\n1,2");
    await waitFor(() => expect(screen.getByLabelText("JSON output").textContent).toContain('"a"'));
    fireEvent.click(screen.getByRole("button", { name: /swap/i }));
    // Now JSON → CSV with the previous JSON output as input → produces CSV.
    await waitFor(() => expect(screen.getByLabelText("CSV output").textContent).toBe("a,b\r\n1,2"));
  });
});

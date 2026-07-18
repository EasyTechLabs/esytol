import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Component tests for the JSON ↔ YAML Converter. The conversion + YAML-scan engines are
 * unit-tested separately; here we test the UI wiring. The CodeMirror EditorPanel and
 * ResultViewer are mocked to plain elements (as elsewhere for dev tools) so the full
 * convert → output → stats → warnings flow can be driven and asserted.
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

import { JsonYamlConverter } from "@/features/tools/json-yaml-converter/JsonYamlConverter";

const typeInput = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("JsonYamlConverter", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("renders the direction tabs with JSON → YAML selected by default", () => {
    render(<JsonYamlConverter />);
    expect(screen.getByRole("tab", { name: "JSON → YAML" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "YAML → JSON" })).toBeInTheDocument();
  });

  it("converts JSON to YAML", async () => {
    render(<JsonYamlConverter />);
    typeInput(/json input editor/i, '{"name":"Esytol","tags":["a","b"]}');
    await waitFor(() =>
      expect(screen.getByLabelText("YAML output").textContent).toContain("name: Esytol")
    );
    expect(screen.getByLabelText("YAML output").textContent).toContain("- a");
  });

  it("converts YAML to JSON after switching direction", async () => {
    render(<JsonYamlConverter />);
    fireEvent.click(screen.getByRole("tab", { name: "YAML → JSON" }));
    typeInput(/yaml input editor/i, "a: 1\nb:\n  - x\n  - y");
    await waitFor(() =>
      expect(screen.getByLabelText("JSON output").textContent).toContain('"a": 1')
    );
  });

  it("resolves merge keys and expands aliases in the JSON output", async () => {
    render(<JsonYamlConverter />);
    fireEvent.click(screen.getByRole("tab", { name: "YAML → JSON" }));
    typeInput(/yaml input editor/i, "base: &b\n  role: user\nalice:\n  <<: *b\n  name: Alice");
    await waitFor(() => {
      const out = JSON.parse(screen.getByLabelText("JSON output").textContent || "{}");
      expect(out.alice).toEqual({ role: "user", name: "Alice" });
    });
  });

  it("notes a multi-document YAML stream", async () => {
    render(<JsonYamlConverter />);
    fireEvent.click(screen.getByRole("tab", { name: "YAML → JSON" }));
    typeInput(/yaml input editor/i, "---\nid: 1\n---\nid: 2\n");
    await waitFor(() =>
      expect(
        within(screen.getByLabelText("YAML notes")).getByText(/multi-document stream/i)
      ).toBeInTheDocument()
    );
  });

  it("shows statistics for a converted document", async () => {
    render(<JsonYamlConverter />);
    typeInput(/json input editor/i, '{"a":1,"b":[1,2]}');
    await waitFor(() => expect(screen.getByLabelText("Conversion statistics")).toBeInTheDocument());
  });

  it("surfaces a friendly error with a location for invalid JSON", async () => {
    render(<JsonYamlConverter />);
    typeInput(/json input editor/i, '{"a":1,}');
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/trailing comma/i));
  });

  it("swaps direction and feeds the output back in for a round-trip", async () => {
    render(<JsonYamlConverter />);
    typeInput(/json input editor/i, '{"a":1}');
    await waitFor(() => expect(screen.getByLabelText("YAML output").textContent).toContain("a: 1"));
    fireEvent.click(screen.getByRole("button", { name: /swap/i }));
    // Now YAML → JSON, input pre-filled with "a: 1" → JSON output.
    await waitFor(() =>
      expect(screen.getByLabelText("JSON output").textContent).toContain('"a": 1')
    );
  });
});

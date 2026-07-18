import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Component tests for the JSON Diff Viewer. The diff engine is unit-tested separately; here we
 * test the UI wiring — dual validation, diff rendering, statistics, identical detection, the
 * unified/side-by-side toggle, and the JSON Patch output. EditorPanel is mocked to a plain
 * textarea (its CodeMirror internals are not jsdom-drivable) so the full flow can be driven.
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

import { JsonDiffViewer } from "@/features/tools/json-diff-viewer/JsonDiffViewer";

const setLeft = (v: string) =>
  fireEvent.change(screen.getByLabelText(/left json editor/i), { target: { value: v } });
const setRight = (v: string) =>
  fireEvent.change(screen.getByLabelText(/right json editor/i), { target: { value: v } });

describe("JsonDiffViewer", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("shows the diff statistics once both sides are valid", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":1,"b":2}');
    setRight('{"a":1,"b":9,"c":3}');
    await waitFor(() => expect(screen.getByLabelText("Diff statistics")).toBeInTheDocument());
  });

  it("reports identical documents", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":1,"b":[1,2]}');
    setRight('{"a":1,"b":[1,2]}');
    await waitFor(() => expect(screen.getByText(/identical/i)).toBeInTheDocument());
  });

  it("renders the unified diff with changed values", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":1}');
    setRight('{"a":2}');
    await waitFor(() =>
      expect(
        within(screen.getByRole("tree", { name: /json diff/i })).getAllByText("changed").length
      ).toBeGreaterThan(0)
    );
  });

  it("emits an RFC 6902 JSON Patch and lets you copy it", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":1,"gone":2}');
    setRight('{"a":9,"added":3}');
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /json patch/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /copy patch/i })).toBeInTheDocument();
    // The patch pre contains replace/add/remove ops.
    const pre = document.querySelector("pre")!;
    expect(pre.textContent).toContain('"replace"');
    expect(pre.textContent).toContain('"add"');
    expect(pre.textContent).toContain('"remove"');
  });

  it("switches to the side-by-side view (two trees)", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":1}');
    setRight('{"a":2}');
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /side by side/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("tab", { name: /side by side/i }));
    await waitFor(() => expect(screen.getAllByRole("tree").length).toBe(2));
  });

  it("auto-expands changed containers so a deeply nested change is visible (jump reachable)", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":{"b":{"c":{"d":1}}}}');
    setRight('{"a":{"b":{"c":{"d":2}}}}');
    // Without any expand click, the deep change (d) should already be rendered.
    await waitFor(() =>
      expect(
        within(screen.getByRole("tree", { name: /json diff/i })).getByText("d")
      ).toBeInTheDocument()
    );
  });

  it("surfaces a friendly validation error for one invalid side", async () => {
    render(<JsonDiffViewer />);
    setLeft('{"a":1,}');
    setRight('{"a":1}');
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/trailing comma/i));
    // No stats until both are valid.
    expect(screen.queryByLabelText("Diff statistics")).not.toBeInTheDocument();
  });
});

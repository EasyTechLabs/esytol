import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Component tests for the XML Formatter & Validator. The XML engine is unit-tested separately;
 * here we test the UI wiring — formatting, validation, statistics, warnings, and the tree view.
 * EditorPanel/ResultViewer are mocked to plain elements (as for other dev tools) to drive the flow.
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

import { XmlFormatter } from "@/features/tools/xml-formatter/XmlFormatter";

const type = (v: string) =>
  fireEvent.change(screen.getByLabelText(/xml input editor/i), { target: { value: v } });

describe("XmlFormatter", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
  });

  it("pretty-prints valid XML", async () => {
    render(<XmlFormatter />);
    type("<a><b>hi</b></a>");
    await waitFor(() =>
      expect(screen.getByLabelText("Formatted XML").textContent).toBe("<a>\n  <b>hi</b>\n</a>")
    );
  });

  it("shows statistics for a valid document", async () => {
    render(<XmlFormatter />);
    type('<a id="1"><b>x</b></a>');
    await waitFor(() => expect(screen.getByLabelText("XML statistics")).toBeInTheDocument());
  });

  it("reports a friendly validation error with a location", async () => {
    render(<XmlFormatter />);
    type("<a><b></c></a>");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/mismatched/i));
    expect(screen.queryByLabelText("XML statistics")).not.toBeInTheDocument();
  });

  it("renders the tree view with element names", async () => {
    render(<XmlFormatter />);
    type("<root><child>x</child></root>");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /tree view/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("tab", { name: /tree view/i }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("tree", { name: /xml tree/i })).getByText("root")
      ).toBeInTheDocument()
    );
  });

  it("warns about a DOCTYPE and keeps entities literal (XXE-safe)", async () => {
    render(<XmlFormatter />);
    type('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><a>&xxe;</a>');
    await waitFor(() =>
      expect(within(screen.getByLabelText("XML notes")).getByText(/DOCTYPE/i)).toBeInTheDocument()
    );
    // The entity is never expanded to file contents.
    expect(screen.getByLabelText("Formatted XML").textContent).toContain("&xxe;");
    expect(screen.getByLabelText("Formatted XML").textContent).not.toContain("root:");
  });

  it("minifies when the toggle is on", async () => {
    render(<XmlFormatter />);
    type("<a>\n  <b>1</b>\n</a>");
    await waitFor(() => expect(screen.getByLabelText("Formatted XML")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/minify/i));
    await waitFor(() =>
      expect(screen.getByLabelText("Minified XML").textContent).toBe("<a><b>1</b></a>")
    );
  });
});

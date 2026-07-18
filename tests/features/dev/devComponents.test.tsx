/**
 * Shared DX component tests — DEVELOPER-001.
 *
 * Covers validation rendering, the result viewer's metrics, the editor panel's
 * toolbar + file upload, layout examples, and accessibility. CodeEditor is
 * mocked with a plain textarea so tests exercise the shared chrome
 * deterministically (the real CodeMirror engine is covered by the build).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axe from "axe-core";

vi.mock("@/features/dev/CodeEditor", () => ({
  CodeEditor: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { valid, error, warning, info } from "@/lib/dev/validation";

describe("ValidationStatus", () => {
  it("renders each level with the right role", () => {
    const { rerender } = render(<ValidationStatus validation={valid("Valid JSON")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Valid JSON");

    rerender(<ValidationStatus validation={error("Invalid JSON", "Unexpected token")} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Invalid JSON");
    expect(alert).toHaveTextContent("Unexpected token");

    rerender(<ValidationStatus validation={warning("Deprecated")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Deprecated");
    rerender(<ValidationStatus validation={info("FYI")} />);
    expect(screen.getByRole("status")).toHaveTextContent("FYI");
  });

  it("shows line/column when present, and nothing when validation is null", () => {
    const { container, rerender } = render(
      <ValidationStatus validation={{ ...error("Bad"), line: 3, column: 7 }} />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("line 3, column 7");
    rerender(<ValidationStatus validation={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ResultViewer", () => {
  it("shows char/line/byte metrics and copy+download when there is output", () => {
    render(<ResultViewer value={"ab\ncd"} label="Out" downloadName="o.txt" processingMs={5} />);
    expect(screen.getByText("Characters:")).toBeInTheDocument();
    expect(screen.getByText("Lines:")).toBeInTheDocument();
    expect(screen.getByText("Size:")).toBeInTheDocument();
    expect(screen.getByText("Time:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("shows an empty hint and no buttons when there is no output", () => {
    render(<ResultViewer value="" emptyHint="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });
});

describe("EditorPanel toolbar + upload", () => {
  it("exposes the category toolbar; Sample loads, Clear/Download disabled when empty", () => {
    const onChange = vi.fn();
    render(<EditorPanel value="" onChange={onChange} sample="SAMPLE" onToggleDark={() => {}} />);
    for (const name of ["Sample", "Paste", "Upload", "Clear", "Download", "Dark", "Full screen"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sample" }));
    expect(onChange).toHaveBeenCalledWith("SAMPLE");
  });

  it("reads an uploaded file into the editor", async () => {
    const onChange = vi.fn();
    const { container } = render(<EditorPanel value="" onChange={onChange} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    // jsdom doesn't implement File.text(); supply size + text() as real browsers have.
    const file = {
      size: 13,
      name: "data.json",
      text: () => Promise.resolve("file contents"),
    } as unknown as File;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("file contents"));
  });
});

describe("DevToolLayout", () => {
  it("renders slots, fires example clicks, and shows the privacy note", () => {
    const onExample = vi.fn();
    render(
      <DevToolLayout
        controls={<span>CONTROLS</span>}
        input={<span>INPUT</span>}
        output={<span>OUTPUT</span>}
        examples={[{ label: "Ex1", value: "v1" }]}
        onExample={onExample}
      />
    );
    expect(screen.getByText("CONTROLS")).toBeInTheDocument();
    expect(screen.getByText("INPUT")).toBeInTheDocument();
    expect(screen.getByText("OUTPUT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ex1" }));
    expect(onExample).toHaveBeenCalledWith("v1");
    expect(screen.getByText(/Runs entirely in your browser/)).toBeInTheDocument();
  });
});

describe("accessibility (axe)", () => {
  beforeEach(() => vi.clearAllMocks());
  it("the validation + layout surfaces have no serious violations", async () => {
    const { container } = render(
      <DevToolLayout
        input={<ValidationStatus validation={error("Invalid", "detail")} />}
        output={<ResultViewer value="hello" label="Output" />}
        examples={[{ label: "Ex", value: "x" }]}
      />
    );
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(serious).toEqual([]);
  });
});

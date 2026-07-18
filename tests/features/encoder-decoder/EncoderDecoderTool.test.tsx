import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Reusable UI test for the whole Encoding & Escape family (PLATFORM-005).
 *
 * Because every tool is the same `EncoderDecoderTool` with a different codec id, one parametrised
 * suite proves the shared behaviour (encode, decode, round-trip, validation, accessibility) for the
 * entire family. Adding a codec adds a row to the loop — no new UI test file. EditorPanel/ResultViewer
 * are mocked to plain elements (the standard dev-tool pattern; CodeMirror is not jsdom-drivable).
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
    <pre aria-label={`out:${label}`}>{value}</pre>
  ),
}));

import { EncoderDecoderTool } from "@/features/dev/EncoderDecoderTool";
import { CODECS, getCodec, type CodecId } from "@/lib/dev/codec";

const IDS = Object.keys(CODECS) as CodecId[];
const type = (v: string) =>
  fireEvent.change(screen.getByLabelText(/input editor/i), { target: { value: v } });

afterEach(cleanup);

describe.each(IDS)("EncoderDecoderTool [%s]", (id) => {
  const codec = getCodec(id);

  it("encodes the plain sample to the encoded sample", async () => {
    render(<EncoderDecoderTool codecId={id} />);
    type(codec.samplePlain);
    await waitFor(() => {
      const out = screen.getAllByText((_, el) => el?.tagName === "PRE")[0];
      expect(out.textContent).toBe(codec.sampleEncoded);
    });
  });

  it("decodes the encoded sample back to the plain sample", async () => {
    render(<EncoderDecoderTool codecId={id} />);
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${codec.decodeVerb}$`, "i") }));
    type(codec.sampleEncoded);
    await waitFor(() => {
      const out = screen.getAllByText((_, el) => el?.tagName === "PRE")[0];
      expect(out.textContent).toBe(codec.samplePlain);
    });
  });

  it("exposes an accessible direction tablist and a labelled input", () => {
    render(<EncoderDecoderTool codecId={id} />);
    expect(screen.getByRole("tablist", { name: /direction/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: new RegExp(`^${codec.encodeVerb}$`, "i") })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/input editor/i)).toBeInTheDocument();
  });
});

describe("EncoderDecoderTool — validation", () => {
  it("shows a friendly error for invalid hex input on decode", async () => {
    render(<EncoderDecoderTool codecId="hex" />);
    fireEvent.click(screen.getByRole("tab", { name: /decode/i }));
    type("zz");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/non-hex/i));
  });

  it("shows a friendly error for invalid binary input on decode", async () => {
    render(<EncoderDecoderTool codecId="binary" />);
    fireEvent.click(screen.getByRole("tab", { name: /decode/i }));
    type("0102");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/only 0 and 1/i));
  });
});

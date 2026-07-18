"use client";

/**
 * EncoderDecoderTool — the shared UI for the entire Encoding & Escape family (PLATFORM-005).
 *
 * Given a codec id, this renders the complete tool: an encode/decode toggle, the shared editor +
 * result viewer + validation UI, live processing, statistics, examples, and a privacy note. Every
 * tool in the family is this component with a different id — so a new encoder is a 3-line page and
 * reuses ~95% of the infrastructure. Everything runs in the browser; nothing is uploaded.
 */

import { useMemo, useState } from "react";
import { getCodec, type CodecId } from "@/lib/dev/codec";
import { timed } from "@/lib/dev/metrics";
import { type Validation, valid, error } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

export function EncoderDecoderTool({ codecId }: { codecId: CodecId }) {
  const codec = getCodec(codecId);
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);

  const { result, ms } = useMemo(() => {
    if (input === "") return { result: null, ms: 0 };
    const t = timed(() => (mode === "encode" ? codec.encode(input) : codec.decode(input)));
    return { result: t.result, ms: t.ms };
  }, [input, mode, codec]);

  const output = result?.ok ? result.output : "";
  const verb = mode === "encode" ? codec.encodeVerb : codec.decodeVerb;
  const validation: Validation | null =
    result === null
      ? null
      : result.ok
        ? valid(`${verb}d`)
        : error(`Could not ${verb.toLowerCase()}`, result.error);

  // When encoding, input is the plain side and output the encoded side; decoding is the reverse.
  const inputLabel = mode === "encode" ? codec.plainLabel : codec.encodedLabel;
  const outputLabel = mode === "encode" ? codec.encodedLabel : codec.plainLabel;
  const sampleForMode = mode === "encode" ? codec.samplePlain : codec.sampleEncoded;

  return (
    <DevToolLayout
      controls={
        <div
          role="tablist"
          aria-label="Direction"
          className="flex rounded-lg border border-gray-300 p-0.5"
        >
          {(
            [
              ["encode", codec.encodeVerb],
              ["decode", codec.decodeVerb],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-4 py-1 text-sm font-medium transition",
                mode === m ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
      input={
        <EditorPanel
          value={input}
          onChange={setInput}
          language="text"
          label={inputLabel}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          sample={sampleForMode}
          downloadName="input.txt"
          ariaLabel={`${codec.name} input editor`}
        />
      }
      validation={<ValidationStatus validation={validation} />}
      output={
        <ResultViewer
          value={output}
          language="text"
          label={outputLabel}
          downloadName="output.txt"
          processingMs={result?.ok ? ms : undefined}
          dark={dark}
        />
      }
      examples={[
        { label: "Plain sample", value: codec.samplePlain },
        { label: "Encoded sample", value: codec.sampleEncoded },
      ]}
      onExample={(v) => {
        // Load the plain sample in encode mode and the encoded sample in decode mode so the example
        // is always valid for the current direction.
        if (v === codec.sampleEncoded) setMode("decode");
        else if (v === codec.samplePlain) setMode("encode");
        setInput(v);
      }}
      privacyNote={codec.note}
    />
  );
}

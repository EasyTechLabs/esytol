"use client";

/**
 * Base64 Encoder / Decoder — migrated to the shared Developer Experience layer
 * (DEVELOPER-001, Part 10). Only Base64-specific state and the pure-engine call
 * live here; all UI is shared components.
 */

import { useMemo, useState } from "react";
import { encodeBase64, decodeBase64 } from "@/lib/dev/base64";
import { timed } from "@/lib/dev/metrics";
import { type Validation, valid, error } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

export function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);

  const { result, ms } = useMemo(() => {
    if (input === "") return { result: null, ms: 0 };
    const t = timed(() => (mode === "encode" ? encodeBase64(input, urlSafe) : decodeBase64(input)));
    return { result: t.result, ms: t.ms };
  }, [input, mode, urlSafe]);

  const output = result?.ok ? result.output : "";
  const validation: Validation | null =
    result === null
      ? null
      : result.ok
        ? valid(mode === "encode" ? "Encoded" : "Decoded")
        : error(mode === "encode" ? "Encoding failed" : "Invalid Base64", result.error);

  return (
    <DevToolLayout
      controls={
        <>
          <div className="flex rounded-lg border border-gray-300 p-0.5">
            {(["encode", "decode"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-4 py-1 text-sm font-medium capitalize transition",
                  mode === m ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === "encode" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={urlSafe}
                onChange={(e) => setUrlSafe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              URL-safe (-_, no padding)
            </label>
          )}
        </>
      }
      input={
        <EditorPanel
          value={input}
          onChange={setInput}
          language="text"
          label={mode === "encode" ? "Plain text" : "Base64"}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          sample={mode === "encode" ? "Hello, Esytol! ₹1,00,000" : "SGVsbG8sIEVzeXRvbCE="}
          downloadName={mode === "encode" ? "input.txt" : "input.b64"}
          ariaLabel="Base64 input editor"
        />
      }
      validation={<ValidationStatus validation={validation} />}
      output={
        <ResultViewer
          value={output}
          language="text"
          label={mode === "encode" ? "Base64" : "Plain text"}
          downloadName={mode === "encode" ? "encoded.b64" : "decoded.txt"}
          processingMs={result?.ok ? ms : undefined}
          dark={dark}
        />
      }
      onExample={setInput}
      privacyNote="Base64 is encoding, not encryption — anyone can decode it. Runs entirely in your browser; nothing is uploaded or stored."
    />
  );
}

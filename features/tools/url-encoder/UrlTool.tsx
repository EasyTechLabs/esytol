"use client";

/**
 * URL Encoder / Decoder — migrated to the shared Developer Experience layer
 * (DEVELOPER-001, Part 10). Only URL-specific state and the pure-engine call
 * live here; all UI is shared components.
 */

import { useMemo, useState } from "react";
import { encodeUrl, decodeUrl, type UrlMode } from "@/lib/dev/urlCodec";
import { timed } from "@/lib/dev/metrics";
import { type Validation, valid, error } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

export function UrlTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [urlMode, setUrlMode] = useState<UrlMode>("component");
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);

  const { result, ms } = useMemo(() => {
    if (input === "") return { result: null, ms: 0 };
    const t = timed(() =>
      mode === "encode" ? encodeUrl(input, urlMode) : decodeUrl(input, urlMode)
    );
    return { result: t.result, ms: t.ms };
  }, [input, mode, urlMode]);

  const output = result?.ok ? result.output : "";
  const validation: Validation | null =
    result === null
      ? null
      : result.ok
        ? valid(mode === "encode" ? "Encoded" : "Decoded")
        : error("Malformed input", result.error);

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
          <div className="flex rounded-lg border border-gray-300 p-0.5">
            {(["component", "full"] as UrlMode[]).map((um) => (
              <button
                key={um}
                type="button"
                onClick={() => setUrlMode(um)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium capitalize transition",
                  urlMode === um ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {um === "component" ? "Component" : "Full URL"}
              </button>
            ))}
          </div>
        </>
      }
      input={
        <EditorPanel
          value={input}
          onChange={setInput}
          language="text"
          label={mode === "encode" ? "Plain text" : "Encoded"}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          sample={
            mode === "encode"
              ? "https://esytol.com/search?q=home loan & tax"
              : "q%3Dhome%20loan%20%26%20tax"
          }
          ariaLabel="URL input editor"
        />
      }
      validation={<ValidationStatus validation={validation} />}
      output={
        <ResultViewer
          value={output}
          language="text"
          label={mode === "encode" ? "Encoded" : "Decoded"}
          processingMs={result?.ok ? ms : undefined}
          dark={dark}
        />
      }
      onExample={setInput}
      privacyNote={
        urlMode === "component"
          ? "Component mode escapes reserved characters (& ? = / #). Runs in your browser; nothing is uploaded."
          : "Full-URL mode preserves URL structure. Runs in your browser; nothing is uploaded."
      }
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import { encodeUrl, decodeUrl, type UrlMode } from "@/lib/dev/urlCodec";
import { CopyButton } from "@/features/tool/CopyButton";
import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

export function UrlTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [urlMode, setUrlMode] = useState<UrlMode>("component");
  const [input, setInput] = useState("");

  const result = useMemo(() => {
    if (input === "") return null;
    return mode === "encode" ? encodeUrl(input, urlMode) : decodeUrl(input, urlMode);
  }, [input, mode, urlMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
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
        {input !== "" && (
          <button
            type="button"
            onClick={() => setInput("")}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {urlMode === "component"
          ? "Component mode escapes reserved characters (& ? = / #) — for query values and path segments."
          : "Full-URL mode preserves URL structure — for encoding a whole URL."}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="url-input"
            className="text-xs font-medium uppercase tracking-widest text-gray-400"
          >
            {mode === "encode" ? "Plain text" : "Encoded"}
          </label>
          <textarea
            id="url-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder={mode === "encode" ? "Text to encode…" : "Percent-encoded text to decode…"}
            className="h-56 w-full resize-y rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              {mode === "encode" ? "Encoded" : "Decoded"}
            </span>
            {result?.ok && <CopyButton value={result.output} />}
          </div>
          {result && !result.ok ? (
            <div
              role="alert"
              className="h-56 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {result.error}
            </div>
          ) : (
            <textarea
              readOnly
              value={result?.ok ? result.output : ""}
              spellCheck={false}
              placeholder="Result appears here…"
              className="h-56 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm text-gray-800 focus:outline-none"
            />
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Runs entirely in your browser — nothing you paste is uploaded or stored.
      </p>
    </div>
  );
}

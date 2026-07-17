"use client";

import { useMemo, useState } from "react";
import { encodeBase64, decodeBase64 } from "@/lib/dev/base64";
import { CopyButton } from "@/features/tool/CopyButton";
import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

export function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState("");

  const result = useMemo(() => {
    if (input === "") return null;
    return mode === "encode" ? encodeBase64(input, urlSafe) : decodeBase64(input);
  }, [input, mode, urlSafe]);

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
        {mode === "encode" && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={urlSafe}
              onChange={(e) => setUrlSafe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            URL-safe (-_ , no padding)
          </label>
        )}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="b64-input"
            className="text-xs font-medium uppercase tracking-widest text-gray-400"
          >
            {mode === "encode" ? "Plain text" : "Base64"}
          </label>
          <textarea
            id="b64-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder={mode === "encode" ? "Text to encode…" : "Base64 to decode…"}
            className="h-64 w-full resize-y rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              {mode === "encode" ? "Base64" : "Plain text"}
            </span>
            {result?.ok && <CopyButton value={result.output} />}
          </div>
          {result && !result.ok ? (
            <div
              role="alert"
              className="h-64 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {result.error}
            </div>
          ) : (
            <textarea
              readOnly
              value={result?.ok ? result.output : ""}
              spellCheck={false}
              placeholder="Result appears here…"
              className="h-64 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm text-gray-800 focus:outline-none"
            />
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Base64 is encoding, not encryption — anyone can decode it. Runs entirely in your browser;
        nothing is uploaded or stored.
      </p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { formatJson, type IndentStyle } from "@/lib/dev/jsonFormat";
import { CopyButton, downloadText } from "@/features/tool/CopyButton";
import { cn } from "@/lib/cn";

const SAMPLE = '{"name":"Esytol","tools":18,"free":true,"tags":["finance","developer"]}';

const INDENTS: { value: IndentStyle; label: string }[] = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tabs" },
  { value: "minify", label: "Minify" },
];

export function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentStyle>("2");
  const [sortKeys, setSortKeys] = useState(false);

  const result = useMemo(
    () => (input.trim() === "" ? null : formatJson(input, { indent, sortKeys })),
    [input, indent, sortKeys]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-300 p-0.5">
          {INDENTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIndent(opt.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition",
                indent === opt.value ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={sortKeys}
            onChange={(e) => setSortKeys(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Sort keys
        </label>
        <button
          type="button"
          onClick={() => setInput(SAMPLE)}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Load sample
        </button>
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

      {/* Editors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="json-input"
            className="text-xs font-medium uppercase tracking-widest text-gray-400"
          >
            Input
          </label>
          <textarea
            id="json-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="Paste JSON here…"
            className="h-80 w-full resize-y rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
              Output
            </span>
            {result?.ok && (
              <span className="flex gap-2">
                <CopyButton value={result.output} />
                <button
                  type="button"
                  onClick={() => downloadText("formatted.json", result.output)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Download
                </button>
              </span>
            )}
          </div>
          {result && !result.ok ? (
            <div
              role="alert"
              className="flex h-80 flex-col gap-1 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <strong>Invalid JSON</strong>
              <span className="font-mono">{result.error}</span>
              {result.line !== null && (
                <span className="text-red-600">
                  Around line {result.line}
                  {result.column !== null ? `, column ${result.column}` : ""}.
                </span>
              )}
            </div>
          ) : (
            <textarea
              readOnly
              value={result?.ok ? result.output : ""}
              spellCheck={false}
              placeholder="Formatted JSON appears here…"
              className="h-80 w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-sm text-gray-800 focus:outline-none"
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

"use client";

/**
 * JSON Formatter — migrated to the shared Developer Experience layer
 * (DEVELOPER-001, Part 10). All UI is now shared components; this file holds
 * only JSON-specific state and the call into the pure engine.
 */

import { useMemo, useState } from "react";
import { formatJson, type IndentStyle } from "@/lib/dev/jsonFormat";
import { timed } from "@/lib/dev/metrics";
import { type Validation, valid, error } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { cn } from "@/lib/cn";

const SAMPLE = '{"name":"Esytol","tools":21,"free":true,"tags":["finance","developer"]}';
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
  const [dark, setDark] = useState(false);

  const { result, ms } = useMemo(() => {
    if (input.trim() === "") return { result: null, ms: 0 };
    const t = timed(() => formatJson(input, { indent, sortKeys }));
    return { result: t.result, ms: t.ms };
  }, [input, indent, sortKeys]);

  const output = result?.ok ? result.output : "";
  const validation: Validation | null =
    result === null
      ? null
      : result.ok
        ? valid("Valid JSON", `${result.bytes.toLocaleString()} characters formatted`)
        : {
            ...error("Invalid JSON", result.error),
            line: result.line ?? undefined,
            column: result.column ?? undefined,
          };

  return (
    <DevToolLayout
      controls={
        <>
          <div className="flex rounded-lg border border-gray-300 p-0.5">
            {INDENTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIndent(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition",
                  indent === opt.value
                    ? "bg-brand-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
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
        </>
      }
      input={
        <EditorPanel
          value={input}
          onChange={setInput}
          language="json"
          label="JSON input"
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          onFormat={result?.ok ? () => setInput(result.output) : undefined}
          sample={SAMPLE}
          downloadName="input.json"
          ariaLabel="JSON input editor"
        />
      }
      validation={<ValidationStatus validation={validation} />}
      output={
        <ResultViewer
          value={output}
          language="json"
          label="Formatted JSON"
          downloadName="formatted.json"
          processingMs={result?.ok ? ms : undefined}
          dark={dark}
        />
      }
      examples={[
        {
          label: "Nested object",
          value: '{"user":{"id":1,"roles":["admin","dev"]},"active":true}',
        },
        { label: "Array", value: '[3,1,2,{"k":"v"}]' },
        { label: "Minified", value: '{"a":1,"b":{"c":[1,2,3]}}' },
      ]}
      onExample={setInput}
    />
  );
}

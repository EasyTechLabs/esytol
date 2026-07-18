"use client";

/**
 * JSON Formatter & Validator (TOOL-005 upgrade).
 *
 * Built on the shared Developer Experience layer — the editor, result viewer,
 * validation UI, layout, and format engine are all reused unchanged. This upgrade
 * adds the validator/inspector layer over lib/dev/jsonInsights: human-friendly error
 * explanations, JSON statistics, duplicate-key and unsafe-integer warnings, and an
 * interactive, searchable tree view. Everything runs in the browser — no JSON is
 * ever uploaded.
 */

import { useMemo, useState } from "react";
import { formatJson, type IndentStyle } from "@/lib/dev/jsonFormat";
import { analyzeJson, scanJson, explainJsonError, type JsonStats } from "@/lib/dev/jsonInsights";
import { timed } from "@/lib/dev/metrics";
import { type Validation, valid, error } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { JsonTree } from "./JsonTree";
import { cn } from "@/lib/cn";

const SAMPLE =
  '{"name":"Esytol","tools":27,"free":true,"tags":["finance","developer","security"],"meta":{"stars":4.9,"nested":{"deep":true}}}';
const INDENTS: { value: IndentStyle; label: string }[] = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tabs" },
  { value: "minify", label: "Minify" },
];
// Above this many values, the interactive tree is skipped to keep the tab responsive
// (the formatted view and statistics still work on documents of any size).
const MAX_TREE_VALUES = 15000;

export function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentStyle>("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"formatted" | "tree">("formatted");

  const { result, ms } = useMemo(() => {
    if (input.trim() === "") return { result: null, ms: 0 };
    const t = timed(() => formatJson(input, { indent, sortKeys }));
    return { result: t.result, ms: t.ms };
  }, [input, indent, sortKeys]);

  // Parse once for stats + tree (only when valid). Cheap next to a keystroke.
  const parsed = useMemo<{ value: unknown } | null>(() => {
    if (!result?.ok) return null;
    try {
      return { value: JSON.parse(input) };
    } catch {
      return null;
    }
  }, [result, input]);

  const stats = useMemo<JsonStats | null>(
    () => (parsed ? analyzeJson(parsed.value) : null),
    [parsed]
  );
  const scan = useMemo(() => (result?.ok ? scanJson(input) : null), [result, input]);

  const output = result?.ok ? result.output : "";

  const validation: Validation | null =
    result === null
      ? null
      : result.ok
        ? valid(
            "Valid JSON",
            stats
              ? `${input.length.toLocaleString()} chars · ${stats.objects} object${stats.objects === 1 ? "" : "s"} · ${stats.arrays} array${stats.arrays === 1 ? "" : "s"} · depth ${stats.maxDepth}`
              : undefined
          )
        : {
            ...error("Invalid JSON", explainJsonError(input, result.error)),
            line: result.line ?? undefined,
            column: result.column ?? undefined,
          };

  return (
    <div className="flex flex-col gap-6">
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
                className="h-4 w-4 rounded border-gray-300 accent-brand-600"
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
          { label: "Duplicate keys", value: '{"a":1,"a":2}' },
          { label: "Trailing comma", value: '{"a":1,}' },
        ]}
        onExample={setInput}
      />

      {stats && scan && parsed && (
        <div className="flex flex-col gap-4">
          <StatsPanel stats={stats} input={input} />

          {(scan.duplicateKeys.length > 0 || scan.bigIntegers.length > 0) && (
            <WarningsPanel duplicateKeys={scan.duplicateKeys} bigIntegers={scan.bigIntegers} />
          )}

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Explore</h2>
              <div
                role="tablist"
                aria-label="Output view"
                className="inline-flex rounded-lg border border-gray-300 p-0.5"
              >
                {(["formatted", "tree"] as const).map((v) => (
                  <button
                    key={v}
                    role="tab"
                    type="button"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      "rounded-md px-3 py-1 text-sm font-medium capitalize transition",
                      view === v ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {v === "tree" ? "Tree view" : "Formatted"}
                  </button>
                ))}
              </div>
            </div>

            {view === "tree" ? (
              stats.totalValues > MAX_TREE_VALUES ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This document has {stats.totalValues.toLocaleString()} values — too many for the
                  interactive tree. Use the Formatted view, which handles documents of any size.
                </p>
              ) : (
                <JsonTree value={parsed.value} />
              )
            ) : (
              <pre className="max-h-[28rem] overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                <code>{output}</code>
              </pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function StatsPanel({ stats, input }: { stats: JsonStats; input: string }) {
  const lines = input.split("\n").length;
  const items: { label: string; value: number }[] = [
    { label: "Characters", value: input.length },
    { label: "Lines", value: lines },
    { label: "Objects", value: stats.objects },
    { label: "Arrays", value: stats.arrays },
    { label: "Properties", value: stats.properties },
    { label: "Max depth", value: stats.maxDepth },
    { label: "Strings", value: stats.strings },
    { label: "Numbers", value: stats.numbers },
    { label: "Booleans", value: stats.booleans },
    { label: "Nulls", value: stats.nulls },
  ];
  return (
    <section
      aria-label="JSON statistics"
      className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-5"
    >
      {items.map((it) => (
        <div key={it.label} className="flex flex-col">
          <span className="text-lg font-semibold tabular-nums text-gray-900">
            {it.value.toLocaleString()}
          </span>
          <span className="text-xs uppercase tracking-wide text-gray-400">{it.label}</span>
        </div>
      ))}
    </section>
  );
}

// ─── Warnings (valid JSON, but worth knowing) ────────────────────────────────

function WarningsPanel({
  duplicateKeys,
  bigIntegers,
}: {
  duplicateKeys: { key: string; line: number; column: number }[];
  bigIntegers: { value: string; line: number; column: number }[];
}) {
  return (
    <section
      aria-label="JSON warnings"
      className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      {duplicateKeys.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {duplicateKeys.length} duplicate key{duplicateKeys.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-amber-800">
            JSON is technically valid with duplicate keys, but <code>JSON.parse</code> keeps only
            the last value — the earlier ones are silently lost.
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {duplicateKeys.map((d, i) => (
              <li
                key={i}
                className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-amber-900"
              >
                &quot;{d.key}&quot; @ line {d.line}
              </li>
            ))}
          </ul>
        </div>
      )}
      {bigIntegers.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {bigIntegers.length} number{bigIntegers.length === 1 ? "" : "s"} beyond safe integer
            range
          </p>
          <p className="text-xs text-amber-800">
            These exceed JavaScript&apos;s safe integer limit (±9,007,199,254,740,991) and lose
            precision when parsed with <code>JSON.parse</code>. Parse them as strings or use a
            BigInt reviver if exactness matters.
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {bigIntegers.map((b, i) => (
              <li
                key={i}
                className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-amber-900"
              >
                {b.value} @ line {b.line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

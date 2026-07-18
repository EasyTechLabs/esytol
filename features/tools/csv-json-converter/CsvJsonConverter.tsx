"use client";

/**
 * CSV ↔ JSON Converter — DEVELOPER-005.
 *
 * Reuses the shared editor + result viewer + validation UI + layout and the JsonTree explorer; the
 * only new logic is the CSV engine (lib/dev/csv) and the CSV table preview. Everything runs in the
 * browser — no data is ever uploaded, and spreadsheet formulas are treated as plain text (never run).
 */

import { useMemo, useState } from "react";
import {
  convertCsvJson,
  type CsvDirection,
  type JsonIndent,
  type CsvStats,
  type CsvWarning,
} from "@/lib/dev/csv";
import { timed } from "@/lib/dev/metrics";
import { type Validation } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { JsonTree } from "@/features/tools/json-formatter/JsonTree";
import { CsvTablePreview } from "./CsvTable";
import { cn } from "@/lib/cn";

const SAMPLE_CSV =
  'id,name,role,active\n1,Alice,admin,true\n2,Bob,"developer, senior",false\n3,Chloé,designer,true';
const SAMPLE_JSON =
  '[{"id":1,"name":"Alice","address":{"city":"Pune","zip":"411001"},"tags":["admin","dev"]},{"id":2,"name":"Bob","address":{"city":"Delhi","zip":"110001"},"tags":["dev"]}]';

const JSON_INDENTS: { value: JsonIndent; label: string }[] = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "minify", label: "Minify" },
];
const DELIMITERS: { value: string; label: string }[] = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
];
const MAX_TREE_VALUES = 15000;

export function CsvJsonConverter() {
  const [direction, setDirection] = useState<CsvDirection>("csv2json");
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"output" | "table" | "tree">("output");

  // csv2json options
  const [hasHeader, setHasHeader] = useState(true);
  const [inferTypes, setInferTypes] = useState(false);
  const [autoDelimiter, setAutoDelimiter] = useState(true);
  const [delimiter, setDelimiter] = useState<string>(",");
  const [jsonIndent, setJsonIndent] = useState<JsonIndent>("2");
  // json2csv options
  const [sanitizeInjection, setSanitizeInjection] = useState(true);

  const fromLang = direction === "csv2json" ? "text" : "json";
  const toLang = direction === "csv2json" ? "json" : "text";
  const fromLabel = direction === "csv2json" ? "CSV" : "JSON";
  const toLabel = direction === "csv2json" ? "JSON" : "CSV";

  const { result, ms } = useMemo(() => {
    if (input.trim() === "") return { result: null, ms: 0 };
    const t = timed(() =>
      convertCsvJson(input, direction, {
        hasHeader,
        inferTypes,
        jsonIndent,
        sanitizeInjection,
        delimiter: autoDelimiter && direction === "csv2json" ? undefined : delimiter,
      })
    );
    return { result: t.result, ms: t.ms };
  }, [
    input,
    direction,
    hasHeader,
    inferTypes,
    jsonIndent,
    sanitizeInjection,
    autoDelimiter,
    delimiter,
  ]);

  const output = result?.ok ? result.output : "";
  const validation: Validation | null = result === null ? null : result.validation;

  const swap = () => {
    setDirection((d) => (d === "csv2json" ? "json2csv" : "csv2json"));
    setView("output");
    if (result?.ok) setInput(result.output);
  };

  // Reset the explorer tab when switching direction so we never show a stale panel.
  const onDirection = (d: CsvDirection) => {
    setDirection(d);
    setView("output");
  };

  return (
    <div className="flex flex-col gap-6">
      <DevToolLayout
        controls={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Conversion direction"
              className="inline-flex items-center rounded-lg border border-gray-300 p-0.5"
            >
              {(
                [
                  ["csv2json", "CSV → JSON"],
                  ["json2csv", "JSON → CSV"],
                ] as [CsvDirection, string][]
              ).map(([d, label]) => (
                <button
                  key={d}
                  role="tab"
                  type="button"
                  aria-selected={direction === d}
                  onClick={() => onDirection(d)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition",
                    direction === d ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={swap}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                title="Swap direction and feed the output back in"
              >
                ⇄ Swap
              </button>

              {direction === "csv2json" ? (
                <>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => setHasHeader(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                    />
                    Header row
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={inferTypes}
                      onChange={(e) => setInferTypes(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                    />
                    Infer types
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={autoDelimiter}
                      onChange={(e) => setAutoDelimiter(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                    />
                    Auto delimiter
                  </label>
                  {!autoDelimiter && <DelimiterPicker value={delimiter} onChange={setDelimiter} />}
                </>
              ) : (
                <>
                  <DelimiterPicker value={delimiter} onChange={setDelimiter} />
                  <label
                    className="flex items-center gap-2 text-sm text-gray-700"
                    title="Prefix cells starting with = + - @ so a spreadsheet can't run them as formulas"
                  >
                    <input
                      type="checkbox"
                      checked={sanitizeInjection}
                      onChange={(e) => setSanitizeInjection(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                    />
                    Protect formulas
                  </label>
                </>
              )}

              {direction === "csv2json" && (
                <div className="flex rounded-lg border border-gray-300 p-0.5">
                  {JSON_INDENTS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setJsonIndent(opt.value)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition",
                        jsonIndent === opt.value
                          ? "bg-brand-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        }
        input={
          <EditorPanel
            value={input}
            onChange={setInput}
            language={fromLang}
            label={`${fromLabel} input`}
            dark={dark}
            onToggleDark={() => setDark((d) => !d)}
            sample={direction === "csv2json" ? SAMPLE_CSV : SAMPLE_JSON}
            downloadName={direction === "csv2json" ? "input.csv" : "input.json"}
            ariaLabel={`${fromLabel} input editor`}
          />
        }
        validation={<ValidationStatus validation={validation} />}
        output={
          <ResultViewer
            value={output}
            language={toLang}
            label={`${toLabel} output`}
            downloadName={direction === "csv2json" ? "converted.json" : "converted.csv"}
            processingMs={result?.ok ? ms : undefined}
            dark={dark}
          />
        }
        examples={
          direction === "csv2json"
            ? [
                { label: "Semicolons", value: "a;b;c\n1;2;3" },
                { label: "Quoted", value: 'name,note\nAlice,"a, b, c"\nBob,"say ""hi"""' },
                { label: "Types", value: "id,active,score\n1,true,9.5\n2,false,7" },
              ]
            : [
                { label: "Flat", value: '[{"a":1,"b":2},{"a":3,"b":4}]' },
                { label: "Nested", value: '[{"user":{"id":1,"name":"A"}}]' },
                { label: "Ragged", value: '[{"a":1},{"a":2,"b":3}]' },
              ]
        }
        onExample={setInput}
      />

      {result?.ok && result.stats && (
        <div className="flex flex-col gap-4">
          <StatsPanel stats={result.stats} />

          {result.warnings.length > 0 && <WarningsPanel warnings={result.warnings} />}

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Explore</h2>
              <div
                role="tablist"
                aria-label="Output view"
                className="inline-flex rounded-lg border border-gray-300 p-0.5"
              >
                {(["output", "table", "tree"] as const).map((v) => (
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
                    {v === "table" ? "Table" : v === "tree" ? "JSON tree" : "Output"}
                  </button>
                ))}
              </div>
            </div>

            {view === "table" ? (
              result.table ? (
                <CsvTablePreview table={result.table} />
              ) : null
            ) : view === "tree" ? (
              result.value !== undefined ? (
                <JsonTreeGuard value={result.value} />
              ) : null
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

function JsonTreeGuard({ value }: { value: unknown }) {
  const count = useMemo(() => countValues(value), [value]);
  if (count > MAX_TREE_VALUES)
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        This document has {count.toLocaleString()} values — too many for the interactive tree. The
        converted output above and the table preview handle data of any size.
      </p>
    );
  return <JsonTree value={value} />;
}

function countValues(value: unknown): number {
  let n = 1;
  if (Array.isArray(value)) for (const v of value) n += countValues(v);
  else if (value && typeof value === "object")
    for (const v of Object.values(value as Record<string, unknown>)) n += countValues(v);
  return n;
}

function DelimiterPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <span className="text-gray-500">Delimiter</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Delimiter"
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
      >
        {DELIMITERS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: CsvStats }) {
  const bytes = stats.bytes;
  const items: { label: string; value: string | number }[] = [
    { label: "Rows", value: stats.rows },
    { label: "Columns", value: stats.columns },
    { label: "Empty cells", value: stats.emptyCells },
    { label: "Max width", value: stats.maxWidth },
    { label: "Characters", value: stats.characters },
    {
      label: "File size",
      value: `${(bytes / 1024).toFixed(bytes < 1024 ? 0 : 1)} ${bytes < 1024 ? "B" : "KB"}`,
    },
  ];
  return (
    <section
      aria-label="CSV statistics"
      className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-6"
    >
      {items.map((it) => (
        <div key={it.label} className="flex flex-col">
          <span className="text-lg font-semibold tabular-nums text-gray-900">
            {typeof it.value === "number" ? it.value.toLocaleString() : it.value}
          </span>
          <span className="text-xs uppercase tracking-wide text-gray-400">{it.label}</span>
        </div>
      ))}
    </section>
  );
}

// ─── Warnings / notes ────────────────────────────────────────────────────────

function WarningsPanel({ warnings }: { warnings: CsvWarning[] }) {
  return (
    <section aria-label="Conversion notes" className="flex flex-col gap-2">
      {warnings.map((n, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-1 rounded-lg border p-3",
            n.severity === "warning" ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold text-white",
                n.severity === "warning" ? "bg-amber-500" : "bg-blue-500"
              )}
            >
              {n.severity === "warning" ? "Warning" : "Info"}
            </span>
            <span className="text-sm font-semibold text-gray-900">{n.title}</span>
          </div>
          <p className="text-xs text-gray-700">{n.detail}</p>
        </div>
      ))}
    </section>
  );
}

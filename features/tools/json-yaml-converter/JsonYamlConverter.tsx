"use client";

/**
 * JSON ↔ YAML Converter — DEVELOPER-002.
 *
 * Composed almost entirely from shared pieces: the CodeMirror editor + result viewer +
 * validation UI + the JsonTree explorer + jsonInsights statistics — all reused unchanged.
 * The only new logic is the conversion engine (lib/dev/jsonYaml) and the YAML feature scan
 * (lib/dev/yamlInsights). Everything runs in the browser; no document is ever uploaded.
 */

import { useMemo, useState } from "react";
import { convert, type Direction, type JsonIndent } from "@/lib/dev/jsonYaml";
import { analyzeJson, scanJson, type JsonStats } from "@/lib/dev/jsonInsights";
import { scanYaml, type YamlScan } from "@/lib/dev/yamlInsights";
import { timed } from "@/lib/dev/metrics";
import { type Validation } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { JsonTree } from "@/features/tools/json-formatter/JsonTree";
import { cn } from "@/lib/cn";

const SAMPLE_JSON =
  '{"name":"Esytol","tools":28,"free":true,"tags":["finance","developer","security"],"meta":{"stars":4.9}}';
const SAMPLE_YAML =
  "name: Esytol\ntools: 28\nfree: true\ntags:\n  - finance\n  - developer\n  - security\nmeta:\n  stars: 4.9\n";

const JSON_INDENTS: { value: JsonIndent; label: string }[] = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "minify", label: "Minify" },
];
const MAX_TREE_VALUES = 15000;

export function JsonYamlConverter() {
  const [direction, setDirection] = useState<Direction>("json2yaml");
  const [input, setInput] = useState("");
  const [jsonIndent, setJsonIndent] = useState<JsonIndent>("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"output" | "tree">("output");

  const fromLang = direction === "json2yaml" ? "json" : "yaml";
  const toLang = direction === "json2yaml" ? "yaml" : "json";

  const { result, ms } = useMemo(() => {
    if (input.trim() === "") return { result: null, ms: 0 };
    const t = timed(() => convert(input, direction, { jsonIndent, sortKeys }));
    return { result: t.result, ms: t.ms };
  }, [input, direction, jsonIndent, sortKeys]);

  const output = result?.ok ? result.output : "";

  const stats = useMemo<JsonStats | null>(
    () => (result?.ok && result.value !== undefined ? analyzeJson(result.value) : null),
    [result]
  );

  // JSON-side warnings (duplicate keys, unsafe integers) apply when JSON is the *input*.
  const jsonScan = useMemo(
    () => (result?.ok && direction === "json2yaml" ? scanJson(input) : null),
    [result, direction, input]
  );
  // YAML feature notes (anchors/aliases/merge/multi-doc/tags) apply when YAML is the *input*.
  const yamlScan = useMemo<YamlScan | null>(
    () => (result?.ok && direction === "yaml2json" ? scanYaml(input, result.documentCount) : null),
    [result, direction, input]
  );

  const validation: Validation | null = result === null ? null : result.validation;

  const swap = () => {
    // Swap direction and move the current output into the input, so a round-trip is one click.
    setDirection((d) => (d === "json2yaml" ? "yaml2json" : "json2yaml"));
    if (result?.ok) setInput(result.output);
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
                  ["json2yaml", "JSON → YAML"],
                  ["yaml2json", "YAML → JSON"],
                ] as [Direction, string][]
              ).map(([d, label]) => (
                <button
                  key={d}
                  role="tab"
                  type="button"
                  aria-selected={direction === d}
                  onClick={() => setDirection(d)}
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
              {direction === "yaml2json" && (
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
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sortKeys}
                  onChange={(e) => setSortKeys(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-brand-600"
                />
                Sort keys
              </label>
            </div>
          </div>
        }
        input={
          <EditorPanel
            value={input}
            onChange={setInput}
            language={fromLang}
            label={`${fromLang.toUpperCase()} input`}
            dark={dark}
            onToggleDark={() => setDark((d) => !d)}
            sample={direction === "json2yaml" ? SAMPLE_JSON : SAMPLE_YAML}
            downloadName={`input.${fromLang}`}
            ariaLabel={`${fromLang.toUpperCase()} input editor`}
          />
        }
        validation={<ValidationStatus validation={validation} />}
        output={
          <ResultViewer
            value={output}
            language={toLang}
            label={`${toLang.toUpperCase()} output`}
            downloadName={`converted.${toLang}`}
            processingMs={result?.ok ? ms : undefined}
            dark={dark}
          />
        }
        examples={
          direction === "json2yaml"
            ? [
                { label: "Nested", value: '{"user":{"id":1,"roles":["admin","dev"]}}' },
                { label: "Array", value: '[1,2,{"k":"v"}]' },
                { label: "Unicode", value: '{"msg":"₹ é 😀","ok":true}' },
              ]
            : [
                { label: "Basic", value: "a: 1\nb:\n  - x\n  - y" },
                {
                  label: "Anchors & merge",
                  value: "base: &b\n  role: user\nalice:\n  <<: *b\n  name: Alice",
                },
                { label: "Multi-document", value: "---\nid: 1\n---\nid: 2\n" },
              ]
        }
        onExample={setInput}
      />

      {result?.ok && stats && (
        <div className="flex flex-col gap-4">
          <StatsPanel stats={stats} output={output} />

          {jsonScan && (jsonScan.duplicateKeys.length > 0 || jsonScan.bigIntegers.length > 0) && (
            <WarningsPanel
              duplicateKeys={jsonScan.duplicateKeys}
              bigIntegers={jsonScan.bigIntegers}
            />
          )}

          {yamlScan && yamlScan.notes.length > 0 && <YamlNotesPanel notes={yamlScan.notes} />}

          {result.value !== undefined && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Explore</h2>
                <div
                  role="tablist"
                  aria-label="Output view"
                  className="inline-flex rounded-lg border border-gray-300 p-0.5"
                >
                  {(["output", "tree"] as const).map((v) => (
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
                      {v === "tree" ? "Tree view" : "Output"}
                    </button>
                  ))}
                </div>
              </div>

              {view === "tree" ? (
                stats.totalValues > MAX_TREE_VALUES ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    This document has {stats.totalValues.toLocaleString()} values — too many for the
                    interactive tree. The converted output above handles documents of any size.
                  </p>
                ) : (
                  <JsonTree value={result.value} />
                )
              ) : (
                <pre className="max-h-[28rem] overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                  <code>{output}</code>
                </pre>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Statistics ──────────────────────────────────────────────────────────────

function StatsPanel({ stats, output }: { stats: JsonStats; output: string }) {
  const bytes = new TextEncoder().encode(output).length;
  const items: { label: string; value: string | number }[] = [
    { label: "Objects", value: stats.objects },
    { label: "Arrays", value: stats.arrays },
    { label: "Scalars", value: stats.strings + stats.numbers + stats.booleans + stats.nulls },
    { label: "Properties", value: stats.properties },
    { label: "Max depth", value: stats.maxDepth },
    { label: "Out chars", value: output.length },
    { label: "Out lines", value: output.split("\n").length },
    {
      label: "Out size",
      value: `${(bytes / 1024).toFixed(bytes < 1024 ? 0 : 1)} ${bytes < 1024 ? "B" : "KB"}`,
    },
  ];
  return (
    <section
      aria-label="Conversion statistics"
      className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-4"
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

// ─── JSON-side warnings ──────────────────────────────────────────────────────

function WarningsPanel({
  duplicateKeys,
  bigIntegers,
}: {
  duplicateKeys: { key: string; line: number }[];
  bigIntegers: { value: string; line: number }[];
}) {
  return (
    <section
      aria-label="Input warnings"
      className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      {duplicateKeys.length > 0 && (
        <p className="text-sm text-amber-900">
          <strong>
            {duplicateKeys.length} duplicate key{duplicateKeys.length === 1 ? "" : "s"}
          </strong>{" "}
          in the JSON input — only the last value of each survives conversion (
          {duplicateKeys.map((d) => `"${d.key}"@${d.line}`).join(", ")}).
        </p>
      )}
      {bigIntegers.length > 0 && (
        <p className="text-sm text-amber-900">
          <strong>
            {bigIntegers.length} number{bigIntegers.length === 1 ? "" : "s"}
          </strong>{" "}
          beyond JavaScript&apos;s safe integer range (±9,007,199,254,740,991) — precision may be
          lost ({bigIntegers.map((b) => `${b.value}@${b.line}`).join(", ")}).
        </p>
      )}
    </section>
  );
}

// ─── YAML feature notes ──────────────────────────────────────────────────────

function YamlNotesPanel({ notes }: { notes: YamlScan["notes"] }) {
  return (
    <section aria-label="YAML notes" className="flex flex-col gap-2">
      {notes.map((n, i) => (
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

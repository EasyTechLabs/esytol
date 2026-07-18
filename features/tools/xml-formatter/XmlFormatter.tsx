"use client";

/**
 * XML Formatter & Validator — DEVELOPER-004.
 *
 * Reuses the shared editor + result viewer + validation UI + layout; the only new logic is the
 * XXE-safe XML engine (lib/dev/xml) and the XmlTree. Everything runs in the browser — no XML is
 * ever uploaded, and external entities / DTDs are never resolved.
 */

import { useMemo, useState } from "react";
import { formatXml, analyzeXml, type XmlIndent, type XmlStats, type XmlMeta } from "@/lib/dev/xml";
import { timed } from "@/lib/dev/metrics";
import { type Validation } from "@/lib/dev/validation";
import { DevToolLayout } from "@/features/dev/DevToolLayout";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ResultViewer } from "@/features/dev/ResultViewer";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { XmlTree } from "./XmlTree";
import { cn } from "@/lib/cn";

const SAMPLE =
  '<?xml version="1.0" encoding="UTF-8"?>\n<catalog xmlns:app="urn:esytol"><book id="b1" app:featured="true"><title>Esytol</title><tags><tag>dev</tag><tag>xml</tag></tags><!-- a comment --></book></catalog>';

const INDENTS: { value: XmlIndent; label: string }[] = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tabs" },
];
const MAX_TREE_ELEMENTS = 15000;

export function XmlFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<XmlIndent>("2");
  const [minify, setMinify] = useState(false);
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"formatted" | "tree">("formatted");

  const { result, ms } = useMemo(() => {
    if (input.trim() === "") return { result: null, ms: 0 };
    const t = timed(() => formatXml(input, { indent, minify }));
    return { result: t.result, ms: t.ms };
  }, [input, indent, minify]);

  const output = result?.ok ? result.output : "";
  const stats = useMemo<XmlStats | null>(
    () => (result?.ok ? analyzeXml(result.nodes) : null),
    [result]
  );
  const validation: Validation | null = result === null ? null : result.validation;
  const meta = result?.ok ? result.meta : null;

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
                  disabled={minify}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition disabled:opacity-40",
                    indent === opt.value && !minify
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
                checked={minify}
                onChange={(e) => setMinify(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-brand-600"
              />
              Minify
            </label>
          </>
        }
        input={
          <EditorPanel
            value={input}
            onChange={setInput}
            language="xml"
            label="XML input"
            dark={dark}
            onToggleDark={() => setDark((d) => !d)}
            onFormat={result?.ok ? () => setInput(result.output) : undefined}
            sample={SAMPLE}
            downloadName="input.xml"
            ariaLabel="XML input editor"
          />
        }
        validation={<ValidationStatus validation={validation} />}
        output={
          <ResultViewer
            value={output}
            language="xml"
            label={minify ? "Minified XML" : "Formatted XML"}
            downloadName="formatted.xml"
            processingMs={result?.ok ? ms : undefined}
            dark={dark}
          />
        }
        examples={[
          { label: "Namespaces", value: '<r xmlns:a="urn:a"><a:x>1</a:x></r>' },
          { label: "Attributes", value: '<item id="1" active="true"/>' },
          { label: "CDATA", value: "<code><![CDATA[if (a<b) {}]]></code>" },
        ]}
        onExample={setInput}
      />

      {result?.ok && stats && meta && (
        <div className="flex flex-col gap-4">
          <StatsPanel stats={stats} input={input} />
          <WarningsPanel meta={meta} />

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
              stats.elements > MAX_TREE_ELEMENTS ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This document has {stats.elements.toLocaleString()} elements — too many for the
                  interactive tree. The formatted output above handles documents of any size.
                </p>
              ) : (
                <XmlTree nodes={result.nodes} />
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

function StatsPanel({ stats, input }: { stats: XmlStats; input: string }) {
  const items: { label: string; value: number }[] = [
    { label: "Elements", value: stats.elements },
    { label: "Attributes", value: stats.attributes },
    { label: "Text nodes", value: stats.textNodes },
    { label: "Max depth", value: stats.maxDepth },
    { label: "Characters", value: input.length },
    { label: "Lines", value: input.split("\n").length },
  ];
  return (
    <section
      aria-label="XML statistics"
      className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-6"
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

// ─── Warnings / notes ────────────────────────────────────────────────────────

function WarningsPanel({ meta }: { meta: XmlMeta }) {
  const notes: { severity: "info" | "warning"; text: React.ReactNode }[] = [];

  if (meta.duplicateAttributes.length > 0)
    notes.push({
      severity: "warning",
      text: (
        <>
          <strong>
            {meta.duplicateAttributes.length} duplicate attribute
            {meta.duplicateAttributes.length === 1 ? "" : "s"}
          </strong>{" "}
          — duplicate attribute names are not well-formed XML (
          {meta.duplicateAttributes.map((d) => `${d.attr}@${d.line}`).join(", ")}).
        </>
      ),
    });
  if (meta.hasDoctype)
    notes.push({
      severity: "warning",
      text: (
        <>
          <strong>DOCTYPE / DTD present.</strong> External entities and DTDs are{" "}
          <strong>never resolved or fetched</strong> here (XXE-safe) — entity references are shown
          literally, not expanded.
        </>
      ),
    });
  if (meta.entityRefs.length > 0)
    notes.push({
      severity: "info",
      text: (
        <>
          <strong>Entity references:</strong>{" "}
          <span className="font-mono">{meta.entityRefs.join(" ")}</span> — kept literal, never
          expanded.
        </>
      ),
    });
  if (meta.namespaces.length > 0)
    notes.push({
      severity: "info",
      text: (
        <>
          <strong>Namespaces:</strong>{" "}
          <span className="font-mono">{meta.namespaces.join(" · ")}</span>
        </>
      ),
    });
  if (meta.processingInstructions.length > 0)
    notes.push({
      severity: "info",
      text: (
        <>
          <strong>Processing instructions:</strong>{" "}
          <span className="font-mono">{meta.processingInstructions.join(", ")}</span>
        </>
      ),
    });
  if (meta.hasDeclaration)
    notes.push({ severity: "info", text: <>An XML declaration (&lt;?xml … ?&gt;) is present.</> });

  if (notes.length === 0) return null;
  return (
    <section aria-label="XML notes" className="flex flex-col gap-2">
      {notes.map((n, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            n.severity === "warning"
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          )}
        >
          <span
            className={cn(
              "mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white",
              n.severity === "warning" ? "bg-amber-500" : "bg-blue-500"
            )}
          >
            {n.severity === "warning" ? "Warning" : "Info"}
          </span>
          <span>{n.text}</span>
        </div>
      ))}
    </section>
  );
}

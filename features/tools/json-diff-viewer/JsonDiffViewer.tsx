"use client";

/**
 * JSON Diff Viewer — DEVELOPER-003.
 *
 * Two JSON documents in, a structural diff out. Reuses the shared editor + validation UI, the
 * TOOL-005 `JsonTree` for the side-by-side view, and the JSON insight statistics. The new logic is
 * the reusable diff engine (lib/dev/jsonDiff) and the unified `DiffTree`. Everything runs in the
 * browser; nothing is uploaded.
 */

import { useMemo, useState } from "react";
import { formatJson } from "@/lib/dev/jsonFormat";
import { explainJsonError } from "@/lib/dev/jsonInsights";
import { diffValues, diffStats, toJsonPatch, isIdentical } from "@/lib/dev/jsonDiff";
import { timed } from "@/lib/dev/metrics";
import { downloadText } from "@/lib/dev/files";
import { type Validation, valid, error } from "@/lib/dev/validation";
import { EditorPanel } from "@/features/dev/EditorPanel";
import { ValidationStatus } from "@/features/dev/ValidationStatus";
import { CopyButton } from "@/features/tool/CopyButton";
import { JsonTree } from "@/features/tools/json-formatter/JsonTree";
import { DiffTree } from "./DiffTree";
import { cn } from "@/lib/cn";

const SAMPLE_LEFT =
  '{"name":"Esytol","version":1,"tools":["json-formatter","yaml"],"meta":{"stars":4.8,"beta":true}}';
const SAMPLE_RIGHT =
  '{"name":"Esytol","version":2,"tools":["json-formatter","yaml","diff"],"meta":{"stars":4.9}}';

/** Parse one side: returns the value + a Validation for the ValidationStatus row. */
function useSide(input: string): { value?: unknown; ok: boolean; validation: Validation | null } {
  return useMemo(() => {
    if (input.trim() === "") return { ok: false, validation: null };
    const f = formatJson(input, { indent: "2" });
    if (!f.ok) {
      return {
        ok: false,
        validation: {
          ...error("Invalid JSON", explainJsonError(input, f.error)),
          line: f.line ?? undefined,
          column: f.column ?? undefined,
        },
      };
    }
    return { ok: true, value: JSON.parse(input), validation: valid("Valid JSON") };
  }, [input]);
}

export function JsonDiffViewer() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [dark, setDark] = useState(false);
  const [view, setView] = useState<"unified" | "side-by-side">("unified");

  const l = useSide(left);
  const r = useSide(right);
  const bothValid = l.ok && r.ok;

  const { diff, ms } = useMemo(() => {
    if (!bothValid) return { diff: null, ms: 0 };
    const t = timed(() => diffValues(l.value, r.value));
    return { diff: t.result, ms: t.ms };
  }, [bothValid, l.value, r.value]);

  const stats = useMemo(() => (diff ? diffStats(diff) : null), [diff]);
  const patch = useMemo(() => (diff ? toJsonPatch(diff) : []), [diff]);
  const patchText = useMemo(() => JSON.stringify(patch, null, 2), [patch]);
  const identical = diff ? isIdentical(diff) : false;

  return (
    <div className="flex flex-col gap-6">
      {/* Two inputs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <EditorPanel
            value={left}
            onChange={setLeft}
            language="json"
            label="Left (original) JSON"
            dark={dark}
            onToggleDark={() => setDark((d) => !d)}
            sample={SAMPLE_LEFT}
            downloadName="left.json"
            ariaLabel="Left JSON editor"
          />
          <ValidationStatus validation={l.validation} />
        </div>
        <div className="flex flex-col gap-2">
          <EditorPanel
            value={right}
            onChange={setRight}
            language="json"
            label="Right (changed) JSON"
            dark={dark}
            onToggleDark={() => setDark((d) => !d)}
            sample={SAMPLE_RIGHT}
            downloadName="right.json"
            ariaLabel="Right JSON editor"
          />
          <ValidationStatus validation={r.validation} />
        </div>
      </div>

      {!bothValid && (
        <p className="text-xs text-gray-500">
          Paste or upload a JSON document on each side (or load the samples). The diff, statistics,
          and an RFC 6902 JSON Patch appear here — computed entirely in your browser, never
          uploaded.
        </p>
      )}

      {diff && stats && (
        <div className="flex flex-col gap-4">
          {/* Statistics */}
          <section
            aria-label="Diff statistics"
            className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-6"
          >
            <Stat label="Added" value={stats.added} tone="text-green-700" />
            <Stat label="Removed" value={stats.removed} tone="text-red-700" />
            <Stat label="Modified" value={stats.modified} tone="text-amber-700" />
            <Stat label="Unchanged" value={stats.unchanged} tone="text-gray-500" />
            <Stat label="Total" value={stats.total} tone="text-gray-900" />
            <Stat label="Max depth" value={stats.maxDepth} tone="text-gray-900" />
          </section>

          {identical ? (
            <p
              className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
              role="status"
            >
              ✓ The two documents are identical — no differences.
            </p>
          ) : (
            <>
              {/* View toggle + explore */}
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">Differences</h2>
                  <div
                    role="tablist"
                    aria-label="Diff view"
                    className="inline-flex rounded-lg border border-gray-300 p-0.5"
                  >
                    {(
                      [
                        ["unified", "Unified"],
                        ["side-by-side", "Side by side"],
                      ] as const
                    ).map(([v, labelText]) => (
                      <button
                        key={v}
                        role="tab"
                        type="button"
                        aria-selected={view === v}
                        onClick={() => setView(v)}
                        className={cn(
                          "rounded-md px-3 py-1 text-sm font-medium transition",
                          view === v ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {labelText}
                      </button>
                    ))}
                  </div>
                </div>

                {view === "unified" ? (
                  <DiffTree root={diff} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
                        Left
                      </p>
                      <JsonTree value={l.value} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">
                        Right
                      </p>
                      <JsonTree value={r.value} />
                    </div>
                  </div>
                )}
              </section>

              {/* JSON Patch output */}
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    JSON Patch{" "}
                    <span className="font-normal text-gray-400">
                      (RFC 6902 · {patch.length} op{patch.length === 1 ? "" : "s"}
                      {ms ? ` · ${ms} ms` : ""})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <CopyButton value={patchText} label="Copy patch" />
                    <button
                      type="button"
                      onClick={() => downloadText("diff.patch.json", patchText, "application/json")}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Download
                    </button>
                  </div>
                </div>
                <pre className="max-h-[24rem] overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                  <code>{patchText}</code>
                </pre>
                <p className="mt-2 text-xs text-gray-500">
                  An RFC 6902 patch that transforms the left document into the right one — apply it
                  with any JSON Patch library.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className={"text-lg font-semibold tabular-nums " + tone}>{value.toLocaleString()}</span>
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  );
}

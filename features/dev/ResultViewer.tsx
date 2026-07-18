"use client";

/**
 * Shared result viewer — DEVELOPER-001 (Part 2).
 *
 * The reusable output panel: read-only code view plus copy, download, and live
 * character / line / byte counts and processing time. Every developer tool
 * shows its output through this, so the affordances are identical everywhere.
 */

import { useMemo } from "react";
import { CodeEditor, type EditorLanguage } from "./CodeEditor";
import { CopyButton } from "@/features/tool/CopyButton";
import { measure, formatBytes, formatMs } from "@/lib/dev/metrics";
import { downloadText } from "@/lib/dev/files";

export interface ResultViewerProps {
  value: string;
  language?: EditorLanguage;
  label?: string;
  /** Filename used by the Download button. */
  downloadName?: string;
  /** Processing time in ms, if the tool measured it. */
  processingMs?: number;
  dark?: boolean;
  emptyHint?: string;
}

export function ResultViewer({
  value,
  language = "text",
  label = "Output",
  downloadName = "output.txt",
  processingMs,
  dark = false,
  emptyHint = "Output appears here…",
}: ResultViewerProps) {
  const metrics = useMemo(() => measure(value), [value]);
  const has = value !== "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-gray-400">{label}</span>
        {has && (
          <span className="flex items-center gap-2">
            <CopyButton value={value} />
            <button
              type="button"
              onClick={() => downloadText(downloadName, value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download
            </button>
          </span>
        )}
      </div>

      {has ? (
        <CodeEditor value={value} language={language} readOnly dark={dark} ariaLabel={label} />
      ) : (
        <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
          {emptyHint}
        </div>
      )}

      {has && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <Stat label="Characters" value={metrics.characters.toLocaleString()} />
          <Stat label="Lines" value={metrics.lines.toLocaleString()} />
          <Stat label="Size" value={formatBytes(metrics.bytes)} />
          {processingMs !== undefined && <Stat label="Time" value={formatMs(processingMs)} />}
        </dl>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <dt className="text-gray-400">{label}:</dt>
      <dd className="font-medium tabular-nums text-gray-700">{value}</dd>
    </div>
  );
}

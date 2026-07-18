"use client";

/**
 * Everyday output panel — PLATFORM-004 (Part 3).
 *
 * A lightweight read-only output with copy and download, for Everyday tools that
 * produce text. Reuses the shared CopyButton and the lib/dev/files download
 * framework. (Tools whose output is a set of statistics render their own grid
 * instead — see WordCounter.)
 */

import { CopyButton } from "@/features/tool/CopyButton";
import { downloadText } from "@/lib/dev/files";

export interface EverydayOutputProps {
  value: string;
  label?: string;
  downloadName?: string;
  rows?: number;
  emptyHint?: string;
}

export function EverydayOutput({
  value,
  label = "Output",
  downloadName = "output.txt",
  rows = 10,
  emptyHint = "Result appears here…",
}: EverydayOutputProps) {
  const has = value !== "";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-gray-400">{label}</span>
        {has && (
          <span className="flex gap-2">
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
        <textarea
          readOnly
          value={value}
          rows={rows}
          spellCheck={false}
          aria-label={label}
          className="w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 focus:outline-none"
        />
      ) : (
        <div className="flex min-h-[6rem] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
          {emptyHint}
        </div>
      )}
    </div>
  );
}

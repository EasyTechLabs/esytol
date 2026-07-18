"use client";

/**
 * Shared editor panel — DEVELOPER-001 (Parts 1 + 7).
 *
 * A labelled input editor with the category-wide toolbar (sample, paste,
 * upload, format, copy, download, clear, dark, full-screen) and drag-and-drop
 * file support. Wraps the shared CodeEditor; file reads go through the shared
 * lib/dev/files helpers, so nothing leaves the browser and large files are
 * size-capped honestly.
 */

import { useCallback, useRef, useState } from "react";
import { CodeEditor, type EditorLanguage } from "./CodeEditor";
import { CopyButton } from "@/features/tool/CopyButton";
import { readTextFile, downloadText, pasteText } from "@/lib/dev/files";
import { cn } from "@/lib/cn";

export interface EditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  language?: EditorLanguage;
  label?: string;
  dark?: boolean;
  onToggleDark?: () => void;
  /** When provided, a "Format" button runs it. */
  onFormat?: () => void;
  /** When provided, a "Sample" button loads it. */
  sample?: string;
  downloadName?: string;
  ariaLabel?: string;
}

export function EditorPanel({
  value,
  onChange,
  language = "text",
  label = "Input",
  dark = false,
  onToggleDark,
  onFormat,
  sample,
  downloadName = "input.txt",
  ariaLabel,
}: EditorPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadFile = useCallback(
    async (file: File) => {
      setFileError(null);
      const r = await readTextFile(file);
      if (r.ok) onChange(r.text);
      else setFileError(r.error ?? "Could not read file.");
    },
    [onChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void loadFile(file);
    },
    [loadFile]
  );

  return (
    <div className={cn("flex flex-col gap-2", fullscreen && "fixed inset-0 z-50 bg-white p-4")}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs font-medium uppercase tracking-widest text-gray-400">
          {label}
        </span>
        {sample !== undefined && (
          <ToolbarButton onClick={() => onChange(sample)}>Sample</ToolbarButton>
        )}
        <ToolbarButton
          onClick={async () => {
            const t = await pasteText();
            if (t !== null) onChange(t);
          }}
        >
          Paste
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInput.current?.click()}>Upload</ToolbarButton>
        {onFormat && <ToolbarButton onClick={onFormat}>Format</ToolbarButton>}
        <CopyButton value={value} />
        <ToolbarButton onClick={() => downloadText(downloadName, value)} disabled={value === ""}>
          Download
        </ToolbarButton>
        <ToolbarButton onClick={() => onChange("")} disabled={value === ""}>
          Clear
        </ToolbarButton>
        {onToggleDark && (
          <ToolbarButton onClick={onToggleDark}>{dark ? "Light" : "Dark"}</ToolbarButton>
        )}
        <ToolbarButton onClick={() => setFullscreen((f) => !f)}>
          {fullscreen ? "Exit full screen" : "Full screen"}
        </ToolbarButton>
      </div>

      {/* Editor + drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn("relative", fullscreen && "flex-1 overflow-auto")}
      >
        <CodeEditor
          value={value}
          onChange={onChange}
          language={language}
          dark={dark}
          minHeight={fullscreen ? "70vh" : "16rem"}
          ariaLabel={ariaLabel ?? `${label} editor`}
          placeholder="Type, paste, or drop a file…"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-brand-400 bg-brand-50/80 text-sm font-medium text-brand-700">
            Drop file to load
          </div>
        )}
      </div>

      {fileError && <p className="text-xs text-red-600">{fileError}</p>}

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void loadFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

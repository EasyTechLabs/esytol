"use client";

/**
 * Everyday input panel — PLATFORM-004 (Part 3).
 *
 * A lightweight labelled text input with the shared toolbar (sample, paste,
 * upload, copy, clear) and drag-and-drop. Deliberately NOT the developer
 * EditorPanel: Everyday tools are plain text, not code, so this uses a simple
 * textarea instead of CodeMirror — reusing the shared CopyButton and the
 * lib/dev/files framework (copy/paste/upload), never duplicating them.
 */

import { useCallback, useRef, useState } from "react";
import { CopyButton } from "@/features/tool/CopyButton";
import { readTextFile, pasteText } from "@/lib/dev/files";
import { cn } from "@/lib/cn";

export interface EverydayInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  sample?: string;
  rows?: number;
  ariaLabel?: string;
}

export function EverydayInput({
  value,
  onChange,
  label = "Input",
  placeholder = "Type or paste text…",
  sample,
  rows = 10,
  ariaLabel,
}: EverydayInputProps) {
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs font-medium uppercase tracking-widest text-gray-400">
          {label}
        </span>
        {sample !== undefined && <Btn onClick={() => onChange(sample)}>Sample</Btn>}
        <Btn
          onClick={async () => {
            const t = await pasteText();
            if (t !== null) onChange(t);
          }}
        >
          Paste
        </Btn>
        <Btn onClick={() => fileInput.current?.click()}>Upload</Btn>
        <CopyButton value={value} />
        <Btn onClick={() => onChange("")} disabled={value === ""}>
          Clear
        </Btn>
      </div>

      <div
        className="relative"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void loadFile(file);
        }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          spellCheck={false}
          placeholder={placeholder}
          aria-label={ariaLabel ?? `${label} text`}
          className="w-full resize-y rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
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

function Btn({
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
      className={cn(
        "rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {children}
    </button>
  );
}

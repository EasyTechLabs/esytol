"use client";

/**
 * Shared developer tool layout — DEVELOPER-001 (Part 8).
 *
 * The canonical arrangement every developer tool fills via slots:
 *   controls → (input + validation | output) → examples → privacy.
 * The "standards" step in the spec is the DeveloperTrust surface, rendered once
 * by ToolLayout beneath this content — so it is never duplicated here.
 *
 * Slots keep it reusable across shapes (one input→one output, mode-toggle
 * converters, multi-output decoders) without a rigid template.
 */

import type { ReactNode } from "react";

export interface DevExample {
  label: string;
  value: string;
}

export interface DevToolLayoutProps {
  /** Mode toggles / options row. */
  controls?: ReactNode;
  /** Usually an <EditorPanel />. */
  input: ReactNode;
  /** A <ValidationStatus />, shown under the input. */
  validation?: ReactNode;
  /** Usually a <ResultViewer /> (or a custom output). */
  output: ReactNode;
  /** One-click example inputs. */
  examples?: DevExample[];
  onExample?: (value: string) => void;
  /** Defaults to the category privacy line. */
  privacyNote?: string;
}

const DEFAULT_PRIVACY =
  "Runs entirely in your browser — nothing you paste, type, or drop is uploaded, stored, or logged.";

export function DevToolLayout({
  controls,
  input,
  validation,
  output,
  examples,
  onExample,
  privacyNote = DEFAULT_PRIVACY,
}: DevToolLayoutProps) {
  return (
    <div className="flex flex-col gap-5">
      {controls && <div className="flex flex-wrap items-center gap-3">{controls}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {input}
          {validation}
        </div>
        <div>{output}</div>
      </div>

      {examples && examples.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-gray-400">
            Examples
          </span>
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => onExample?.(ex.value)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">🔒 {privacyNote}</p>
    </div>
  );
}

"use client";

/**
 * Shared validation UI — DEVELOPER-001 (Part 3).
 *
 * One rendering for every developer tool's valid / warning / error / info
 * state, driven by the shared Validation model (lib/dev/validation).
 */

import type { Validation, ValidationLevel } from "@/lib/dev/validation";
import { cn } from "@/lib/cn";

const STYLES: Record<ValidationLevel, { box: string; icon: string; label: string }> = {
  valid: { box: "border-green-200 bg-green-50 text-green-800", icon: "✓", label: "Valid" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "!", label: "Warning" },
  error: { box: "border-red-200 bg-red-50 text-red-800", icon: "✕", label: "Error" },
  info: { box: "border-blue-200 bg-blue-50 text-blue-800", icon: "i", label: "Info" },
};

export function ValidationStatus({ validation }: { validation: Validation | null }) {
  if (!validation) return null;
  const s = STYLES[validation.level];
  const location =
    validation.line !== undefined
      ? ` (line ${validation.line}${validation.column !== undefined ? `, column ${validation.column}` : ""})`
      : "";

  return (
    <div
      role={validation.level === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", s.box)}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/60 text-xs font-bold"
      >
        {s.icon}
      </span>
      <span>
        <strong>{validation.message}</strong>
        {location}
        {validation.detail && (
          <span className="block font-mono text-xs opacity-80">{validation.detail}</span>
        )}
      </span>
    </div>
  );
}

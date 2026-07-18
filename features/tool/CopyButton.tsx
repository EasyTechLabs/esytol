"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared copy-to-clipboard button — PLATFORM-003.
 *
 * One implementation for every developer tool (a category-wide DX standard) so
 * clipboard handling and the "Copied" affordance are never re-written per tool.
 */
export function CopyButton({
  value,
  label = "Copy",
  disabled,
  className,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (permissions/insecure context) — fail quietly.
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={disabled || value === ""}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        copied
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-gray-300 text-gray-700 hover:bg-gray-50",
        className
      )}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

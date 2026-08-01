"use client";

/**
 * Vyora — the one success toast (V2-006.1).
 *
 * Rendered once by the provider and fed by `successFeedback`, so there is
 * exactly one toast implementation in the app and no screen can grow its own.
 *
 * Sits above the floating actions and the bottom bar, announces politely to
 * screen readers, and never blocks a tap — a merchant mid-entry must be able to
 * keep working while it fades.
 */

import { useEffect } from "react";
import type { Feedback } from "@/lib/vyora/feedback";

/** Long enough to read a sentence, short enough not to be in the way. */
export const TOAST_MS = 3200;

export function Toast({ feedback, onDone }: { feedback: Feedback | null; onDone: () => void }) {
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [feedback, onDone]);

  if (!feedback) return null;

  const tone =
    feedback.tone === "warning" ? "bg-amber-900 text-amber-50" : "bg-gray-900 text-white";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[8.5rem] z-40 mx-auto flex w-full max-w-lg justify-center px-4"
    >
      <div className={`rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${tone}`}>
        {feedback.message}
      </div>
    </div>
  );
}

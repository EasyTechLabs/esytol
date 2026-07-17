"use client";

/**
 * PLATFORM-002 — the bridge between a calculator's live result and the
 * platform. Renders under a tool's results:
 *
 * - auto-records the last stable result to calculation history (debounced),
 * - shows deterministic insights (engine constants vs the user's own profile),
 * - offers the event's single explicit profile update ("Update my plan"),
 * - after a tap, shows the engine's real before/after as quiet notifications.
 *
 * Reads and writes only through lib/localFinance; judges only through
 * lib/financialRoadmap via lib/financeEvents. Renders nothing when it has
 * nothing honest to say.
 */

import { useEffect, useState } from "react";
import {
  applyEventDelta,
  eventInsights,
  proposeDelta,
  recordEvent,
  type FinanceEvent,
  type SyncOutcome,
} from "@/lib/financeEvents";
import { formatINR } from "@/lib/financialRoadmap";
import { readStore, FINANCE_STORAGE_KEY, type FinanceStore } from "@/lib/localFinance";
import { cn } from "@/lib/cn";

const RECORD_DEBOUNCE_MS = 800;

export function CalculationSync({ event }: { event: FinanceEvent | null }) {
  const [store, setStore] = useState<FinanceStore | null>(null);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);

  useEffect(() => {
    setStore(readStore());
    const onStorage = (e: StorageEvent) => {
      if (e.key === FINANCE_STORAGE_KEY || e.key === null) setStore(readStore());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Automatic capture: record the last stable result to history.
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(() => recordEvent(event), RECORD_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [event]);

  // A new calculation invalidates the previous sync notification.
  useEffect(() => {
    setOutcome(null);
  }, [event]);

  if (!event || !store || !store.profile) return null;

  const insights = eventInsights(event, store);
  const delta = proposeDelta(event, store.profile);

  if (insights.length === 0 && !delta && !outcome) return null;

  return (
    <section
      aria-label="Your plan"
      className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm"
    >
      {insights.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {insights.map((insight) => (
            <li key={insight.text} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  insight.tone === "good" && "bg-green-500",
                  insight.tone === "warn" && "bg-amber-500",
                  insight.tone === "bad" && "bg-red-500",
                  insight.tone === "neutral" && "bg-gray-400"
                )}
                aria-hidden="true"
              />
              <span className="text-gray-700">{insight.text}</span>
            </li>
          ))}
        </ul>
      )}

      {delta && !outcome && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const result = applyEventDelta(event);
              if (result) {
                setOutcome(result);
                setStore(readStore());
              }
            }}
            className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
          >
            Update my plan: {delta.label.toLowerCase()} → {formatINR(delta.value)}
          </button>
          <span className="text-xs text-gray-500">{delta.explanation}</span>
        </div>
      )}

      {outcome && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sync notifications">
          {outcome.notifications.map((n) => (
            <li
              key={n.text}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                n.kind === "improved" && "border-green-200 bg-green-50 text-green-700",
                n.kind === "worsened" && "border-amber-200 bg-amber-50 text-amber-800",
                n.kind === "info" && "border-gray-200 bg-white text-gray-600"
              )}
            >
              ✓ {n.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

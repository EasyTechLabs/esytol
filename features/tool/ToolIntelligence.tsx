"use client";

/**
 * PLATFORM-002 — the quiet strip that makes every tool aware of the user's
 * financial journey. Mounted once in ToolLayout: with a saved profile it shows
 * the engine's health score, the current milestone, and the engine's own
 * next-step links; without one, a single CTA to the Financial Roadmap.
 *
 * Read-only by design — it never writes, so it can never cause an update loop.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildRoadmap } from "@/lib/financialRoadmap";
import { nextSteps } from "@/lib/financeEvents";
import { readStore, FINANCE_STORAGE_KEY, type FinanceStore } from "@/lib/localFinance";

/** The two platform surfaces the strip would be self-referential on. */
const HIDDEN_SLUGS = new Set(["financial-roadmap", "financial-dashboard"]);

export function ToolIntelligence({ slug }: { slug: string }) {
  const [store, setStore] = useState<FinanceStore | null>(null);

  useEffect(() => {
    setStore(readStore());
    const onStorage = (e: StorageEvent) => {
      if (e.key === FINANCE_STORAGE_KEY || e.key === null) setStore(readStore());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (HIDDEN_SLUGS.has(slug) || !store) return null;

  const steps = nextSteps(store, slug);

  if (!store.profile) {
    return (
      <aside
        aria-label="Your financial journey"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm"
      >
        <span className="text-gray-600">
          See how this fits your finances — everything stays in your browser.
        </span>
        <span className="flex flex-wrap gap-2">
          {steps.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              {s.label}
            </Link>
          ))}
        </span>
      </aside>
    );
  }

  const result = buildRoadmap(store.profile);

  return (
    <aside
      aria-label="Your financial journey"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
    >
      <span className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-gray-900">Health Score {result.healthScore}/100</span>
        <span className="text-gray-500">
          {result.completedCount}/{result.applicableCount} milestones done
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        {steps.slice(0, 3).map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            {s.label}
          </Link>
        ))}
      </span>
    </aside>
  );
}

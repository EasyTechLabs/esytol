"use client";

/**
 * Vyora — memoized recovery selector. Wraps the PR-1 aging domain
 * (`recoverySummary`, a single FIFO sweep) in a `useMemo` keyed on the dataset,
 * so the dashboard card recomputes only when the data actually changes — never
 * on unrelated re-renders, and never more than once per change.
 */

import { useMemo } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import { recoverySummary, type RecoverySummary } from "@/lib/vyora/aging";
import { todayISO } from "@/lib/vyora/selectors";

export function useRecovery(data: VyoraData, today: string = todayISO()): RecoverySummary {
  return useMemo(() => recoverySummary(data, today), [data, today]);
}

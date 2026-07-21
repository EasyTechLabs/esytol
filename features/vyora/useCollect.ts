"use client";

/**
 * Vyora — memoized Collect selector. Wraps the PR-1 aging domain (`collectList`,
 * a single FIFO sweep) in `useMemo` keyed on the dataset, so the Collect screen
 * recomputes only when the ledger changes.
 */

import { useMemo } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import { collectList, type CollectLists } from "@/lib/vyora/aging";
import { todayISO } from "@/lib/vyora/selectors";

export function useCollect(data: VyoraData, today: string = todayISO()): CollectLists {
  return useMemo(() => collectList(data, today), [data, today]);
}

"use client";

/**
 * Vyora — memoized Collect selector (P0-002 + P1-004). Reuses the aging domain
 * (`collectList`), then ranks the overdue rows through `rankOverdue` — the ONE
 * shared recovery ranker (ENG-007), so the Collect list, the Recovery dashboard,
 * and Daily Closing all show the same score, priority, and order.
 */

import { useMemo } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import { collectList, rankOverdue, type CollectLists } from "@/lib/vyora/aging";
import { todayISO } from "@/lib/vyora/selectors";

export function useCollect(data: VyoraData, today: string = todayISO()): CollectLists {
  return useMemo(() => {
    const { overdue, open } = collectList(data, today);
    return { overdue: rankOverdue(data, overdue), open };
  }, [data, today]);
}

"use client";

/**
 * Vyora — Collect selector. Reads the Ledger Engine's recovery index (ARCH-001):
 * the ranked overdue worklist + the open-not-yet-overdue list, already computed
 * once in O(N). No ledger rescan; same order and scores as before.
 */

import { useLedger } from "./VyoraProvider";
import type { CollectLists } from "@/lib/vyora/aging";

export function useCollect(): CollectLists {
  const { overdue, open } = useLedger().recovery;
  return { overdue, open };
}

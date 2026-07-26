"use client";

/**
 * Vyora — Recovery dashboard selector. Now a thin read of the Ledger Engine's
 * recovery index (ARCH-001) — no ledger rescan. Same numbers as before (the engine
 * is proven byte-identical), served in O(1).
 */

import { useLedger } from "./VyoraProvider";
import type { RecoveryView } from "@/lib/vyora/engine";

export type RecoveryDashboard = RecoveryView;

export function useRecoveryDashboard(): RecoveryView {
  return useLedger().recovery;
}

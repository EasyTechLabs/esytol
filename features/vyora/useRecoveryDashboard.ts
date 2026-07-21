"use client";

/**
 * Vyora — Recovery Dashboard selector (P0-006). ONE memoized sweep (a single
 * FIFO pass per contact) that feeds every recovery section: the hero totals,
 * the overdue top-5, money due today, and total outstanding. Reuses the PR-1
 * aging primitives — no charts, no analytics, no backend. Fast by construction:
 * recomputes only when the ledger changes.
 */

import { useMemo } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import type { OverdueRow } from "@/lib/vyora/aging";
import { allocateFifo, daysBetween } from "@/lib/vyora/aging";
import { partyNet, rupees, todayISO } from "@/lib/vyora/selectors";

export interface RecoveryDashboard {
  overdueTotal: number;
  overdueContactCount: number;
  highestPriority: OverdueRow | null;
  top5: OverdueRow[];
  /** Open receivable whose due date is exactly today. */
  dueToday: number;
  outstanding: number;
}

export function useRecoveryDashboard(
  data: VyoraData,
  today: string = todayISO()
): RecoveryDashboard {
  return useMemo(() => {
    const overdue: OverdueRow[] = [];
    let overdueTotal = 0;
    let dueToday = 0;
    let outstanding = 0;

    for (const party of data.parties) {
      const given = data.transactions.filter((t) => t.partyId === party.id && t.kind === "given");
      let received = 0;
      for (const p of data.payments) {
        if (p.partyId === party.id && p.kind === "received") received += p.amount;
      }

      let open = 0;
      let od = 0;
      let ddToday = 0;
      let maxOverdueDays: number | null = null;
      for (const lot of allocateFifo(given, received)) {
        if (lot.openAmount <= 0) continue;
        open += lot.openAmount;
        if (!lot.dueDate) continue;
        if (lot.dueDate < today) {
          od += lot.openAmount;
          const d = daysBetween(lot.dueDate, today);
          if (maxOverdueDays === null || d > maxOverdueDays) maxOverdueDays = d;
        } else if (lot.dueDate === today) {
          ddToday += lot.openAmount;
        }
      }

      outstanding += open;
      dueToday += ddToday;
      if (od > 0 && maxOverdueDays !== null) {
        const overdueAmount = rupees(od);
        overdueTotal += overdueAmount;
        overdue.push({
          partyId: party.id,
          overdueAmount,
          daysOverdue: maxOverdueDays,
          openReceivable: rupees(open),
          net: partyNet(data, party.id),
        });
      }
    }

    overdue.sort((a, b) => {
      const la = a.overdueAmount * a.daysOverdue;
      const lb = b.overdueAmount * b.daysOverdue;
      if (lb !== la) return lb - la;
      return b.daysOverdue - a.daysOverdue;
    });

    return {
      overdueTotal: rupees(overdueTotal),
      overdueContactCount: overdue.length,
      highestPriority: overdue[0] ?? null,
      top5: overdue.slice(0, 5),
      dueToday: rupees(dueToday),
      outstanding: rupees(outstanding),
    };
  }, [data, today]);
}

"use client";

/**
 * Vyora — Recovery Dashboard selector (P0-006) + Recovery Intelligence (P1-004).
 * ONE memoized sweep (a single FIFO pass per contact) feeds every recovery
 * section: the hero totals, the scored overdue top-5 ("top recovery
 * opportunities"), money due today, and total outstanding. Overdue contacts are
 * scored by a deterministic formula (no ML) and sorted by score.
 */

import { useMemo } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import type { OverdueRow } from "@/lib/vyora/aging";
import { allocateFifo, daysBetween, rankOverdue } from "@/lib/vyora/aging";
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
    // ONE FIFO sweep per contact produces the aggregate totals + the base overdue
    // rows; ranking/scoring is delegated to the shared `rankOverdue` (ENG-007), so
    // the dashboard and the Collect list can never disagree on priority or order.
    const baseRows: OverdueRow[] = [];
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
        baseRows.push({
          partyId: party.id,
          overdueAmount,
          daysOverdue: maxOverdueDays,
          openReceivable: rupees(open),
          net: partyNet(data, party.id),
        });
      }
    }

    const overdue = rankOverdue(data, baseRows);

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

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
import { allocateFifo, daysBetween, recoveryScore } from "@/lib/vyora/aging";
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
    const temp: { row: OverdueRow; totalGiven: number; received: number; txnCount: number }[] = [];
    let overdueTotal = 0;
    let dueToday = 0;
    let outstanding = 0;
    let maxOverdue = 0;

    for (const party of data.parties) {
      const given = data.transactions.filter((t) => t.partyId === party.id && t.kind === "given");
      let received = 0;
      let totalGiven = 0;
      for (const t of given) totalGiven += t.amount;
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
        maxOverdue = Math.max(maxOverdue, overdueAmount);
        temp.push({
          row: {
            partyId: party.id,
            overdueAmount,
            daysOverdue: maxOverdueDays,
            openReceivable: rupees(open),
            net: partyNet(data, party.id),
          },
          totalGiven,
          received,
          txnCount: given.length,
        });
      }
    }

    const overdue: OverdueRow[] = temp.map(({ row, totalGiven, received, txnCount }) => {
      const paymentRatio = totalGiven > 0 ? received / totalGiven : 0;
      const { score, priority } = recoveryScore({
        overdueAmount: row.overdueAmount,
        daysOverdue: row.daysOverdue,
        paymentRatio,
        txnCount,
        maxOverdue,
      });
      return { ...row, score, priority };
    });
    overdue.sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        b.overdueAmount * b.daysOverdue - a.overdueAmount * a.daysOverdue ||
        b.daysOverdue - a.daysOverdue
    );

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

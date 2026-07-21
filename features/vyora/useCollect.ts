"use client";

/**
 * Vyora — memoized Collect selector (P0-002 + P1-004). Reuses the PR-1 aging
 * domain (`collectList`), then scores each overdue contact with the deterministic
 * recovery formula and sorts by score — highest recovery priority first.
 */

import { useMemo } from "react";
import type { VyoraData } from "@/lib/vyora/types";
import { collectList, recoveryScore, type CollectLists } from "@/lib/vyora/aging";
import { todayISO } from "@/lib/vyora/selectors";

export function useCollect(data: VyoraData, today: string = todayISO()): CollectLists {
  return useMemo(() => {
    const { overdue, open } = collectList(data, today);
    const maxOverdue = overdue.reduce((m, r) => Math.max(m, r.overdueAmount), 0);
    const scored = overdue.map((r) => {
      let given = 0;
      let received = 0;
      let txnCount = 0;
      for (const t of data.transactions) {
        if (t.partyId === r.partyId && t.kind === "given") {
          given += t.amount;
          txnCount += 1;
        }
      }
      for (const p of data.payments) {
        if (p.partyId === r.partyId && p.kind === "received") received += p.amount;
      }
      const paymentRatio = given > 0 ? received / given : 0;
      const { score, priority } = recoveryScore({
        overdueAmount: r.overdueAmount,
        daysOverdue: r.daysOverdue,
        paymentRatio,
        txnCount,
        maxOverdue,
      });
      return { ...r, score, priority };
    });
    scored.sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        b.overdueAmount * b.daysOverdue - a.overdueAmount * a.daysOverdue
    );
    return { overdue: scored, open };
  }, [data, today]);
}

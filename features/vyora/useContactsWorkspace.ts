"use client";

/**
 * Vyora — Contacts Workspace selector (P0-005). Answers, per contact: net,
 * outstanding, direction, colour-coded status, and the fields the filters + sorts
 * need. Now reads the Ledger Engine (ARCH-001) — grouped once in O(N), no per-row
 * rescan of the whole ledger. Output is unchanged.
 */

import { useMemo } from "react";
import type { Party } from "@/lib/vyora/types";
import { allocateFifo, daysBetween } from "@/lib/vyora/aging";
import { useLedger } from "./VyoraProvider";

export type ContactStatus = "OVERDUE" | "DUE_SOON" | "GOOD" | "SETTLED";
export type ContactDirection = "receivable" | "payable" | "settled";

export interface ContactRow {
  party: Party;
  /** Signed: + they owe me, − I owe them. */
  net: number;
  outstanding: number;
  direction: ContactDirection;
  status: ContactStatus;
  overdueDays: number | null;
  /** Days until the nearest upcoming (not-yet-passed) due date, or null. */
  nearestDueDays: number | null;
  /** Age of the oldest open receivable lot — for the "Oldest Due" sort. */
  oldestOpenDays: number | null;
  /** Latest entry timestamp for this contact — for the "Recently Updated" sort. */
  lastUpdated: string;
}

/** A credit is "due soon" if its due date is within this many days and not yet overdue. */
const DUE_SOON_WINDOW = 7;

export function useContactsWorkspace(): ContactRow[] {
  const engine = useLedger();
  return useMemo(() => {
    const today = engine.today;
    return engine.parties.map((party) => {
      const net = engine.getNet(party.id);
      const aging = engine.getAging(party.id);
      const e = engine.txnIndex.get(party.id);
      const given = e?.given ?? [];
      let received = 0;
      if (e) for (const p of e.received) received += p.amount;

      // Nearest upcoming (not-yet-passed) due date among still-open given credits.
      let nearestDueDays: number | null = null;
      for (const lot of allocateFifo(given, received)) {
        if (lot.openAmount > 0 && lot.dueDate && lot.dueDate >= today) {
          const d = daysBetween(today, lot.dueDate);
          if (nearestDueDays === null || d < nearestDueDays) nearestDueDays = d;
        }
      }

      // Last updated = latest entry timestamp for this contact (else its created date).
      let lastUpdated = party.createdAt;
      if (e) {
        for (const arr of [e.given, e.taken, e.received, e.paid])
          for (const x of arr) if (x.createdAt > lastUpdated) lastUpdated = x.createdAt;
      }

      const direction: ContactDirection = net > 0 ? "receivable" : net < 0 ? "payable" : "settled";
      let status: ContactStatus;
      if (net === 0) status = "SETTLED";
      else if (aging.overdueAmount > 0) status = "OVERDUE";
      else if (net > 0 && nearestDueDays !== null && nearestDueDays <= DUE_SOON_WINDOW)
        status = "DUE_SOON";
      else status = "GOOD";

      return {
        party,
        net,
        outstanding: Math.abs(net),
        direction,
        status,
        overdueDays: aging.daysOverdue,
        nearestDueDays,
        oldestOpenDays: aging.oldestOpenDays,
        lastUpdated,
      };
    });
  }, [engine]);
}

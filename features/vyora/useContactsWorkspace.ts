"use client";

/**
 * Vyora — Contacts Workspace selector (P0-005). One memoized sweep that answers,
 * per contact: net (who owes whom), outstanding, colour-coded status
 * (OVERDUE / DUE_SOON / GOOD / SETTLED), and the fields the filters + sorts need.
 * Reuses the PR-1 aging domain — no new data model, no backend.
 */

import { useMemo } from "react";
import type { VyoraData, Party } from "@/lib/vyora/types";
import { partyNet, todayISO } from "@/lib/vyora/selectors";
import { agingForParty, allocateFifo, daysBetween } from "@/lib/vyora/aging";

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

export function useContactsWorkspace(data: VyoraData, today: string = todayISO()): ContactRow[] {
  return useMemo(() => {
    return data.parties.map((party) => {
      const net = partyNet(data, party.id);
      const aging = agingForParty(data, party.id, today);

      // Nearest upcoming (not-yet-passed) due date among still-open given credits.
      let received = 0;
      for (const p of data.payments) {
        if (p.partyId === party.id && p.kind === "received") received += p.amount;
      }
      const given = data.transactions.filter((t) => t.partyId === party.id && t.kind === "given");
      let nearestDueDays: number | null = null;
      for (const lot of allocateFifo(given, received)) {
        if (lot.openAmount > 0 && lot.dueDate && lot.dueDate >= today) {
          const d = daysBetween(today, lot.dueDate);
          if (nearestDueDays === null || d < nearestDueDays) nearestDueDays = d;
        }
      }

      // Last updated = latest entry timestamp for this contact (else its created date).
      let lastUpdated = party.createdAt;
      for (const t of data.transactions) {
        if (t.partyId === party.id && t.createdAt > lastUpdated) lastUpdated = t.createdAt;
      }
      for (const p of data.payments) {
        if (p.partyId === party.id && p.createdAt > lastUpdated) lastUpdated = p.createdAt;
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
  }, [data, today]);
}

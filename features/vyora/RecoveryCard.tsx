"use client";

/**
 * Vyora — Dashboard Recovery Card (PR-2.2). Turns the aging domain into the one
 * thing a merchant opens the app to know: "who owes me, who's late, chase whom
 * first." Reads from the memoized `useRecovery` selector. No charts, no
 * analytics, no backend — just the numbers and one action.
 */

import Link from "next/link";
import type { VyoraData } from "@/lib/vyora/types";
import { formatMoney } from "@/lib/vyora/format";
import { Card } from "./primitives";
import { useRecovery } from "./useRecovery";

export function RecoveryCard({
  data,
  todaysRecovery,
}: {
  data: VyoraData;
  /** Money received today — passed in from the dashboard's existing totals (no recompute). */
  todaysRecovery: number;
}) {
  const r = useRecovery(data);

  // All caught up — the good state.
  if (r.highestPriority === null) {
    return (
      <Card className="flex items-center gap-3 border-positive-line bg-positive-tint">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive text-lg font-bold text-white"
        >
          ✓
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-positive-strong">All caught up</p>
          <p className="text-sm text-gray-600">
            Nobody is overdue right now.
            {r.outstanding > 0 ? ` ${formatMoney(r.outstanding)} outstanding, none late.` : ""}
          </p>
        </div>
      </Card>
    );
  }

  const top = r.highestPriority;
  const topName = data.parties.find((p) => p.id === top.partyId)?.name ?? "Contact";
  const plural = r.overdueContactCount === 1 ? "contact" : "contacts";

  return (
    <Card tone="danger" className="space-y-3">
      {/* Overdue headline */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-negative-strong">
            Overdue to recover
          </div>
          <div className="break-words text-2xl font-bold tabular-nums leading-tight text-negative">
            {formatMoney(r.overdueTotal)}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{r.overdueContactCount}</span> overdue{" "}
          {plural}
        </div>
      </div>

      {/* Today's recovery + outstanding */}
      <div className="grid grid-cols-2 gap-3 border-t border-red-100 pt-3 text-sm">
        <div>
          <div className="text-gray-500">Recovered today</div>
          <div className="font-semibold tabular-nums text-positive">
            {formatMoney(todaysRecovery)}
          </div>
        </div>
        <div>
          <div className="text-gray-500">Outstanding</div>
          <div className="font-semibold tabular-nums text-gray-900">
            {formatMoney(r.outstanding)}
          </div>
        </div>
      </div>

      {/* Highest-priority contact */}
      <div className="rounded-xl bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Chase first</div>
            <div className="truncate font-medium text-gray-900">{topName}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-semibold tabular-nums text-negative">
              {formatMoney(top.overdueAmount)}
            </div>
            <div className="text-xs text-gray-500">overdue {top.daysOverdue}d</div>
          </div>
        </div>
      </div>

      {/* Chase Now CTA — opens the highest-priority contact's statement to act on */}
      <Link
        href={`/vyora/parties/${top.partyId}`}
        className="block rounded-xl bg-brand-600 py-3 text-center text-base font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      >
        Chase now →
      </Link>
    </Card>
  );
}

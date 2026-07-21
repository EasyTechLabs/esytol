"use client";

/**
 * Vyora — Recovery landing hero (the FIRST thing a merchant sees). Turns the
 * aging domain into today's job: "recover ₹X from N customers, chase this one
 * first." When nothing is overdue it becomes a calm "All caught up". Reads a
 * summary computed once by the dashboard's single sweep, so recording a payment
 * updates it live — no reload. No charts, no analytics, no backend.
 */

import Link from "next/link";
import type { VyoraData } from "@/lib/vyora/types";
import { formatMoney } from "@/lib/vyora/format";
import { PriorityBadge } from "./components";
import type { RecoveryDashboard } from "./useRecoveryDashboard";

export function RecoveryCard({
  data,
  summary,
  todaysRecovery,
}: {
  data: VyoraData;
  /** Recovery totals — computed once by the dashboard's single sweep. */
  summary: RecoveryDashboard;
  /** Money received today — the "Today's Recovery" figure that grows as payments land. */
  todaysRecovery: number;
}) {
  const r = summary;

  // All caught up — the good state.
  if (r.highestPriority === null) {
    return (
      <div className="rounded-2xl border border-positive-line bg-positive-tint p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-positive text-2xl font-bold text-white"
          >
            ✓
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold text-positive-strong">All caught up</p>
            <p className="text-sm text-gray-600">
              Nobody is overdue right now.
              {todaysRecovery > 0 ? ` You've recovered ${formatMoney(todaysRecovery)} today.` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const top = r.highestPriority;
  const topName = data.parties.find((p) => p.id === top.partyId)?.name ?? "Contact";
  const customers = `${r.overdueContactCount} customer${r.overdueContactCount === 1 ? "" : "s"}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white">
      {/* Today's recovery headline */}
      <div className="bg-negative-tint px-5 pb-4 pt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-negative-strong">
          Today&rsquo;s recovery
        </div>
        <div className="mt-1 break-words text-3xl font-bold tabular-nums leading-tight text-negative">
          Recover {formatMoney(r.overdueTotal)}
        </div>
        <div className="mt-1 text-sm text-gray-600">
          from {customers} overdue
          {todaysRecovery > 0 ? ` · ${formatMoney(todaysRecovery)} recovered today` : ""}
        </div>
      </div>

      {/* Top contact + Recover now */}
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Top contact</div>
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-gray-900">{topName}</span>
              {top.priority && <PriorityBadge priority={top.priority} />}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-semibold tabular-nums text-negative">
              {formatMoney(top.overdueAmount)}
            </div>
            <div className="text-xs text-gray-500">overdue {top.daysOverdue}d</div>
          </div>
        </div>
        <Link
          href="/vyora/collect"
          className="block rounded-xl bg-brand-600 py-3.5 text-center text-base font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          Recover now →
        </Link>
      </div>
    </div>
  );
}

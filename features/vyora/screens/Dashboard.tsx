"use client";

/**
 * Vyora — Recovery Dashboard (P0-006). Replaces the accounting dashboard. Opens
 * with today's recovery, then the overdue top-5, money due today, today's
 * collections and payments, recent activity, and quick actions. No charts, no
 * analytics. All recovery numbers come from ONE memoized sweep — fast loading.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { recentActivity, todayISO, rupees } from "@/lib/vyora/selectors";
import { formatMoney, formatDate, balanceColor } from "@/lib/vyora/format";
import { StatCard, Empty, PriorityBadge } from "../components";
import { RecoveryCard } from "../RecoveryCard";
import { useRecoveryDashboard } from "../useRecoveryDashboard";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / 86_400_000;
}

export function Dashboard() {
  const { ready, data, backup } = useVyora();
  const [remindDismissed, setRemindDismissed] = useState(false);

  const rec = useRecoveryDashboard(data);
  const activity = useMemo(() => recentActivity(data, 12), [data]);
  const today = useMemo(() => {
    const t = todayISO();
    let collections = 0;
    let payments = 0;
    for (const p of data.payments) {
      if (p.date !== t) continue;
      if (p.kind === "received") collections += p.amount;
      else payments += p.amount;
    }
    return { collections: rupees(collections), payments: rupees(payments) };
  }, [data]);

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const totalEntries = data.transactions.length + data.payments.length;
  const since = daysSince(data.meta.lastBackupAt);
  const shouldRemind = !remindDismissed && totalEntries >= 8 && (since === null || since > 7);
  const nameOf = (id: string) => data.parties.find((p) => p.id === id)?.name ?? "Contact";

  return (
    <div className="space-y-4">
      {/* Top hero — Today's Recovery */}
      <RecoveryCard data={data} summary={rec} todaysRecovery={today.collections} />

      {shouldRemind && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">Back up your data to avoid accidental loss.</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                backup();
                setRemindDismissed(true);
              }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Back up
            </button>
            <button
              type="button"
              onClick={() => setRemindDismissed(true)}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-amber-700"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Overdue customers — top 5 */}
      {rec.top5.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
              Top recovery opportunities
            </h2>
            <Link href="/vyora/collect" className="text-sm font-medium text-brand-700">
              See all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {rec.top5.map((row) => (
              <Link
                key={row.partyId}
                href={`/vyora/parties/${row.partyId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800">{nameOf(row.partyId)}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-lg bg-negative-tint px-1.5 py-0.5 text-xs font-semibold text-negative-strong">
                      Overdue {row.daysOverdue}d
                    </span>
                    {row.priority && <PriorityBadge priority={row.priority} />}
                  </div>
                </div>
                <div className="shrink-0 font-semibold tabular-nums text-negative">
                  {formatMoney(row.overdueAmount)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Money coming today */}
      <StatCard label="Money coming today" value={formatMoney(rec.dueToday)} tone="in" />

      {/* Today's collections + payments */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today's collections" value={formatMoney(today.collections)} tone="in" />
        <StatCard label="Today's payments" value={formatMoney(today.payments)} tone="out" />
      </div>

      {/* Close the day */}
      <Link
        href="/vyora/closing"
        className="block rounded-2xl border-2 border-gray-200 bg-white py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        🌙 Close the day →
      </Link>

      {/* Recent activity */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <Empty
            title="No entries yet"
            subtitle="Tap “New credit” below to add your first udhaar."
          />
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {activity.map((a) => (
              <Link
                key={a.id}
                href={`/vyora/parties/${a.partyId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800">{a.partyName}</div>
                  <div className="text-xs text-gray-500">
                    {a.label} · {formatDate(a.date)}
                  </div>
                </div>
                <div
                  className={`shrink-0 text-sm font-semibold tabular-nums ${balanceColor(a.signedAmount)}`}
                >
                  {a.signedAmount > 0 ? "+" : "−"}
                  {formatMoney(a.amount)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Quick actions
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/vyora/credit"
            className="rounded-2xl bg-brand-600 py-4 text-center text-sm font-semibold text-white hover:bg-brand-700"
          >
            ＋ New credit
          </Link>
          <Link
            href="/vyora/payment"
            className="rounded-2xl bg-positive py-4 text-center text-sm font-semibold text-white hover:bg-positive-strong"
          >
            ＋ Payment
          </Link>
          <Link
            href="/vyora/parties"
            className="rounded-2xl border-2 border-gray-200 bg-white py-4 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ＋ Contact
          </Link>
        </div>
      </section>
    </div>
  );
}

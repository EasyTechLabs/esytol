"use client";

/**
 * Vyora Alpha — Dashboard. Answers the one question a merchant opens the app for:
 * "How much is stuck, and what moved today?" Receivable, Payable, Net Position,
 * today's cash in/out, and recent activity. Read in five seconds.
 */

import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { dashboardTotals, recentActivity } from "@/lib/vyora/selectors";
import { formatMoney, formatDate, balanceColor } from "@/lib/vyora/format";
import { StatCard, Empty } from "../components";

export function Dashboard() {
  const { ready, data, reset } = useVyora();
  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const t = dashboardTotals(data);
  const activity = recentActivity(data, 15);

  const onReset = () => {
    if (confirm("Erase all Vyora data on this device? This cannot be undone.")) reset();
  };

  return (
    <div className="space-y-4">
      {/* Net position hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white">
        <div className="text-xs font-medium uppercase tracking-wide text-brand-100">
          Net position
        </div>
        <div className="mt-1 break-words text-3xl font-bold tabular-nums leading-tight sm:text-4xl">
          {formatMoney(t.net)}
        </div>
        <div className="mt-1 text-sm text-brand-100">
          {t.net > 0
            ? "You are owed more than you owe"
            : t.net < 0
              ? "You owe more than you are owed"
              : "You are all square"}
        </div>
      </div>

      {/* Receivable / Payable */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="You'll get (Receivable)" value={formatMoney(t.receivable)} tone="in" />
        <StatCard label="You'll pay (Payable)" value={formatMoney(t.payable)} tone="out" />
      </div>

      {/* Today */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today's collections" value={formatMoney(t.todaysCollections)} tone="in" />
        <StatCard label="Today's payments" value={formatMoney(t.todaysPayments)} tone="out" />
      </div>

      {/* Quick actions (also always in the bottom bar) */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/vyora/credit"
          className="rounded-2xl bg-brand-600 py-4 text-center text-base font-semibold text-white hover:bg-brand-700"
        >
          ＋ Record credit
        </Link>
        <Link
          href="/vyora/payment"
          className="rounded-2xl bg-emerald-600 py-4 text-center text-base font-semibold text-white hover:bg-emerald-700"
        >
          ＋ Record payment
        </Link>
      </div>

      {/* Recent activity */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent activity
          </h2>
          <Link href="/vyora/parties" className="text-sm font-medium text-brand-700">
            All parties →
          </Link>
        </div>
        {activity.length === 0 ? (
          <Empty title="No entries yet" subtitle="Tap “Record credit” to add your first udhaar." />
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
                  <div className="text-xs text-gray-400">
                    {a.label} · {formatDate(a.date)}
                    {a.note ? ` · ${a.note}` : ""}
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
        <span>
          {data.parties.length} parties · {data.transactions.length + data.payments.length} entries
          · saved on this device only
        </span>
        <button type="button" onClick={onReset} className="text-red-500 hover:underline">
          Clear data
        </button>
      </div>
    </div>
  );
}

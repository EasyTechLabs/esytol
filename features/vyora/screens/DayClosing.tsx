"use client";

/**
 * Vyora — Daily Closing (P1-005). Close the business day in one tap: today's
 * credit / collection / payment / net cash, the top-5 pending recoveries, a
 * backup reminder, a "mark day completed" action, and a last-30-days history.
 * Local only — closings are logged in a separate localStorage key.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { useToast } from "../Toast";
import { todayISO, rupees } from "@/lib/vyora/selectors";
import { formatMoney, formatDate, formatDateTime } from "@/lib/vyora/format";
import { StatCard, Empty, PriorityBadge } from "../components";
import { Card } from "../primitives";
import { useRecoveryDashboard } from "../useRecoveryDashboard";

interface Closing {
  date: string;
  credit: number;
  collection: number;
  payment: number;
  netCash: number;
  closedAt: string;
}

const CLOSINGS_KEY = "vyora.closings";
function loadClosings(): Closing[] {
  try {
    const r = JSON.parse(localStorage.getItem(CLOSINGS_KEY) || "[]");
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}
const signed = (n: number) => (n < 0 ? `−${formatMoney(n)}` : formatMoney(n));

export function DayClosing() {
  const { ready, data, backup } = useVyora();
  const toast = useToast();
  const rec = useRecoveryDashboard(data);

  const [closings, setClosings] = useState<Closing[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setClosings(loadClosings());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CLOSINGS_KEY, JSON.stringify(closings));
    } catch {
      /* ignore */
    }
  }, [closings, loaded]);

  const summary = useMemo(() => {
    const t = todayISO();
    let credit = 0;
    let collection = 0;
    let payment = 0;
    for (const tx of data.transactions)
      if (tx.date === t && tx.kind === "given") credit += tx.amount;
    for (const p of data.payments) {
      if (p.date !== t) continue;
      if (p.kind === "received") collection += p.amount;
      else payment += p.amount;
    }
    return {
      credit: rupees(credit),
      collection: rupees(collection),
      payment: rupees(payment),
      netCash: rupees(collection - payment),
    };
  }, [data]);

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const today = todayISO();
  const todaysClosing = closings.find((c) => c.date === today);
  const history = [...closings]
    .filter((c) => c.date !== today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 30);

  const lastBackup = data.meta.lastBackupAt;
  const backupAgeDays =
    lastBackup && !Number.isNaN(new Date(lastBackup).getTime())
      ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86_400_000)
      : null;
  const backupStale = backupAgeDays === null || backupAgeDays > 7;

  const markCompleted = () => {
    const record: Closing = { date: today, ...summary, closedAt: new Date().toISOString() };
    setClosings((cs) => [record, ...cs.filter((c) => c.date !== today)].slice(0, 90));
    toast.success("✓ Day closed");
  };

  const nameOf = (id: string) => data.parties.find((p) => p.id === id)?.name ?? "Contact";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Daily closing</h1>
        <p className="text-sm text-gray-500">{formatDate(today)}</p>
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today's credit" value={formatMoney(summary.credit)} />
        <StatCard label="Today's collection" value={formatMoney(summary.collection)} tone="in" />
        <StatCard label="Today's payment" value={formatMoney(summary.payment)} tone="out" />
        <StatCard
          label="Net cash"
          value={signed(summary.netCash)}
          tone={summary.netCash >= 0 ? "in" : "out"}
        />
      </div>

      {/* Pending recovery — top 5 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Pending recovery · top 5
        </h2>
        {rec.top5.length === 0 ? (
          <Empty title="All caught up" subtitle="Nobody is overdue right now." />
        ) : (
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
        )}
      </section>

      {/* Backup reminder */}
      <Card className={backupStale ? "border-amber-200 bg-amber-50" : undefined} as="section">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900">Back up your data</h2>
            <p className="text-sm text-gray-600">
              {lastBackup
                ? backupStale
                  ? `Last backup ${backupAgeDays} day${backupAgeDays === 1 ? "" : "s"} ago — back up before you close.`
                  : `Backed up ${backupAgeDays === 0 ? "today" : `${backupAgeDays} day${backupAgeDays === 1 ? "" : "s"} ago`}.`
                : "Never backed up — back up before you close."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => backup()}
            className="shrink-0 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Back up
          </button>
        </div>
      </Card>

      {/* Mark day completed */}
      {todaysClosing ? (
        <Card className="flex items-center gap-3 border-positive-line bg-positive-tint">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive text-lg font-bold text-white"
          >
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-positive-strong">Day completed</p>
            <p className="text-sm text-gray-600">
              Closed at {formatDateTime(todaysClosing.closedAt)} · Net cash{" "}
              {signed(todaysClosing.netCash)}
            </p>
          </div>
          <button
            type="button"
            onClick={markCompleted}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Update
          </button>
        </Card>
      ) : (
        <button
          type="button"
          onClick={markCompleted}
          className="block w-full rounded-2xl bg-brand-600 py-4 text-center text-base font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          ✓ Mark day completed
        </button>
      )}

      {/* History — last 30 days */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Last 30 days
        </h2>
        {history.length === 0 ? (
          <Empty title="No closings yet" subtitle="Close today to start your history." />
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {history.map((c) => (
              <div key={c.date} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800">{formatDate(c.date)}</div>
                  <div className="text-xs text-gray-500">
                    Credit {formatMoney(c.credit)} · Collected {formatMoney(c.collection)} · Paid{" "}
                    {formatMoney(c.payment)}
                  </div>
                </div>
                <div
                  className={`shrink-0 text-right text-sm font-semibold tabular-nums ${c.netCash >= 0 ? "text-positive" : "text-negative"}`}
                >
                  {signed(c.netCash)}
                  <div className="text-[10px] font-normal uppercase tracking-wide text-gray-500">
                    Net cash
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

/**
 * Vyora — Merchant Insights (V1-005). Pure calculations, no AI, no charts: this
 * week's cash movement, customer leagues, and portfolio averages. Every number
 * comes from the single `merchantInsights` source; every customer row taps through
 * to their Customer 360.
 */

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { todayISO } from "@/lib/vyora/selectors";
import { merchantInsights, type InsightRow } from "@/lib/vyora/insights";
import { formatMoney } from "@/lib/vyora/format";
import { Card } from "../primitives";
import { Empty, LoadingList } from "../components";

export function Insights() {
  const { ready, data } = useVyora();
  const today = todayISO();
  const ins = useMemo(() => merchantInsights(data, today), [data, today]);

  if (!ready) return <LoadingList />;
  if (data.parties.length === 0)
    return (
      <Empty
        icon="📊"
        title="No insights yet"
        subtitle="Add a few customers and entries — insights appear here."
        cta={{ label: "Add a contact", href: "/vyora/parties" }}
      />
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Insights</h1>
        <p className="text-sm text-gray-500">Plain numbers from your ledger — no guesses.</p>
      </div>

      {/* This week */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          This week
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <WeekStat label="Recovered" value={ins.week.recovered} tone="in" />
          <WeekStat label="Given" value={ins.week.given} tone="neutral" />
          <WeekStat label="Received" value={ins.week.received} tone="in" />
          <WeekStat label="Lost to overdue" value={ins.week.lost} tone="out" />
        </div>
      </section>

      {/* Customer leagues */}
      <League
        title="Best paying customers"
        rows={ins.bestPaying}
        value={(r) => `${r.ratioPct}%`}
        hint={(r) => `paid ${formatMoney(r.received)} of ${formatMoney(r.given)}`}
        valueCls="text-positive"
      />
      <League
        title="Worst paying customers"
        rows={ins.worstPaying}
        value={(r) => formatMoney(r.outstanding)}
        hint={(r) => `${r.ratioPct}% repaid`}
        valueCls="text-negative"
      />
      <League
        title="Most active customers"
        rows={ins.mostActive}
        value={(r) => `${r.count}`}
        hint={(r) => `${formatMoney(r.given)} given`}
        valueCls="text-gray-900"
      />
      <League
        title="Dormant customers"
        rows={ins.dormant}
        value={(r) => `${r.daysSince}d`}
        hint={(r) => `${formatMoney(r.outstanding)} outstanding`}
        valueCls="text-amber-700"
        emptyText="No one has gone quiet for 30+ days."
      />

      {/* Averages */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Averages
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Avg
            label="Recovery time"
            value={ins.avgRecoveryDays === null ? "—" : `${ins.avgRecoveryDays}d`}
          />
          <Avg
            label="Credit days"
            value={ins.avgCreditDays === null ? "—" : `${ins.avgCreditDays}d`}
          />
          <Avg label="Recovery %" value={ins.recoveryPct === null ? "—" : `${ins.recoveryPct}%`} />
        </div>
      </section>

      <p className="px-1 text-xs text-gray-500">
        This week = Monday to today. Recovered = overdue money collected this week. Lost =
        receivable that slipped past its due date this week.
      </p>
    </div>
  );
}

function WeekStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "in" | "out" | "neutral";
}) {
  const cls = tone === "in" ? "text-positive" : tone === "out" ? "text-negative" : "text-gray-900";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn("break-words text-xl font-bold tabular-nums leading-tight", cls)}>
        {formatMoney(value)}
      </div>
    </Card>
  );
}

function League({
  title,
  rows,
  value,
  hint,
  valueCls,
  emptyText = "Not enough data yet.",
}: {
  title: string;
  rows: InsightRow[];
  value: (r: InsightRow) => string;
  hint: (r: InsightRow) => string;
  valueCls: string;
  emptyText?: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
      {rows.length === 0 ? (
        <Card tone="dashed" className="p-4 text-center text-sm text-gray-500">
          {emptyText}
        </Card>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {rows.map((r) => (
            <Link
              key={r.partyId}
              href={`/vyora/parties/${r.partyId}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-800">{r.name}</div>
                <div className="truncate text-xs text-gray-500">{hint(r)}</div>
              </div>
              <div className={cn("shrink-0 text-sm font-bold tabular-nums", valueCls)}>
                {value(r)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Avg({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-lg font-bold tabular-nums text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </Card>
  );
}

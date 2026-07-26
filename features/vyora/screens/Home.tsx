"use client";

/**
 * Vyora — Merchant Home (V1-001). Open the app and know what needs attention in
 * under 3 seconds: a greeting + the two numbers that matter, today's tasks, the one
 * customer to chase first, today's activity, one-tap actions, and a plain-language
 * business-health band. No charts, no graphs — everything is a tap toward an action.
 *
 * Every value comes from an existing single source (ENG-007): the recovery sweep
 * (`useRecoveryDashboard`), `todayTotals`, and `businessHealth`.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { todayISO, todayTotals, allActivity } from "@/lib/vyora/selectors";
import { businessHealth, type HealthLevel } from "@/lib/vyora/aging";
import { formatMoney } from "@/lib/vyora/format";
import { useRecoveryDashboard } from "../useRecoveryDashboard";
import { Card } from "../primitives";
import { LoadingList } from "../components";

const HEALTH: Record<HealthLevel, { label: string; cls: string; ring: string }> = {
  excellent: {
    label: "Excellent",
    cls: "bg-positive-tint text-positive-strong",
    ring: "border-positive-line",
  },
  good: { label: "Good", cls: "bg-brand-50 text-brand-700", ring: "border-brand-200" },
  attention: { label: "Attention", cls: "bg-amber-50 text-amber-800", ring: "border-amber-200" },
  critical: {
    label: "Critical",
    cls: "bg-negative-tint text-negative-strong",
    ring: "border-negative-line",
  },
};

const ACTIONS = [
  { href: "/vyora/credit", icon: "📝", label: "Credit" },
  { href: "/vyora/payment", icon: "💰", label: "Payment" },
  { href: "/vyora/parties", icon: "👤", label: "Customer" },
  { href: "/vyora/collect", icon: "📣", label: "Collect" },
];

const plural = (n: number, s = "s") => (n === 1 ? "" : s);

export function Home() {
  const { ready, data, settings } = useVyora();
  const rec = useRecoveryDashboard(data);
  const today = todayISO();
  const totals = useMemo(() => todayTotals(data, today), [data, today]);
  const timeline = useMemo(() => allActivity(data).filter((a) => a.date === today), [data, today]);

  if (!ready) return <LoadingList />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const health = businessHealth({
    outstanding: rec.outstanding,
    overdueTotal: rec.overdueTotal,
    totalGiven: rec.totalGiven,
    totalReceived: rec.totalReceived,
    collectedToday: totals.collection,
  });
  const hb = HEALTH[health.level];

  // Today's tasks — only the ones that actually need attention (each is a tap).
  const tasks: { icon: string; label: string; value?: string; href: string }[] = [];
  if (rec.overdueContactCount > 0)
    tasks.push({
      icon: "🔴",
      label: `Recover from ${rec.overdueContactCount} customer${plural(rec.overdueContactCount)}`,
      value: `Collect ${formatMoney(rec.overdueTotal)}`,
      href: "/vyora/collect",
    });
  if (rec.dueTodayCount > 0)
    tasks.push({
      icon: "📅",
      label: `${rec.dueTodayCount} payment${plural(rec.dueTodayCount)} expected today`,
      value: formatMoney(rec.dueToday),
      href: "/vyora/collect",
    });
  if (rec.dueTomorrowCount > 0)
    tasks.push({
      icon: "⏭️",
      label: `${rec.dueTomorrowCount} due${plural(rec.dueTomorrowCount)} tomorrow`,
      value: formatMoney(rec.dueTomorrow),
      href: "/vyora/collect",
    });

  const hp = rec.highestPriority;
  const hpParty = hp ? data.parties.find((p) => p.id === hp.partyId) : null;

  return (
    <div className="space-y-4">
      {/* Section 1 — Good morning */}
      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">{greeting}</p>
            <h1 className="truncate text-xl font-bold text-gray-900">
              {settings.businessName || "Your shop"}
            </h1>
          </div>
          <span className="shrink-0 text-xs text-gray-500">{dateLabel}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Outstanding</div>
            <div className="break-words text-xl font-bold tabular-nums text-gray-900">
              {rec.outstanding === 0 ? "Settled" : formatMoney(rec.outstanding)}
            </div>
          </div>
          <div className="rounded-xl bg-positive-tint px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Today&rsquo;s collection
            </div>
            <div className="break-words text-xl font-bold tabular-nums text-positive-strong">
              {formatMoney(totals.collection)}
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2 — Today's tasks */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Today&rsquo;s tasks
        </h2>
        {tasks.length === 0 ? (
          <Card className="flex items-center gap-3 border-positive-line bg-positive-tint">
            <span aria-hidden className="text-xl">
              ✅
            </span>
            <p className="text-sm font-medium text-positive-strong">
              Nothing needs chasing right now.
            </p>
          </Card>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {tasks.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="text-lg">
                    {t.icon}
                  </span>
                  <span className="truncate text-sm font-medium text-gray-800">{t.label}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700">
                  {t.value}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 3 — Highest priority customer */}
      {hp && hpParty && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Chase first
          </h2>
          <Card tone="danger">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-gray-900">{hpParty.name}</div>
                <div className="mt-0.5 text-sm text-gray-600">
                  Overdue {hp.daysOverdue} day{plural(hp.daysOverdue)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xl font-bold tabular-nums text-negative">
                  {formatMoney(hp.overdueAmount)}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {hpParty.phone ? (
                <a
                  href={`tel:${hpParty.phone}`}
                  className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Call
                </a>
              ) : (
                <span className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-300">
                  Call
                </span>
              )}
              <Link
                href={`/vyora/parties/${hp.partyId}`}
                className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Statement
              </Link>
              <Link
                href={`/vyora/payment?party=${hp.partyId}`}
                className="flex items-center justify-center rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Collect
              </Link>
            </div>
          </Card>
        </section>
      )}

      {/* Section 4 — Today's timeline */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Today&rsquo;s timeline
        </h2>
        {timeline.length === 0 ? (
          <Card tone="dashed" className="p-6 text-center">
            <p className="text-sm text-gray-500">No activity yet today.</p>
          </Card>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {timeline.map((a) => (
              <Link
                key={a.id}
                href={`/vyora/parties/${a.partyId}?highlight=${a.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="text-base">
                    {a.type === "payment" ? "💰" : "📝"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-800">
                      {a.partyName}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{a.label}</span>
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    a.signedAmount >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {a.signedAmount >= 0 ? "+" : "−"}
                  {formatMoney(a.amount)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 5 — One-tap actions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Quick actions
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1 rounded-2xl border border-gray-200 bg-white py-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <span aria-hidden className="text-xl">
                {a.icon}
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Section 6 — Business health */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Business health
        </h2>
        <Card className={`border ${hb.ring}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">Overall</div>
              <div className={`inline-flex rounded-lg px-2.5 py-1 text-base font-bold ${hb.cls}`}>
                {hb.label}
              </div>
            </div>
            <div className="text-right text-3xl font-bold tabular-nums text-gray-900">
              {health.score}
              <span className="text-sm font-medium text-gray-400">/100</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Basis label="Recovery ratio" value={`${Math.round(health.recoveryRatio * 100)}%`} />
            <Basis label="Overdue" value={`${Math.round(health.overduePct * 100)}%`} />
            <Basis label="Collected today" value={formatMoney(totals.collection)} />
          </div>
          <Link
            href="/vyora/insights"
            className="hover:text-brand-800 mt-3 block text-center text-sm font-semibold text-brand-700"
          >
            View insights →
          </Link>
        </Card>
      </section>
    </div>
  );
}

function Basis({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-2">
      <div className="text-base font-bold tabular-nums text-gray-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

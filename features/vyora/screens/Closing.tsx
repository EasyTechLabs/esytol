"use client";

/**
 * Vyora — Daily Closing (V2-004).
 *
 * The four questions a merchant asks every evening — what came in, what I gave
 * out, what went out, who I chase tomorrow — answered on one screen, top to
 * bottom, in the order they are asked.
 *
 * Every number is read from an existing selector. Nothing is recalculated here.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { todayISO } from "@/lib/vyora/selectors";
import { buildDailyClosing, closingHistory } from "@/lib/vyora/closing";
import { formatMoney, formatDate, balanceColor } from "@/lib/vyora/format";
import { Empty } from "../components";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`shrink-0 text-sm font-bold tabular-nums ${tone ?? "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

export function Closing() {
  const { ready, ledger, events, settings, updateSettings, dispatch } = useVyora();
  const today = todayISO();
  const [note, setNote] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const closing = useMemo(
    () => (ready ? buildDailyClosing(ledger, events, settings, today) : null),
    [ready, ledger, events, settings, today]
  );
  const history = useMemo(() => closingHistory(events, 30), [events]);

  if (!ready || !closing) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const draft = note ?? closing.notes;

  const saveNote = (text: string) => {
    setNote(text);
    updateSettings({ dayNotes: { ...settings.dayNotes, [today]: text } });
  };

  const finishToday = () => {
    dispatch({ type: "CloseDay", date: today, summary: closing.summary, notes: draft });
  };

  const { summary } = closing;

  return (
    <div className="space-y-4 pb-4">
      {/* 1 — Today's summary */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 text-white">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-300">
          {formatDate(today)}
          {closing.closed ? " · closed" : ""}
        </div>
        <div className="mt-1 text-3xl font-bold tabular-nums leading-tight">
          {formatMoney(summary.netCash)}
        </div>
        <div className="text-sm text-slate-300">net cash today</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="uppercase tracking-wide text-slate-400">Collected</div>
            <div className="text-base font-bold tabular-nums text-emerald-300">
              {formatMoney(summary.collected)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-slate-400">Credit given</div>
            <div className="text-base font-bold tabular-nums text-amber-300">
              {formatMoney(summary.creditGiven)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-slate-400">Paid out</div>
            <div className="text-base font-bold tabular-nums text-red-300">
              {formatMoney(summary.paidOut)}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide text-slate-400">Outstanding</div>
            <div className="text-base font-bold tabular-nums">
              {summary.outstandingChange >= 0 ? "+" : "−"}
              {formatMoney(summary.outstandingChange)}
            </div>
          </div>
        </div>
      </div>

      {/* 5 — Today's wins */}
      {closing.wins.length > 0 && (
        <Card title="Today's wins">
          <div className="flex flex-wrap gap-2">
            {closing.wins.map((win) => (
              <span
                key={win.label}
                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
              >
                ✓ {win.label} {win.value}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* 3 — Tomorrow's recovery */}
      <Card title="Due tomorrow">
        {closing.tomorrow.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nobody is due tomorrow
            {closing.dueTomorrowCount > 0 ? " who still owes you." : "."}
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-600">
              {formatMoney(closing.dueTomorrowAmount)} across {closing.tomorrow.length}{" "}
              {closing.tomorrow.length === 1 ? "customer" : "customers"}.
            </p>
            <div className="divide-y divide-gray-100">
              {closing.tomorrow.slice(0, 8).map((item) => (
                <Link
                  key={item.party.id}
                  href="/vyora/recovery"
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-800">
                      {item.party.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.phone ?? "no phone"} · priority {item.priority}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700">
                    {formatMoney(item.outstanding)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* 4 — Upcoming week */}
      <Card title="Upcoming">
        <Line
          label={`Due tomorrow (${closing.dueTomorrowCount})`}
          value={formatMoney(closing.dueTomorrowAmount)}
        />
        <Line
          label={`Due this week (${closing.week.weekCount})`}
          value={formatMoney(closing.week.weekAmount)}
        />
        <Line
          label={`Overdue (${closing.week.overdueCount})`}
          value={formatMoney(closing.week.overdueAmount)}
          tone="text-red-600"
        />
        <p className="mt-1 text-[10px] text-gray-400">
          Credit scheduled by due date, not unpaid balances.
        </p>
      </Card>

      {/* 2 — Today's activity */}
      <Card title={`Today's activity (${closing.activity.length})`}>
        {closing.activity.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing recorded today.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {closing.activity.map((item) => (
              <Link
                key={item.id}
                href={`/vyora/parties/${item.partyId}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{item.partyName}</div>
                  <div className="text-xs text-gray-400">{item.label}</div>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${balanceColor(item.signedAmount)}`}
                >
                  {item.signedAmount > 0 ? "+" : "−"}
                  {formatMoney(item.amount)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* 6 — Notes */}
      <Card title="Today's notes">
        <textarea
          value={draft}
          onChange={(e) => saveNote(e.target.value)}
          rows={3}
          placeholder="Anything worth remembering about today…"
          className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <p className="mt-1 text-xs text-gray-400">Saved on this device as you type.</p>
      </Card>

      {/* 7 — Close day */}
      <button
        type="button"
        onClick={finishToday}
        className="w-full rounded-2xl bg-brand-600 py-4 text-base font-semibold text-white hover:bg-brand-700"
      >
        {closing.closed ? "Close today again" : "Finish today"}
      </button>
      <p className="px-1 text-center text-xs text-gray-500">
        Signs off today&apos;s figures. Nothing is changed — your balances stay exactly as they are.
      </p>

      {/* History */}
      <Card title="Closing history">
        {history.length === 0 ? (
          <Empty title="No days closed yet" subtitle="Finish a day and it will appear here." />
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((day) => (
              <div key={day.date}>
                <button
                  type="button"
                  onClick={() => setOpenDay(openDay === day.date ? null : day.date)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="text-sm font-medium text-gray-800">{formatDate(day.date)}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                    {formatMoney(day.summary.netCash)}
                  </span>
                </button>
                {openDay === day.date && (
                  <div className="pb-2">
                    <Line label="Collected" value={formatMoney(day.summary.collected)} />
                    <Line label="Credit given" value={formatMoney(day.summary.creditGiven)} />
                    <Line label="Paid out" value={formatMoney(day.summary.paidOut)} />
                    <Line label="Entries" value={String(day.summary.entryCount)} />
                    {day.notes && (
                      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                        {day.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

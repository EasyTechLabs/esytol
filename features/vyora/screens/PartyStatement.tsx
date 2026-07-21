"use client";

/**
 * Vyora Alpha — Party statement. The full, dispute-settling history for one
 * party: every credit and payment, a running balance, and the outstanding at
 * top. "Print / Save as PDF" uses the browser's print dialog (the shareable-PDF
 * placeholder for Alpha — no PDF engine yet).
 */

import { useVyora } from "../VyoraProvider";
import { partyNet, partyStatement } from "@/lib/vyora/selectors";
import { formatMoney, formatDate, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Empty } from "../components";

export function PartyStatement({ partyId }: { partyId: string }) {
  const { ready, data, deleteEntry } = useVyora();
  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const party = data.parties.find((p) => p.id === partyId);
  if (!party) return <Empty title="Party not found" subtitle="It may have been cleared." />;

  const net = partyNet(data, partyId);
  const rows = partyStatement(data, partyId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{party.name}</h1>
            {party.phone && <p className="text-sm text-gray-500">{party.phone}</p>}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden"
          >
            🖨 Print / PDF
          </button>
        </div>
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{balanceLabel(net)}</div>
          <div
            className={`break-words text-3xl font-bold tabular-nums leading-tight ${balanceColor(net)}`}
          >
            {net === 0 ? "Settled" : formatMoney(net)}
          </div>
        </div>
      </div>

      {/* Statement */}
      {rows.length === 0 ? (
        <Empty title="No entries for this party yet" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Entry</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Balance</span>
            <span className="print:hidden" />
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{r.label}</div>
                  <div className="text-xs text-gray-400">
                    {formatDate(r.date)}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <div
                  className={`text-right text-sm font-semibold tabular-nums ${balanceColor(r.signedAmount)}`}
                >
                  {r.signedAmount > 0 ? "+" : "−"}
                  {formatMoney(r.amount)}
                </div>
                <div className={`text-right text-sm tabular-nums ${balanceColor(r.runningNet)}`}>
                  {formatMoney(r.runningNet)}
                </div>
                <button
                  type="button"
                  aria-label="Delete entry"
                  onClick={() => {
                    if (confirm(`Delete this entry (${r.label})?`)) deleteEntry(r.id);
                  }}
                  className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 print:hidden"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 text-xs text-gray-400">
        Positive = they owe you · Negative = you owe them · Balance is the running outstanding after
        each entry.
      </p>
    </div>
  );
}

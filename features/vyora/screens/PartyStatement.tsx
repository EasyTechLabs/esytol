"use client";

/**
 * Vyora Alpha — Party statement. The full, dispute-settling history for one
 * contact: every credit and payment, a running balance, and the outstanding at
 * top. The contact can be renamed safely (history is keyed by immutable id, so
 * nothing breaks). "Print / Save as PDF" uses the browser's print dialog.
 */

import { useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { partyNet, partyStatement } from "@/lib/vyora/selectors";
import { formatMoney, formatDate, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Empty } from "../components";

export function PartyStatement({ partyId }: { partyId: string }) {
  const { ready, data, editParty, deleteEntry } = useVyora();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const party = data.parties.find((p) => p.id === partyId);
  if (!party) return <Empty title="Contact not found" subtitle="It may have been cleared." />;

  const net = partyNet(data, partyId);
  const rows = partyStatement(data, partyId);

  const startEdit = () => {
    setName(party.name);
    setPhone(party.phone ?? "");
    setEditing(true);
  };
  const saveEdit = () => {
    if (!name.trim()) return;
    editParty(partyId, { name, phone });
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {editing ? (
          <div className="space-y-2 print:hidden">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 outline-none focus:border-brand-500"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              inputMode="tel"
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 outline-none focus:border-brand-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={!name.trim()}
                className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border-2 border-gray-200 px-4 py-2 font-semibold text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-gray-900">{party.name}</h1>
              {party.phone && <p className="text-sm text-gray-500">{party.phone}</p>}
            </div>
            <div className="flex shrink-0 gap-2 print:hidden">
              <button
                type="button"
                onClick={startEdit}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                🖨 PDF
              </button>
            </div>
          </div>
        )}
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{balanceLabel(net)}</div>
          <div
            className={`break-words text-3xl font-bold tabular-nums leading-tight ${balanceColor(net)}`}
          >
            {net === 0 ? "Settled" : formatMoney(net)}
          </div>
        </div>
      </div>

      {/* Act from the statement — record a payment (recovery) or a credit for this contact */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <Link
          href={`/vyora/payment?party=${partyId}`}
          className="rounded-xl bg-positive py-3 text-center font-semibold text-white hover:bg-positive-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive-strong"
        >
          ＋ Record payment
        </Link>
        <Link
          href={`/vyora/credit?party=${partyId}`}
          className="rounded-xl bg-brand-600 py-3 text-center font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          ＋ Record credit
        </Link>
      </div>

      {/* Statement */}
      {rows.length === 0 ? (
        <Empty title="No entries for this contact yet" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
                  <div className="text-xs text-gray-500">
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
                    if (confirm(`Delete this entry (${r.label})? You can undo right after.`))
                      deleteEntry(r.id);
                  }}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 print:hidden"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 text-xs text-gray-500">
        Positive = they owe you · Negative = you owe them · Balance is the running outstanding after
        each entry.
      </p>
    </div>
  );
}

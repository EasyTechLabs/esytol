"use client";

/**
 * Vyora — Merchant Statement (P0-004). Replaces the paper ledger page for one
 * contact: header + status, a summary (total credit / paid / outstanding /
 * oldest due), a newest-first timeline with balance-after-transaction and
 * reference, and bottom actions (record credit / payment / share). Outstanding
 * stays visible via a sticky bar. Browser share only — no PDF, no backend.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { useToast } from "../Toast";
import { partyNet, partyStatement, todayISO } from "@/lib/vyora/selectors";
import { agingForParty, allocateFifo, daysBetween } from "@/lib/vyora/aging";
import { formatMoney, formatDate, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Card, Button, TextInput } from "../primitives";
import { Empty } from "../components";

type Status = "OVERDUE" | "DUE_SOON" | "GOOD" | "SETTLED";
const STATUS: Record<Status, { label: string; cls: string }> = {
  OVERDUE: { label: "Overdue", cls: "bg-negative-tint text-negative-strong" },
  DUE_SOON: { label: "Due soon", cls: "bg-amber-50 text-amber-800" },
  GOOD: { label: "Good", cls: "bg-positive-tint text-positive-strong" },
  SETTLED: { label: "Settled", cls: "bg-gray-100 text-gray-600" },
};

export function PartyStatement({ partyId }: { partyId: string }) {
  const { ready, data, editParty, deleteEntry } = useVyora();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const party = data.parties.find((p) => p.id === partyId);

  // Summary + status in one memoized pass (reuses the aging domain).
  const summary = useMemo(() => {
    const today = todayISO();
    const net = partyNet(data, partyId);
    const aging = agingForParty(data, partyId, today);

    let totalCredit = 0;
    let totalPayment = 0;
    let received = 0;
    for (const t of data.transactions) if (t.partyId === partyId) totalCredit += t.amount;
    for (const p of data.payments) {
      if (p.partyId !== partyId) continue;
      totalPayment += p.amount;
      if (p.kind === "received") received += p.amount;
    }

    const given = data.transactions.filter((t) => t.partyId === partyId && t.kind === "given");
    let oldestDue: string | null = null;
    let nearestFutureDueDays: number | null = null;
    for (const lot of allocateFifo(given, received)) {
      if (lot.openAmount <= 0 || !lot.dueDate) continue;
      if (oldestDue === null || lot.dueDate < oldestDue) oldestDue = lot.dueDate;
      if (lot.dueDate >= today) {
        const d = daysBetween(today, lot.dueDate);
        if (nearestFutureDueDays === null || d < nearestFutureDueDays) nearestFutureDueDays = d;
      }
    }

    let status: Status;
    if (net === 0) status = "SETTLED";
    else if (aging.overdueAmount > 0) status = "OVERDUE";
    else if (net > 0 && nearestFutureDueDays !== null && nearestFutureDueDays <= 7)
      status = "DUE_SOON";
    else status = "GOOD";

    return {
      net,
      totalCredit,
      totalPayment,
      oldestDue,
      overdue: aging.overdueAmount > 0,
      status,
    };
  }, [data, partyId]);

  // Timeline: newest first, each row carrying its balance-after-transaction.
  const rows = useMemo(() => [...partyStatement(data, partyId)].reverse(), [data, partyId]);

  // Highlight a row when arriving from global search (…?highlight=<entryId>).
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get("highlight");
    if (!h) return;
    setHighlightId(h);
    const t = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlightId, rows]);

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;
  if (!party) return <Empty title="Contact not found" subtitle="It may have been cleared." />;

  const { net, status } = summary;
  const badge = STATUS[status];

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

  const shareStatement = async () => {
    const lines = [
      `Statement — ${party.name}`,
      party.phone ? party.phone : "",
      `Outstanding: ${net === 0 ? "Settled" : formatMoney(net)} (${balanceLabel(net)})`,
      `Total credit: ${formatMoney(summary.totalCredit)} · Total paid: ${formatMoney(summary.totalPayment)}`,
      "",
      "Recent entries:",
      ...rows
        .slice(0, 8)
        .map(
          (r) =>
            `${formatDate(r.date)} · ${r.label} · ${r.signedAmount > 0 ? "+" : "−"}${formatMoney(
              r.amount
            )} · bal ${formatMoney(r.runningNet)}`
        ),
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: `Statement — ${party.name}`, text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.info("Statement copied — paste into WhatsApp to send");
      } else {
        toast.info("Sharing isn't supported on this device");
      }
    } catch {
      /* share cancelled — no-op */
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header: name · phone · current balance · status badge */}
      <Card>
        {editing ? (
          <div className="space-y-2">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="border-2 px-3 py-2.5"
            />
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              inputMode="tel"
              className="border-2 px-3 py-2.5"
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={saveEdit} disabled={!name.trim()}>
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-gray-900">{party.name}</h1>
                <span
                  className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              {party.phone && <p className="text-sm text-gray-500">{party.phone}</p>}
            </div>
            <button
              type="button"
              onClick={startEdit}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              Edit
            </button>
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
      </Card>

      {/* Sticky summary — Outstanding always visible */}
      <div className="sticky top-[52px] z-10 -mx-4 flex items-center justify-between border-y border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur print:hidden">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Outstanding
        </span>
        <span className={`text-base font-bold tabular-nums ${balanceColor(net)}`}>
          {net === 0 ? "Settled" : formatMoney(net)}
        </span>
      </div>

      {/* Summary: total credit / payment / outstanding / oldest due */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Total credit</div>
          <div className="text-lg font-bold tabular-nums text-gray-900">
            {formatMoney(summary.totalCredit)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Total payment</div>
          <div className="text-lg font-bold tabular-nums text-gray-900">
            {formatMoney(summary.totalPayment)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Outstanding</div>
          <div className={`text-lg font-bold tabular-nums ${balanceColor(net)}`}>
            {net === 0 ? "Settled" : formatMoney(net)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Oldest due</div>
          <div
            className={`text-lg font-bold tabular-nums ${summary.overdue ? "text-negative" : "text-gray-900"}`}
          >
            {summary.oldestDue ? formatDate(summary.oldestDue) : "—"}
          </div>
        </Card>
      </div>

      {/* Timeline — newest first */}
      {rows.length === 0 ? (
        <Empty title="No entries for this contact yet" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Timeline · newest first
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div
                key={r.id}
                ref={r.id === highlightId ? highlightRef : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3",
                  r.id === highlightId && "bg-brand-50 ring-2 ring-inset ring-brand-400"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1 py-0.5 text-[10px] font-bold uppercase ${
                        r.type === "payment"
                          ? "bg-positive-tint text-positive-strong"
                          : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      {r.type === "payment" ? "Payment" : "Credit"}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-800">{r.label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {formatDate(r.date)}
                    {r.mode ? ` · ${r.mode.toUpperCase()}` : ""}
                    {r.reference ? ` · Ref ${r.reference}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-sm font-semibold tabular-nums ${balanceColor(r.signedAmount)}`}
                  >
                    {r.signedAmount > 0 ? "+" : "−"}
                    {formatMoney(r.amount)}
                  </div>
                  <div className="text-xs tabular-nums text-gray-500">
                    Bal {formatMoney(r.runningNet)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Delete entry"
                  onClick={() => {
                    if (confirm(`Delete this entry (${r.label})? You can undo right after.`))
                      deleteEntry(r.id);
                  }}
                  className="flex min-h-[44px] min-w-[36px] items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 print:hidden"
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

      {/* Bottom actions */}
      <div className="grid grid-cols-3 gap-2 print:hidden">
        <Link
          href={`/vyora/credit?party=${partyId}`}
          className="rounded-xl bg-brand-600 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          ＋ Credit
        </Link>
        <Link
          href={`/vyora/payment?party=${partyId}`}
          className="rounded-xl bg-positive py-3 text-center text-sm font-semibold text-white hover:bg-positive-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-positive-strong"
        >
          ＋ Payment
        </Link>
        <button
          type="button"
          onClick={shareStatement}
          className="rounded-xl border-2 border-gray-200 bg-white py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ↗ Share
        </button>
      </div>
    </div>
  );
}

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
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { useToast } from "../Toast";
import { partyNet, partyStatement, todayISO } from "@/lib/vyora/selectors";
import { agingForParty, allocateFifo, daysBetween } from "@/lib/vyora/aging";
import { formatMoney, formatDate, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Card, Button, TextInput } from "../primitives";
import { Empty, LoadingList } from "../components";

type Status = "OVERDUE" | "DUE_SOON" | "GOOD" | "SETTLED";
const STATUS: Record<Status, { label: string; cls: string }> = {
  OVERDUE: { label: "Overdue", cls: "bg-negative-tint text-negative-strong" },
  DUE_SOON: { label: "Due soon", cls: "bg-amber-50 text-amber-800" },
  GOOD: { label: "Good", cls: "bg-positive-tint text-positive-strong" },
  SETTLED: { label: "Settled", cls: "bg-gray-100 text-gray-600" },
};

type TLType = "created" | "credit" | "payment";
interface TLEvent {
  id: string;
  entryId?: string;
  date: string;
  action: string;
  type: TLType;
  amount?: number;
  signedAmount?: number;
  balanceAfter: number;
  reference?: string;
  note?: string;
  mode?: string;
}
function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function PartyStatement({ partyId }: { partyId: string }) {
  const { ready, data, editParty, deleteEntry, deleteContact } = useVyora();
  const router = useRouter();
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

  // Full timeline: credit/payment entries + the "Created contact" event, newest first.
  const events = useMemo<TLEvent[]>(() => {
    const evs: TLEvent[] = rows.map((r) => ({
      id: r.id,
      entryId: r.id,
      date: r.date,
      action: r.label,
      type: r.type === "payment" ? "payment" : "credit",
      amount: r.amount,
      signedAmount: r.signedAmount,
      balanceAfter: r.runningNet,
      reference: r.reference,
      note: r.note,
      mode: r.mode,
    }));
    if (party) {
      evs.push({
        id: `created-${party.id}`,
        date: party.createdAt.slice(0, 10),
        action: "Created contact",
        type: "created",
        balanceAfter: 0,
      });
    }
    return evs; // rows are newest-first; "created" is the oldest, so it lands last
  }, [rows, party]);

  // Group by month (newest month first), preserving newest-first order within each.
  const groups = useMemo(() => {
    const map = new Map<string, TLEvent[]>();
    for (const e of events) {
      const key = e.date.slice(0, 7);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return Array.from(map, ([key, items]) => ({ key, label: monthLabel(key), items }));
  }, [events]);

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

  if (!ready) return <LoadingList />;
  if (!party)
    return <Empty icon="🔍" title="Contact not found" subtitle="It may have been cleared." />;

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

  // Delete the whole contact — confirm shows EXACTLY what goes (entries + outstanding),
  // and it's recoverable (10s Undo, or Settings → Recently Deleted for 30 days).
  const onDeleteContact = () => {
    const count =
      data.transactions.filter((t) => t.partyId === partyId).length +
      data.payments.filter((p) => p.partyId === partyId).length;
    const ok = confirm(
      `Delete ${party.name}?\n\n` +
        `${count} transaction${count === 1 ? "" : "s"}\n` +
        `Outstanding ${net === 0 ? "Settled" : formatMoney(net)}\n\n` +
        `This cannot be recovered after Undo expires.`
    );
    if (!ok) return;
    deleteContact(partyId);
    router.push("/vyora/parties");
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
              aria-label="Contact name"
              className="border-2 px-3 py-2.5"
            />
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              aria-label="Phone number"
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
            <div className="mt-1 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={onDeleteContact}
                className="text-sm font-medium text-red-700 hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
              >
                Delete this contact
              </button>
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

      {/* Timeline — grouped by month, newest first, with sticky month headers */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Timeline
        </h2>
        {groups.map((g) => (
          <div key={g.key}>
            <div className="sticky top-[92px] z-[5] -mx-4 border-y border-gray-200 bg-gray-50/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 backdrop-blur">
              {g.label}
            </div>
            <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {g.items.map((e) => {
                const eid = e.entryId;
                const hl = eid != null && eid === highlightId;
                return (
                  <div
                    key={e.id}
                    ref={hl ? highlightRef : undefined}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3",
                      hl && "bg-brand-50 ring-2 ring-inset ring-brand-400"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1 py-0.5 text-[10px] font-bold uppercase",
                            e.type === "created"
                              ? "bg-gray-100 text-gray-600"
                              : e.type === "payment"
                                ? "bg-positive-tint text-positive-strong"
                                : "bg-brand-50 text-brand-700"
                          )}
                        >
                          {e.type === "created"
                            ? "New"
                            : e.type === "payment"
                              ? "Payment"
                              : "Credit"}
                        </span>
                        <span className="truncate text-sm font-medium text-gray-800">
                          {e.action}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {formatDate(e.date)}
                        {e.mode ? ` · ${e.mode.toUpperCase()}` : ""}
                        {e.reference ? ` · Ref ${e.reference}` : ""}
                        {e.note ? ` · ${e.note}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {e.signedAmount != null && (
                        <div
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            balanceColor(e.signedAmount)
                          )}
                        >
                          {e.signedAmount > 0 ? "+" : "−"}
                          {formatMoney(e.amount ?? 0)}
                        </div>
                      )}
                      <div className="text-xs tabular-nums text-gray-500">
                        Bal {formatMoney(e.balanceAfter)}
                      </div>
                    </div>
                    {eid && (
                      <button
                        type="button"
                        aria-label="Delete entry"
                        onClick={() => {
                          if (confirm(`Delete this entry (${e.action})? You can undo right after.`))
                            deleteEntry(eid);
                        }}
                        className="flex min-h-[44px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 print:hidden"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

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

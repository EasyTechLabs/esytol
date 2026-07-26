"use client";

/**
 * Vyora — Customer 360 (V1-002). The complete view of one customer: header
 * (avatar · name · phone · WhatsApp · outstanding · status), a lifetime summary,
 * recovery (score · risk · next action), one-tap actions (Call · WhatsApp · Credit
 * · Payment · Statement), the full newest-first timeline, and the relationship
 * stats. Every value comes from a single source — `customerProfile` and the shared
 * recovery ranking — so nothing is re-derived. Browser share only, no backend.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useVyora, useLedger } from "../VyoraProvider";
import { useToast } from "../Toast";
import { partyStatement } from "@/lib/vyora/selectors";
import type { CustomerStatus } from "@/lib/vyora/customer";
import type { Priority } from "@/lib/vyora/aging";
import { formatMoney, formatDate, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Card, Button, TextInput } from "../primitives";
import { Empty, LoadingList } from "../components";

const STATUS: Record<CustomerStatus, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-negative-tint text-negative-strong" },
  "due-soon": { label: "Due soon", cls: "bg-amber-50 text-amber-800" },
  good: { label: "Good", cls: "bg-positive-tint text-positive-strong" },
  settled: { label: "Settled", cls: "bg-gray-100 text-gray-600" },
};

const RISK: Record<string, string> = {
  Critical: "bg-negative-tint text-negative-strong",
  High: "bg-amber-50 text-amber-800",
  Medium: "bg-brand-50 text-brand-700",
  Low: "bg-gray-100 text-gray-600",
  None: "bg-gray-100 text-gray-500",
};

const plural = (n: number) => (n === 1 ? "" : "s");

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = [parts[0]?.[0], parts[1]?.[0]].filter(Boolean).join("");
  return (two || "?").toUpperCase();
}
/** wa.me expects a country-coded number; assume +91 for a bare 10-digit Indian mobile. */
function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}
function riskLabel(status: CustomerStatus, priority: Priority | null): string {
  if (status === "settled") return "None";
  if (priority) return priority[0]!.toUpperCase() + priority.slice(1);
  return status === "due-soon" ? "Medium" : "Low";
}
function nextAction(status: CustomerStatus, priority: Priority | null, net: number): string {
  if (net < 0) return `You owe them ${formatMoney(net)} — settle when you can.`;
  if (status === "settled") return "Settled — nothing to do.";
  if (status === "overdue")
    return priority === "critical" || priority === "high"
      ? "Call today and send a reminder."
      : "Send a gentle reminder.";
  if (status === "due-soon") return "Follow up before the due date.";
  return "On track — no action needed.";
}

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
  const { ready, data, editParty, deleteEntry, deleteContact, settings } = useVyora();
  const router = useRouter();
  const toast = useToast();
  const engine = useLedger();
  const rec = engine.recovery;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const party = data.parties.find((p) => p.id === partyId);
  const profile = useMemo(() => engine.getProfile(partyId), [engine, partyId]);

  const rows = useMemo(() => [...partyStatement(data, partyId)].reverse(), [data, partyId]);
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
    if (party)
      evs.push({
        id: `created-${party.id}`,
        date: party.createdAt.slice(0, 10),
        action: "Created contact",
        type: "created",
        balanceAfter: 0,
      });
    return evs;
  }, [rows, party]);
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
    if (highlightId && highlightRef.current)
      highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, rows]);

  if (!ready) return <LoadingList />;
  if (!party || !profile)
    return <Empty icon="🔍" title="Contact not found" subtitle="It may have been cleared." />;

  const net = profile.outstanding;
  const badge = STATUS[profile.status];
  const recRow = rec.overdue.find((r) => r.partyId === partyId) ?? null;
  const score = recRow?.score ?? null;
  const priority = recRow?.priority ?? null;
  const risk = riskLabel(profile.status, priority);

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
  const onDeleteContact = () => {
    const count =
      data.transactions.filter((t) => t.partyId === partyId).length +
      data.payments.filter((p) => p.partyId === partyId).length;
    const ok = confirm(
      `Delete ${party.name}?\n\n${count} transaction${count === 1 ? "" : "s"}\n` +
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
      party.phone || "",
      `Outstanding: ${net === 0 ? "Settled" : formatMoney(net)} (${balanceLabel(net)})`,
      `Lifetime credit: ${formatMoney(profile.lifetimeCredit)} · Lifetime paid: ${formatMoney(profile.lifetimePayment)}`,
      "",
      "Recent entries:",
      ...rows
        .slice(0, 8)
        .map(
          (r) =>
            `${formatDate(r.date)} · ${r.label} · ${r.signedAmount > 0 ? "+" : "−"}${formatMoney(r.amount)} · bal ${formatMoney(r.runningNet)}`
        ),
    ].filter(Boolean);
    const bizHeader = [
      settings.businessName,
      [settings.mobile, settings.gst ? `GST ${settings.gst}` : ""].filter(Boolean).join(" · "),
      settings.address,
    ]
      .filter(Boolean)
      .join("\n");
    const text = (bizHeader ? `${bizHeader}\n\n` : "") + lines.join("\n");
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function")
        await navigator.share({ title: `Statement — ${party.name}`, text });
      else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.info("Statement copied — paste into WhatsApp to send");
      } else toast.info("Sharing isn't supported on this device");
    } catch {
      /* share cancelled */
    }
  };

  const days = (n: number | null) => (n === null ? "—" : `${n} day${plural(n)}`);

  return (
    <div className="space-y-4 pb-4">
      {/* ── Header ── */}
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
          <>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700"
              >
                {initials(party.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-bold text-gray-900">{party.name}</h1>
                  <span
                    className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>
                {party.phone ? (
                  <p className="text-sm text-gray-500">{party.phone}</p>
                ) : (
                  <p className="text-sm text-gray-400">No phone</p>
                )}
              </div>
              <button
                type="button"
                onClick={startEdit}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                Edit
              </button>
            </div>
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                {balanceLabel(net)}
              </div>
              <div
                className={`break-words text-3xl font-bold tabular-nums leading-tight ${balanceColor(net)}`}
              >
                {net === 0 ? "Settled" : formatMoney(net)}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Sticky outstanding */}
      <div className="sticky top-[52px] z-10 -mx-4 flex items-center justify-between border-y border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur print:hidden">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Outstanding
        </span>
        <span className={`text-base font-bold tabular-nums ${balanceColor(net)}`}>
          {net === 0 ? "Settled" : formatMoney(net)}
        </span>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Lifetime credit" value={formatMoney(profile.lifetimeCredit)} />
        <Stat label="Lifetime payment" value={formatMoney(profile.lifetimePayment)} />
        <Stat
          label="Outstanding"
          value={net === 0 ? "Settled" : formatMoney(net)}
          cls={balanceColor(net)}
        />
        <Stat label="Avg payment time" value={days(profile.avgPaymentDays)} />
        <div className="col-span-2">
          <Stat
            label="Last activity"
            value={profile.lastActivity ? formatDate(profile.lastActivity) : "—"}
          />
        </div>
      </div>

      {/* ── Recovery ── */}
      <Card as="section" className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Recovery</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Score</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {score === null ? "—" : `${score}`}
              {score !== null && <span className="text-sm font-medium text-gray-400">/100</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Risk</div>
            <span className={`inline-flex rounded-lg px-2 py-0.5 text-sm font-bold ${RISK[risk]}`}>
              {risk}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Next action</div>
          <div className="text-sm font-medium text-gray-800">
            {nextAction(profile.status, priority, net)}
          </div>
        </div>
      </Card>

      {/* ── Actions ── */}
      <div className="grid grid-cols-5 gap-2 print:hidden">
        <ActionBtn label="Call" icon="📞" href={party.phone ? `tel:${party.phone}` : undefined} />
        <ActionBtn
          label="WhatsApp"
          icon="💬"
          href={party.phone ? `https://wa.me/${waNumber(party.phone)}` : undefined}
          external
        />
        <ActionBtn label="Credit" icon="📝" href={`/vyora/credit?party=${partyId}`} internal />
        <ActionBtn label="Payment" icon="💰" href={`/vyora/payment?party=${partyId}`} internal />
        <ActionBtn label="Statement" icon="↗" onClick={shareStatement} />
      </div>

      {/* ── Timeline ── */}
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

      {/* ── Relationship ── */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Relationship
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Customer since" value={formatDate(profile.customerSince)} />
          <Stat label="Longest delay" value={days(profile.longestDelayDays)} />
          <Stat label="Largest purchase" value={formatMoney(profile.largestPurchase)} />
          <Stat label="Largest payment" value={formatMoney(profile.largestPayment)} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", cls ?? "text-gray-900")}>{value}</div>
    </Card>
  );
}

function ActionBtn({
  label,
  icon,
  href,
  onClick,
  external,
  internal,
}: {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  internal?: boolean;
}) {
  const cls =
    "flex flex-col items-center gap-1 rounded-2xl border border-gray-200 bg-white py-2.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600";
  const disabledCls =
    "flex flex-col items-center gap-1 rounded-2xl border border-gray-200 bg-white py-2.5 text-[11px] font-semibold text-gray-300";
  const inner = (
    <>
      <span aria-hidden className="text-lg">
        {icon}
      </span>
      {label}
    </>
  );
  if (!href && !onClick)
    return (
      <span className={disabledCls} aria-disabled>
        {inner}
      </span>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  if (internal)
    return (
      <Link href={href!} className={cls}>
        {inner}
      </Link>
    );
  return (
    <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
      {inner}
    </a>
  );
}

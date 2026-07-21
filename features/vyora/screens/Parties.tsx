"use client";

/**
 * Vyora — Contacts Workspace (P0-005). The page answers, at a glance: who owes
 * me, who I owe, who's overdue, who needs action. Colour-coded status, quick
 * actions (Call / Statement / Record payment / More), top filters, instant
 * search, sort, and a New-Contact FAB. Local only — no backend.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { formatMoney, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Card, Button, TextInput } from "../primitives";
import { Empty } from "../components";
import { useContactsWorkspace, type ContactRow, type ContactStatus } from "../useContactsWorkspace";

type Filter = "all" | "receivable" | "payable" | "overdue" | "settled";
type Sort = "outstanding" | "due" | "alpha" | "updated";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "receivable", label: "Receivable" },
  { key: "payable", label: "Payable" },
  { key: "overdue", label: "Overdue" },
  { key: "settled", label: "Settled" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "outstanding", label: "Highest outstanding" },
  { key: "due", label: "Oldest due" },
  { key: "alpha", label: "Alphabetical" },
  { key: "updated", label: "Recently updated" },
];

const STATUS_META: Record<ContactStatus, { label: string; cls: string }> = {
  OVERDUE: { label: "Overdue", cls: "bg-negative-tint text-negative-strong" },
  DUE_SOON: { label: "Due soon", cls: "bg-amber-50 text-amber-800" },
  GOOD: { label: "Good", cls: "bg-positive-tint text-positive-strong" },
  SETTLED: { label: "Settled", cls: "bg-gray-100 text-gray-600" },
};

export function Parties() {
  const { ready, data, createParty } = useVyora();
  const rows = useContactsWorkspace(data);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("outstanding");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = (r: ContactRow) =>
      !needle ||
      [r.party.name, r.party.phone ?? "", r.party.note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    const keep = (r: ContactRow) => {
      if (filter === "receivable") return r.direction === "receivable";
      if (filter === "payable") return r.direction === "payable";
      if (filter === "overdue") return r.status === "OVERDUE";
      if (filter === "settled") return r.status === "SETTLED";
      return true;
    };
    const list = rows.filter((r) => keep(r) && matches(r));
    const byName = (a: ContactRow, b: ContactRow) => a.party.name.localeCompare(b.party.name);
    list.sort((a, b) => {
      if (sort === "outstanding") return b.outstanding - a.outstanding || byName(a, b);
      if (sort === "alpha") return byName(a, b);
      if (sort === "updated")
        return a.lastUpdated < b.lastUpdated ? 1 : a.lastUpdated > b.lastUpdated ? -1 : 0;
      // "due": most overdue / oldest-open first; contacts with nothing open last.
      const ao = a.oldestOpenDays ?? -Infinity;
      const bo = b.oldestOpenDays ?? -Infinity;
      return bo - ao || byName(a, b);
    });
    return list;
  }, [rows, q, filter, sort]);

  if (!ready) return <div className="py-20 text-center text-gray-500">Loading…</div>;

  const add = () => {
    if (!name.trim()) return;
    createParty({ name, phone: phone || undefined });
    setName("");
    setPhone("");
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {/* Instant search */}
      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Search name, phone, business…"
        aria-label="Search contacts by name, phone, or business name"
      />

      {/* Top filters */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${
              filter === f.key
                ? "bg-brand-600 text-white"
                : "border border-gray-200 bg-white text-gray-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort + count */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-500">
          {view.length} contact{view.length === 1 ? "" : "s"}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Contact cards */}
      {view.length === 0 ? (
        <Empty
          title={q ? `No contact matching “${q}”` : "No contacts here"}
          subtitle={
            q
              ? "Try another search, or tap ＋ to add."
              : "Tap ＋ to add a contact, or record a credit."
          }
        />
      ) : (
        <div className="space-y-3">
          {view.map((r) => (
            <ContactCard
              key={r.party.id}
              row={r}
              menuOpen={menuId === r.party.id}
              onMenu={() => setMenuId((id) => (id === r.party.id ? null : r.party.id))}
            />
          ))}
        </div>
      )}

      {/* Floating action button — New contact */}
      <button
        type="button"
        onClick={() => {
          setAdding(true);
          setName(q);
        }}
        aria-label="New contact"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-3xl leading-none text-white shadow-lg hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 print:hidden"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        ＋
      </button>

      {/* New-contact modal */}
      {adding && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center print:hidden">
          <Card className="w-full max-w-sm space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">New contact</h2>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (or business name)"
              autoFocus
            />
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile (optional)"
              inputMode="tel"
            />
            <div className="flex gap-2 pt-1">
              <Button variant="primary" block onClick={add} disabled={!name.trim()}>
                Add contact
              </Button>
              <Button variant="secondary" onClick={() => setAdding(false)} className="px-5">
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ContactCard({
  row,
  menuOpen,
  onMenu,
}: {
  row: ContactRow;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const { party, net, status } = row;
  const s = STATUS_META[status];
  const id = party.id;

  return (
    <Card className="relative space-y-3">
      {/* Header: name + status, and the outstanding */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-gray-900">{party.name}</span>
            <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-bold ${s.cls}`}>
              {s.label}
            </span>
          </div>
          {party.phone && <div className="mt-0.5 text-xs text-gray-500">{party.phone}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-bold tabular-nums ${balanceColor(net)}`}>
            {net === 0 ? "Settled" : formatMoney(net)}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {balanceLabel(net)}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-3">
        <QuickAction
          label="Call"
          icon="📞"
          href={party.phone ? `tel:${party.phone}` : undefined}
          disabled={!party.phone}
        />
        <QuickAction label="Statement" icon="📄" href={`/vyora/parties/${id}`} internal />
        <QuickAction label="Payment" icon="₹" href={`/vyora/payment?party=${id}`} internal />
        <QuickAction label="More" icon="⋯" onClick={onMenu} />
      </div>

      {/* More menu */}
      {menuOpen && (
        <div className="absolute bottom-2 right-2 z-10 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <Link
            href={`/vyora/credit?party=${id}`}
            className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ＋ Record credit
          </Link>
          <Link
            href={`/vyora/parties/${id}`}
            className="block border-t border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ✎ Edit / full statement
          </Link>
        </div>
      )}
    </Card>
  );
}

function QuickAction({
  label,
  icon,
  href,
  internal,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  href?: string;
  internal?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls =
    "flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600";
  const inner = (
    <>
      <span className="text-base leading-none">{icon}</span>
      {label}
    </>
  );
  if (disabled) {
    return (
      <div className={`${cls} cursor-not-allowed opacity-40`} aria-disabled>
        {inner}
      </div>
    );
  }
  if (href && internal) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

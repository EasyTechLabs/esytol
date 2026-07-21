"use client";

/**
 * Vyora — Contacts Workspace (P0-005) + Smart Filters (P1-002). Answers who owes
 * me / who I owe / who's overdue / who needs action, and filters the list
 * instantly: 8 combinable toggles, an amount range, and a date range — persisted
 * per screen, local only. Colour-coded status, quick actions, search, sort, FAB.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import { todayISO } from "@/lib/vyora/selectors";
import { formatMoney, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Card, Button, TextInput } from "../primitives";
import { Empty, LoadingList } from "../components";
import { useContactsWorkspace, type ContactRow, type ContactStatus } from "../useContactsWorkspace";

type Sort = "outstanding" | "due" | "alpha" | "updated";
type DateRange = "all" | "today" | "7d" | "30d" | "custom";

interface Filters {
  toggles: string[];
  amountMin: string;
  amountMax: string;
  dateRange: DateRange;
  from: string;
  to: string;
}

const FILTERS_KEY = "vyora.filters.contacts";
const DEFAULT_FILTERS: Filters = {
  toggles: [],
  amountMin: "",
  amountMax: "",
  dateRange: "all",
  from: "",
  to: "",
};

const TOGGLES: { key: string; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "dueToday", label: "Due today" },
  { key: "dueWeek", label: "Due this week" },
  { key: "receivable", label: "Receivable" },
  { key: "payable", label: "Payable" },
  { key: "settled", label: "Settled" },
  { key: "highValue", label: "High value" },
  { key: "inactive", label: "Inactive" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "outstanding", label: "Highest outstanding" },
  { key: "due", label: "Oldest due" },
  { key: "alpha", label: "Alphabetical" },
  { key: "updated", label: "Recently updated" },
];

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" },
];

const STATUS_META: Record<ContactStatus, { label: string; cls: string }> = {
  OVERDUE: { label: "Overdue", cls: "bg-negative-tint text-negative-strong" },
  DUE_SOON: { label: "Due soon", cls: "bg-amber-50 text-amber-800" },
  GOOD: { label: "Good", cls: "bg-positive-tint text-positive-strong" },
  SETTLED: { label: "Settled", cls: "bg-gray-100 text-gray-600" },
};

const INACTIVE_DAYS = 30;

export function Parties() {
  const { ready, data, createParty } = useVyora();
  const rows = useContactsWorkspace(data);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("outstanding");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Filters — persisted per screen (local only).
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters, loaded]);

  const toggle = (key: string) =>
    setFilters((f) => ({
      ...f,
      toggles: f.toggles.includes(key) ? f.toggles.filter((k) => k !== key) : [...f.toggles, key],
    }));
  const activeCount =
    filters.toggles.length +
    (filters.amountMin || filters.amountMax ? 1 : 0) +
    (filters.dateRange !== "all" ? 1 : 0);

  const view = useMemo(() => {
    // "High value" = top quartile of outstanding among contacts who are owed something.
    const outs = rows
      .map((r) => r.outstanding)
      .filter((o) => o > 0)
      .sort((a, b) => a - b);
    let hvThreshold = Infinity;
    if (outs.length) {
      const idx = Math.min(Math.floor(outs.length * 0.75), outs.length - 1);
      hvThreshold = outs[idx] ?? Infinity;
    }

    const now = Date.now();
    const daysSince = (iso: string) => (now - new Date(iso).getTime()) / 86_400_000;
    const t = todayISO();
    const min = filters.amountMin.trim() ? Number(filters.amountMin) : null;
    const max = filters.amountMax.trim() ? Number(filters.amountMax) : null;

    const inDateRange = (r: ContactRow) => {
      const d = r.lastUpdated.slice(0, 10);
      if (filters.dateRange === "today") return d === t;
      if (filters.dateRange === "7d") return daysSince(r.lastUpdated) <= 7;
      if (filters.dateRange === "30d") return daysSince(r.lastUpdated) <= 30;
      if (filters.dateRange === "custom") {
        if (filters.from && d < filters.from) return false;
        if (filters.to && d > filters.to) return false;
        return true;
      }
      return true;
    };
    const passToggle = (r: ContactRow, key: string) => {
      switch (key) {
        case "overdue":
          return r.status === "OVERDUE";
        case "dueToday":
          return r.nearestDueDays === 0;
        case "dueWeek":
          return r.nearestDueDays !== null && r.nearestDueDays >= 0 && r.nearestDueDays <= 7;
        case "receivable":
          return r.direction === "receivable";
        case "payable":
          return r.direction === "payable";
        case "settled":
          return r.status === "SETTLED";
        case "highValue":
          return r.outstanding > 0 && r.outstanding >= hvThreshold;
        case "inactive":
          return daysSince(r.lastUpdated) > INACTIVE_DAYS;
        default:
          return true;
      }
    };

    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (
        needle &&
        ![r.party.name, r.party.phone ?? "", r.party.note ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
        return false;
      if (min !== null && r.outstanding < min) return false;
      if (max !== null && r.outstanding > max) return false;
      if (!inDateRange(r)) return false;
      for (const key of filters.toggles) if (!passToggle(r, key)) return false;
      return true;
    });

    const byName = (a: ContactRow, b: ContactRow) => a.party.name.localeCompare(b.party.name);
    list.sort((a, b) => {
      if (sort === "outstanding") return b.outstanding - a.outstanding || byName(a, b);
      if (sort === "alpha") return byName(a, b);
      if (sort === "updated")
        return a.lastUpdated < b.lastUpdated ? 1 : a.lastUpdated > b.lastUpdated ? -1 : 0;
      const ao = a.oldestOpenDays ?? -Infinity;
      const bo = b.oldestOpenDays ?? -Infinity;
      return bo - ao || byName(a, b);
    });
    return list;
  }, [rows, q, filters, sort]);

  if (!ready) return <LoadingList />;

  const add = () => {
    if (!name.trim()) return;
    createParty({ name, phone: phone || undefined });
    setName("");
    setPhone("");
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Search name, phone, business…"
        aria-label="Search contacts"
      />

      {/* Filter toggles */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TOGGLES.map((f) => {
          const on = filters.toggles.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggle(f.key)}
              aria-pressed={on}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600",
                on ? "bg-brand-600 text-white" : "border border-gray-200 bg-white text-gray-600"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Amount + date ranges (expandable) + clear */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="text-sm font-medium text-brand-700"
        >
          {showFilters ? "Hide" : "Amount & date"}{" "}
          {activeCount > 0 ? `· ${activeCount} active` : ""}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-sm font-medium text-gray-500"
          >
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <Card className="space-y-3 p-3">
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Amount range (outstanding)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                inputMode="numeric"
                value={filters.amountMin}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, amountMin: e.target.value.replace(/[^0-9]/g, "") }))
                }
                placeholder="Min ₹"
                className="px-3 py-2.5 text-base"
              />
              <TextInput
                inputMode="numeric"
                value={filters.amountMax}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, amountMax: e.target.value.replace(/[^0-9]/g, "") }))
                }
                placeholder="Max ₹"
                className="px-3 py-2.5 text-base"
              />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Last active
            </span>
            <div className="flex flex-wrap gap-2">
              {DATE_RANGES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, dateRange: d.key }))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600",
                    filters.dateRange === d.key
                      ? "bg-brand-600 text-white"
                      : "border border-gray-200 bg-white text-gray-600"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {filters.dateRange === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <TextInput
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                  className="px-3 py-2.5"
                />
                <TextInput
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                  className="px-3 py-2.5"
                />
              </div>
            )}
          </div>
        </Card>
      )}

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

      {/* Cards */}
      {view.length === 0 ? (
        <Empty
          icon="👥"
          title={activeCount > 0 || q ? "No contacts match these filters" : "No contacts here"}
          subtitle={
            activeCount > 0 || q
              ? "Adjust the filters or search, or tap ＋ to add."
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

      {/* New-contact FAB */}
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

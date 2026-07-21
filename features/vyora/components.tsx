"use client";

/**
 * Vyora Alpha — shared UI atoms. Big touch targets, plain language, high
 * contrast — built for a tired shopkeeper's thumb at 9 PM, not for a design
 * showcase. Tailwind + the esytol brand tokens; nothing fancy.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useVyora } from "./VyoraProvider";
import { searchParties } from "@/lib/vyora/selectors";
import { formatMoney, balanceColor } from "@/lib/vyora/format";

/** A headline number card for the dashboard. */
export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: "in" | "out" | "neutral";
  hint?: string;
}) {
  const color =
    tone === "in" ? "text-emerald-600" : tone === "out" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn("mt-1 break-words text-2xl font-bold tabular-nums leading-tight", color)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

/** A big two-option toggle (direction of a credit/payment). One tap. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; tone: "in" | "out" }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.value === value;
        const activeCls =
          o.tone === "in"
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : "border-red-500 bg-red-50 text-red-700";
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
              active ? activeCls : "border-gray-200 bg-white text-gray-500"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The big ₹ amount field — autofocused hero of every entry screen. */
export function AmountField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-600">Amount</span>
      <div className="flex items-center rounded-2xl border-2 border-gray-200 bg-white px-4 focus-within:border-brand-500">
        <span className="text-3xl font-bold text-gray-400">₹</span>
        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0"
          className="w-full bg-transparent px-2 py-4 text-4xl font-bold tabular-nums outline-none"
          aria-label="Amount in rupees"
        />
      </div>
    </label>
  );
}

/**
 * Party picker — type a name; pick an existing party or create one inline.
 * This is what makes entry fast: no separate "create party" step.
 */
export function PartyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const { data } = useVyora();
  const [open, setOpen] = useState(false);
  const matches = useMemo(
    () =>
      value.trim() ? searchParties(data, value).slice(0, 6) : searchParties(data, "").slice(0, 6),
    [data, value]
  );
  const exact = data.parties.some(
    (p) => p.name.trim().toLowerCase() === value.trim().toLowerCase()
  );

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-600">
          Party (customer / supplier)
        </span>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Name…"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-500"
        />
      </label>
      {open && (matches.length > 0 || value.trim()) && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {matches.map(({ party, net }) => (
            <button
              key={party.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(party.name);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">{party.name}</span>
              <span className={cn("text-sm tabular-nums", balanceColor(net))}>
                {net === 0 ? "Settled" : formatMoney(net)}
              </span>
            </button>
          ))}
          {value.trim() && !exact && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-brand-700 hover:bg-brand-50"
            >
              <span className="text-lg leading-none">＋</span>
              <span className="font-medium">Add “{value.trim()}” as a new party</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Primary full-width action button. */
export function BigButton({
  children,
  onClick,
  disabled,
  type = "button",
  tone = "brand",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  tone?: "brand" | "emerald" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : tone === "red"
        ? "bg-red-600 hover:bg-red-700"
        : "bg-brand-600 hover:bg-brand-700";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl px-4 py-4 text-lg font-semibold text-white transition-colors disabled:opacity-50",
        cls
      )}
    >
      {children}
    </button>
  );
}

/** A small empty-state block. */
export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

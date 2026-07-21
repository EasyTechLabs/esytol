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
import type { PartyRef } from "@/lib/vyora/types";
import type { Priority } from "@/lib/vyora/aging";
import { Card, Button } from "./primitives";

const PRIORITY_META: Record<Priority, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-negative-tint text-negative-strong" },
  high: { label: "High", cls: "bg-amber-50 text-amber-800" },
  medium: { label: "Medium", cls: "bg-brand-50 text-brand-700" },
  low: { label: "Low", cls: "bg-gray-100 text-gray-600" },
};

/** A recovery-priority pill (Critical / High / Medium / Low). */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span className={cn("rounded-lg px-1.5 py-0.5 text-[10px] font-bold uppercase", m.cls)}>
      {m.label}
    </span>
  );
}

/** The picker's controlled value: what's typed, and the resolved contact (or null until chosen). */
export interface PartySelection {
  text: string;
  ref: PartyRef | null;
}

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
    tone === "in" ? "text-positive" : tone === "out" ? "text-negative" : "text-gray-900";
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn("mt-1 break-words text-2xl font-bold tabular-nums leading-tight", color)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </Card>
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
            ? "border-positive-line bg-positive-tint text-positive-strong"
            : "border-negative-line bg-negative-tint text-negative-strong";
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              active ? activeCls : "border-gray-200 bg-white text-gray-600"
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
 * Party picker — type a name and either **pick a known contact** (binds its
 * immutable id) or **explicitly add a new one**. Typing a name never silently
 * creates a duplicate: an entry can only be saved once a contact is bound
 * (existing id) or the merchant deliberately chooses "Add new". An exact,
 * unambiguous name match auto-binds so repeat customers stay fast.
 */
export function PartyPicker({
  value,
  onChange,
}: {
  value: PartySelection;
  onChange: (v: PartySelection) => void;
}) {
  const { data } = useVyora();
  const [open, setOpen] = useState(false);
  const q = value.text;
  const matches = useMemo(
    () => (q.trim() ? searchParties(data, q).slice(0, 6) : searchParties(data, "").slice(0, 6)),
    [data, q]
  );

  const setText = (text: string) => {
    const exact = data.parties.filter(
      (p) => p.name.trim().toLowerCase() === text.trim().toLowerCase()
    );
    onChange({ text, ref: exact.length === 1 ? { kind: "existing", id: exact[0].id } : null });
    setOpen(true);
  };
  const pick = (id: string, name: string) => {
    onChange({ text: name, ref: { kind: "existing", id } });
    setOpen(false);
  };
  const addNew = () => {
    if (q.trim()) onChange({ text: q, ref: { kind: "new", name: q.trim() } });
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Contact (customer / supplier)
        </span>
        <input
          value={q}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Name…"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-500 focus-visible:border-brand-500"
        />
      </label>

      {/* Bound-contact / new-contact indicator (so the merchant sees what they're recording against) */}
      {value.ref?.kind === "existing" && (
        <p className="mt-1 text-xs font-medium text-emerald-700">✓ Known contact selected</p>
      )}
      {value.ref?.kind === "new" && (
        <p className="mt-1 text-xs font-medium text-brand-700">
          ＋ New contact “{value.ref.name}” will be created
        </p>
      )}
      {!value.ref && q.trim() && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Pick a contact below, or “Add new”.
        </p>
      )}

      {open && (matches.length > 0 || q.trim()) && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {matches.map(({ party, net }) => (
            <button
              key={party.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(party.id, party.name)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
            >
              <span className="min-w-0 truncate font-medium text-gray-800">{party.name}</span>
              <span className={cn("shrink-0 text-sm tabular-nums", balanceColor(net))}>
                {net === 0 ? "Settled" : formatMoney(net)}
              </span>
            </button>
          ))}
          {q.trim() &&
            !data.parties.some((p) => p.name.trim().toLowerCase() === q.trim().toLowerCase()) && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={addNew}
                className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-3 text-left text-brand-700 hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none"
              >
                <span className="text-lg leading-none">＋</span>
                <span className="font-medium">Add “{q.trim()}” as a new contact</span>
              </button>
            )}
        </div>
      )}
    </div>
  );
}

/** Primary full-width action button — thin wrapper over the shared `Button` (lg, block). */
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
  const variant = tone === "emerald" ? "positive" : tone === "red" ? "negative" : "primary";
  return (
    <Button type={type} onClick={onClick} disabled={disabled} variant={variant} size="lg" block>
      {children}
    </Button>
  );
}

/** A small empty-state block. */
export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Card tone="dashed" className="p-8 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </Card>
  );
}

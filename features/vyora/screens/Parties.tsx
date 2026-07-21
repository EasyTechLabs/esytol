"use client";

/**
 * Vyora Alpha — Parties. One flat list of everyone (customer, supplier, both),
 * with instant search and a quick add. Each row shows the net at a glance.
 */

import { useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { searchParties } from "@/lib/vyora/selectors";
import { formatMoney, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { BigButton, Empty } from "../components";

export function Parties() {
  const { ready, data, createParty } = useVyora();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const results = searchParties(data, q);

  const add = () => {
    if (!name.trim()) return;
    createParty({ name, phone: phone || undefined });
    setName("");
    setPhone("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Instant search */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Search parties…"
        className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-500"
        aria-label="Search parties"
      />

      {!adding ? (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setName(q);
          }}
          className="text-sm font-medium text-brand-700"
        >
          ＋ Add a party
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-3">
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
            <BigButton type="button" onClick={add} disabled={!name.trim()}>
              Add
            </BigButton>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-2xl border-2 border-gray-200 px-4 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {results.length === 0 ? (
        <Empty
          title={q ? `No party matching “${q}”` : "No parties yet"}
          subtitle={
            q
              ? "Tap “Add a party” to create it."
              : "Record a credit and the party is created for you."
          }
        />
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {results.map(({ party, net }) => (
            <Link
              key={party.id}
              href={`/vyora/parties/${party.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-800">{party.name}</div>
                {party.phone && <div className="text-xs text-gray-400">{party.phone}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-sm font-semibold tabular-nums ${balanceColor(net)}`}>
                  {net === 0 ? "Settled" : formatMoney(net)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">
                  {balanceLabel(net)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

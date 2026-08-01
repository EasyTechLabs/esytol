"use client";

/**
 * Vyora Alpha — Parties. One flat list of everyone (customer, supplier, both),
 * with instant search and a quick add. Each row shows the net at a glance.
 */

import { useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import type { Party } from "@/lib/vyora/types";
import { readSearch } from "@/lib/vyora/ledger";
import { isFavorite, toggleFavorite, withFavoritesFirst } from "@/lib/vyora/productivity";
import { ContactSheet, useLongPress } from "../ContactSheet";
import { formatMoney, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { BigButton, Empty } from "../components";

export function Parties() {
  const { ready, ledger, dispatch, settings, updateSettings } = useVyora();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sheetFor, setSheetFor] = useState<Party | null>(null);

  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  // Pinned customers first; the ledger's exposure order survives within groups.
  const results = withFavoritesFirst(readSearch(ledger, q), settings, (b) => b.party.id);

  const add = () => {
    const result = dispatch({ type: "CreateContact", name, phone: phone || undefined });
    if (!result.ok) return;
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
            <ContactRow
              key={party.id}
              party={party}
              net={net}
              pinned={isFavorite(settings, party.id)}
              onPin={() =>
                updateSettings({
                  favoriteContactIds: toggleFavorite(settings.favoriteContactIds, party.id),
                })
              }
              onLongPress={() => setSheetFor(party)}
            />
          ))}
        </div>
      )}
      <ContactSheet party={sheetFor} onClose={() => setSheetFor(null)} />
    </div>
  );
}

/** One contact row. Long press anywhere on it opens the quick-action sheet. */
function ContactRow({
  party,
  net,
  pinned,
  onPin,
  onLongPress,
}: {
  party: Party;
  net: number;
  pinned: boolean;
  onPin: () => void;
  onLongPress: () => void;
}) {
  const press = useLongPress(onLongPress);
  return (
    <div className="flex items-stretch hover:bg-gray-50">
      {/* Pin toggle sits outside the link so tapping it never navigates. */}
      <button
        type="button"
        aria-label={pinned ? `Unpin ${party.name}` : `Pin ${party.name} to the top`}
        aria-pressed={pinned}
        onClick={onPin}
        className={`px-3 text-lg ${pinned ? "text-amber-500" : "text-gray-200"}`}
      >
        ★
      </button>
      <Link
        href={`/vyora/parties/${party.id}`}
        {...press}
        onClick={(event) => {
          // A long press already opened the sheet — do not also navigate.
          if (press.didFire()) event.preventDefault();
        }}
        className="flex flex-1 select-none items-center justify-between py-3 pr-4"
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
      {party.phone && (
        <a
          href={`tel:${party.phone}`}
          aria-label={`Call ${party.name}`}
          className="flex items-center px-3 text-lg text-brand-600"
        >
          📞
        </a>
      )}
    </div>
  );
}

"use client";

/**
 * Vyora — Global Merchant Search (P1-001). Find anything in under 2 seconds:
 * a shell-mounted search bar + Ctrl/⌘-K overlay that searches a PRECOMPUTED
 * local index (name, phone, reference, notes, amount) — no backend, no fuzzy AI.
 * Results are grouped (Contacts / Credits / Payments); Enter/arrows/Esc drive it;
 * the last 10 searches are kept locally. Selecting a contact opens its statement;
 * selecting an entry opens the statement with that row highlighted.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useVyora } from "./VyoraProvider";
import { partyNet } from "@/lib/vyora/selectors";
import { formatMoney, formatDate } from "@/lib/vyora/format";

const RECENT_KEY = "vyora.recent.searches";

type Kind = "contact" | "credit" | "payment";
interface SearchItem {
  kind: Kind;
  /** entry id (credit/payment) or party id (contact) — the thing selected. */
  id: string;
  partyId: string;
  title: string;
  subtitle: string;
  text: string; // lowercased searchable blob
}

function loadRecent(): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(r) ? r.filter((x) => typeof x === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  const next = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 10);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recent searches are best-effort */
  }
}

export function GlobalSearch({ showBar }: { showBar: boolean }) {
  const router = useRouter();
  const { data } = useVyora();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the index ONCE per data change (fast local indexing).
  const index = useMemo<SearchItem[]>(() => {
    const nameOf = (id: string) => data.parties.find((p) => p.id === id)?.name ?? "Contact";
    const items: SearchItem[] = [];
    for (const p of data.parties) {
      const net = partyNet(data, p.id);
      items.push({
        kind: "contact",
        id: p.id,
        partyId: p.id,
        title: p.name,
        subtitle: p.phone || (net === 0 ? "Settled" : formatMoney(net)),
        text: [p.name, p.phone, p.note, String(Math.abs(net))]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }
    for (const t of data.transactions) {
      const name = nameOf(t.partyId);
      const label = t.kind === "given" ? "Credit given" : "Credit taken";
      items.push({
        kind: "credit",
        id: t.id,
        partyId: t.partyId,
        title: `${label} · ${formatMoney(t.amount)}`,
        subtitle: `${name} · ${formatDate(t.date)}${t.reference ? ` · Ref ${t.reference}` : ""}`,
        text: [name, t.reference, t.description, String(t.amount)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }
    for (const p of data.payments) {
      const name = nameOf(p.partyId);
      const label = p.kind === "received" ? "Payment received" : "Payment made";
      items.push({
        kind: "payment",
        id: p.id,
        partyId: p.partyId,
        title: `${label} · ${formatMoney(p.amount)}`,
        subtitle: `${name} · ${formatDate(p.date)}${p.mode ? ` · ${p.mode.toUpperCase()}` : ""}`,
        text: [name, p.reference, p.note, p.mode, String(p.amount)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    }
    return items;
  }, [data]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return { contacts: [], credits: [], payments: [], flat: [] as SearchItem[] };
    const hit = index.filter((it) => it.text.includes(needle));
    const contacts = hit.filter((i) => i.kind === "contact").slice(0, 8);
    const credits = hit.filter((i) => i.kind === "credit").slice(0, 6);
    const payments = hit.filter((i) => i.kind === "payment").slice(0, 6);
    return { contacts, credits, payments, flat: [...contacts, ...credits, ...payments] };
  }, [index, q]);

  // Global shortcuts: Ctrl/⌘-K opens, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setSel(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setQ("");
  }, [open]);
  useEffect(() => setSel(0), [q]);

  const openResult = (it: SearchItem) => {
    if (q.trim()) saveRecent(q.trim());
    setOpen(false);
    router.push(
      it.kind === "contact"
        ? `/vyora/parties/${it.partyId}`
        : `/vyora/parties/${it.partyId}?highlight=${it.id}`
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const flat = results.flat;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[sel]) openResult(flat[sel]);
    }
  };

  const Row = ({ it, idx }: { it: SearchItem; idx: number }) => (
    <button
      type="button"
      onClick={() => openResult(it)}
      onMouseEnter={() => setSel(idx)}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left",
        idx === sel ? "bg-brand-50" : "hover:bg-gray-50"
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-800">{it.title}</div>
        <div className="truncate text-xs text-gray-500">{it.subtitle}</div>
      </div>
    </button>
  );

  return (
    <>
      {showBar && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search everything"
          className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <span aria-hidden>🔍</span>
          <span className="flex-1 text-left">Search customers, entries, amounts…</span>
          <kbd className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 sm:inline">
            Ctrl K
          </kbd>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-center bg-black/40 px-4 pt-16 print:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Global search"
            className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span aria-hidden className="text-gray-500">
                🔍
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search name, phone, reference, amount…"
                aria-label="Search"
                className="w-full bg-transparent text-base outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="rounded px-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Esc
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!q.trim() ? (
                recent.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    Type to search customers, credits, payments…
                  </p>
                ) : (
                  <div>
                    <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Recent searches
                    </div>
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setQ(r)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span aria-hidden className="text-gray-500">
                          ↺
                        </span>
                        {r}
                      </button>
                    ))}
                  </div>
                )
              ) : results.flat.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">
                  No matches for “{q.trim()}”.
                </p>
              ) : (
                <div className="pb-2">
                  {results.contacts.length > 0 && (
                    <Group title="Contacts">
                      {results.contacts.map((it, i) => (
                        <Row key={it.id} it={it} idx={i} />
                      ))}
                    </Group>
                  )}
                  {results.credits.length > 0 && (
                    <Group title="Credits">
                      {results.credits.map((it, i) => (
                        <Row key={it.id} it={it} idx={results.contacts.length + i} />
                      ))}
                    </Group>
                  )}
                  {results.payments.length > 0 && (
                    <Group title="Payments">
                      {results.payments.map((it, i) => (
                        <Row
                          key={it.id}
                          it={it}
                          idx={results.contacts.length + results.credits.length + i}
                        />
                      ))}
                    </Group>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      {children}
    </div>
  );
}

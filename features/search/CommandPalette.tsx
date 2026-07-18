"use client";

/**
 * Global command palette — the site-wide search surface (PLATFORM-006).
 *
 * Opens on ⌘K / Ctrl+K (or the header search button, via a window event) on **every** page, because
 * it is mounted once in the root layout. It searches the whole registry through `lib/search/toolSearch`
 * (so a new tool is instantly searchable with zero code here), and when empty it surfaces recent tools,
 * popular tools, and category browsing. Fully keyboard-operable and screen-reader friendly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPopularTools, getLiveCategories } from "@/registry";
import { searchToolList } from "@/lib/search/toolSearch";
import { readStore } from "@/lib/localFinance";

/** Custom event any button can dispatch to open the palette (e.g. the header search button). */
export const OPEN_SEARCH_EVENT = "esytol:open-search";

interface Item {
  key: string;
  href: string;
  label: string;
  icon: string;
  hint: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The element focused before opening, so focus can return to it on close (a11y).
  const opener = useRef<HTMLElement | null>(null);

  // Open on ⌘K / Ctrl+K anywhere, and on the header button's custom event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  // On open: reset, remember the opener, focus the input, and load recent tools from local storage.
  useEffect(() => {
    if (!open) return;
    opener.current = (document.activeElement as HTMLElement) ?? null;
    setQuery("");
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const recents = readStore().recentTools.slice(0, 5);
    setRecent(
      recents.map((r) => ({
        key: `recent:${r.slug}`,
        href: `/tools/${r.slug}`,
        label: r.name,
        icon: "🕘",
        hint: "Recent",
      }))
    );
    // Lock body scroll while the dialog is open.
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  const items: Item[] = useMemo(() => {
    const q = query.trim();
    if (q !== "") {
      return searchToolList(q, 8).map((t) => ({
        key: `result:${t.slug}`,
        href: t.url,
        label: t.name,
        icon: t.icon,
        hint: "Tool",
      }));
    }
    const popular: Item[] = getPopularTools()
      .slice(0, 5)
      .map((t) => ({
        key: `popular:${t.slug}`,
        href: t.url,
        label: t.name,
        icon: t.icon,
        hint: "Popular",
      }));
    const cats: Item[] = getLiveCategories().map((c) => ({
      key: `cat:${c.slug}`,
      href: `/categories/${c.slug}`,
      label: `${c.name} tools`,
      icon: c.icon,
      hint: "Category",
    }));
    // Recents first (most relevant to a returning user), then popular, then browse-by-category.
    const seen = new Set<string>();
    return [...recent, ...popular, ...cats].filter((i) => {
      if (seen.has(i.href)) return false;
      seen.add(i.href);
      return true;
    });
  }, [query, recent]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to whatever opened the palette (keyboard users don't lose their place).
    if (typeof opener.current?.focus === "function") opener.current.focus();
  }, []);
  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      router.push(item.href);
    },
    [close, router]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  };

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (typeof el?.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-gray-900/40 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <span aria-hidden="true" className="text-gray-400">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[active] ? `cmd-opt-${active}` : undefined}
            aria-label="Search tools"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search tools, categories, tasks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 bg-transparent py-4 text-base text-gray-900 outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline">
            Esc
          </kbd>
        </div>

        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-gray-400" role="status">
              No tools match “{query.trim()}”. Try a different term.
            </li>
          ) : (
            items.map((item, i) => (
              <li key={item.key}>
                <button
                  type="button"
                  id={`cmd-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    i === active ? "bg-brand-600 text-white" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span aria-hidden="true" className="text-base">
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wide ${
                      i === active ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {item.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          <span>
            <kbd className="font-sans">↑↓</kbd> navigate · <kbd className="font-sans">↵</kbd> open
          </span>
          <span>Search runs entirely in your browser</span>
        </div>
      </div>
    </div>
  );
}

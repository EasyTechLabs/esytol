"use client";

/**
 * Header search button that opens the global command palette (PLATFORM-006).
 *
 * It is decoupled from the palette: clicking it dispatches a window event the palette listens for,
 * so there is no shared context to thread through the layout. Shows the ⌘K hint on desktop and a
 * compact icon button on mobile.
 */

import { OPEN_SEARCH_EVENT } from "./CommandPalette";

export function SearchTrigger() {
  const open = () => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT));

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search tools (Ctrl or Cmd + K)"
      aria-keyshortcuts="Control+K Meta+K"
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-500 transition hover:border-gray-300 hover:text-gray-700 sm:min-w-[13rem] sm:justify-between"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">🔍</span>
        <span className="hidden sm:inline">Search tools…</span>
      </span>
      <kbd className="hidden rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

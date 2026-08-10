"use client";

import { useVyora } from "./VyoraProvider";

/**
 * Shown when this tab cannot write.
 *
 * That happens on one specific combination: a browser with no `navigator.locks`,
 * and Vyora already open in another tab. There is no way to make two tabs write
 * safely without a same-origin lock, so one tab holds the claim and the rest say
 * so plainly. A merchant filling in an entry that silently could not be saved —
 * or worse, one that overwrote the other tab's work — is the outcome this
 * prevents, and it is worth a visible banner rather than a toast they might miss.
 *
 * Every current browser engine has Web Locks, so in practice this is rare. Being
 * rare is not a reason to leave it unsaid.
 */
export function ReadOnlyTabNotice() {
  const { ready, writable } = useVyora();
  if (!ready || writable) return null;

  return (
    <div
      role="status"
      className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">This tab is read-only</p>
      <p className="mt-1">
        Vyora is already open in another tab, and this browser cannot keep two tabs from overwriting
        each other. Record entries in the other tab — or close it, then reload this page.
      </p>
    </div>
  );
}

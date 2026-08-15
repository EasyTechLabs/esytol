/**
 * What the merchant is told about syncing, and how little that is.
 *
 * Four states, four sentences. A merchant needs to know whether their book is
 * safe elsewhere and whether anything needs them — not how it got that way.
 * Nothing here says cursor, event log, outbox, device or IndexedDB, and the
 * pending count is described as "waiting to send" rather than as a queue depth.
 *
 * The failure wording is the part worth being careful about. "Offline" is not
 * an error and must not look like one: the merchant's work is recorded, it is
 * on this device, and it will go when there is a connection. Only
 * `needs-attention` asks anything of them.
 */

"use client";

import type { SyncState } from "@/lib/vyora/sync/engine";

export type SyncTone = "synced" | "syncing" | "offline" | "needs-attention" | "signed-out";

export function toneFor(state: SyncState): SyncTone {
  switch (state) {
    case "pushing":
    case "pulling":
      return "syncing";
    case "offline":
    case "retry-wait":
      return "offline";
    case "error":
      return "needs-attention";
    case "auth-required":
      return "signed-out";
    default:
      return "synced";
  }
}

/** One sentence per tone. Written for the person, not the protocol. */
export function describeSync(tone: SyncTone, pending: number): string {
  switch (tone) {
    case "syncing":
      return "Saving to your other devices…";
    case "offline":
      return pending === 1
        ? "Saved on this device. 1 entry will send when you are back online."
        : `Saved on this device. ${pending} entries will send when you are back online.`;
    case "needs-attention":
      return "Some entries could not be sent. Update Vyora and try again.";
    case "signed-out":
      return "Sign in to keep your devices up to date.";
    default:
      return pending > 0 ? "Saving…" : "Up to date on all your devices.";
  }
}

const MARK: Record<SyncTone, string> = {
  synced: "✓",
  syncing: "⟳",
  offline: "⚠",
  "needs-attention": "⚠",
  "signed-out": "⚠",
};

export interface SyncStatusProps {
  readonly state: SyncState;
  readonly pending: number;
  readonly onSync?: () => void;
}

export function SyncStatus({ state, pending, onSync }: SyncStatusProps) {
  const tone = toneFor(state);
  const label = describeSync(tone, pending);

  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-testid="vyora-sync-status"
      data-tone={tone}
      // Polite, not assertive: a sync finishing must never interrupt someone
      // typing an amount.
      aria-live="polite"
    >
      <span aria-hidden="true">{MARK[tone]}</span>
      <span>{label}</span>
      {onSync && tone !== "syncing" ? (
        <button type="button" onClick={onSync} className="underline">
          Sync now
        </button>
      ) : null}
    </div>
  );
}

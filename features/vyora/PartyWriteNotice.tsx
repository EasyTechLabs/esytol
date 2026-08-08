"use client";

/**
 * Developer-visible notice for the development Party write path.
 *
 * Renders **nothing** on the default path — local target, no error — so the
 * merchant's screen is byte-identical to before this milestone.
 *
 * Wording is deliberately technical and prefixed `DEV:`. A merchant must never
 * be shown "API unavailable" about their own ledger: on the default path their
 * write went to the device and succeeded, and on the development path there is
 * no merchant present.
 */

import type { PartySourceKind } from "@/lib/vyora/party-source";

export function PartyWriteNotice({
  target,
  error,
  conflict,
  pending,
  onDismiss,
}: {
  target: PartySourceKind;
  error: string | null;
  conflict: boolean;
  pending?: boolean;
  onDismiss?: () => void;
}) {
  if (target === "local" && !error) return null;

  if (error) {
    // A conflict is a different situation from an outage and deserves different
    // wording: the server is fine, and this client is simply behind.
    const title = conflict
      ? "DEV: write rejected — the server record is newer."
      : "DEV: Party API write failed. Nothing was saved.";
    const advice = conflict
      ? "Re-read the party to get its current version, then apply the change again. The server was not overwritten."
      : "Nothing was written locally either — this write went nowhere. Fix the cause and retry.";

    return (
      <div
        role="alert"
        data-testid="party-write-notice"
        className={`rounded-xl border px-3 py-2 text-xs ${
          conflict
            ? "border-orange-300 bg-orange-50 text-orange-900"
            : "border-red-300 bg-red-50 text-red-900"
        }`}
      >
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 break-words font-mono text-[11px] opacity-80">{error}</div>
        <div className="mt-1 opacity-80">{advice}</div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={pending}
            className="mt-1.5 rounded-lg border border-current px-2 py-1 font-semibold disabled:opacity-50"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="party-write-notice"
      className="rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs text-violet-900"
    >
      <span className="font-semibold">DEV: Party writes go to the local API.</span>{" "}
      <span className="opacity-80">
        Nothing is written to this device while this is on. No dual writes.
      </span>
    </div>
  );
}

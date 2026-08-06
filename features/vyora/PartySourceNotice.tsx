"use client";

/**
 * Developer-visible notice for the development Party API.
 *
 * Renders **nothing** unless the remote source is actually in play, so the
 * merchant's screen is byte-identical to before whenever the flag is off —
 * which is always, by default.
 *
 * The wording is deliberately technical. This is not a merchant-facing message
 * and must never read like one: a merchant who sees "API unavailable" on their
 * ledger has been told their book is broken, which would be false.
 */

import type { PartySourceKind } from "@/lib/vyora/party-source";

export function PartySourceNotice({
  source,
  error,
  loading,
  onRetry,
}: {
  source: PartySourceKind;
  error: string | null;
  loading?: boolean;
  onRetry?: () => void;
}) {
  // Nothing to say when the app is behaving normally.
  if (source === "local" && !error) return null;

  if (error) {
    return (
      <div
        role="status"
        data-testid="party-source-notice"
        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      >
        <div className="font-semibold">DEV: Party API read failed — showing local data.</div>
        <div className="mt-0.5 break-words font-mono text-[11px] opacity-80">{error}</div>
        <div className="mt-1 opacity-80">Your local ledger is unchanged. Nothing was written.</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="mt-1.5 rounded-lg border border-amber-400 px-2 py-1 font-semibold disabled:opacity-50"
          >
            {loading ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="party-source-notice"
      className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900"
    >
      <span className="font-semibold">DEV: reading parties from the local API.</span>{" "}
      <span className="opacity-80">Read-only. Local data is not modified.</span>
    </div>
  );
}

"use client";

/**
 * Developer-only ledger summary panel, shown on a party's statement.
 *
 * Read-only, and shown only when the summary actually came from the API. There
 * is no local fallback here on purpose: the statement above it already falls
 * back, and a summary that quietly swapped source would put device totals and
 * server totals under the same heading with nothing to distinguish them.
 *
 * Renders **nothing** when the remote path is off or the call failed.
 */

import type { RemoteSummary } from "@/lib/vyora/ledger-source";
import { formatMoney } from "@/lib/vyora/format";

export function DevLedgerSummary({
  summary,
  loading,
  error,
}: {
  summary: RemoteSummary | null;
  loading: boolean;
  error: string | null;
}) {
  if (!summary) {
    // Only speak up if a request was actually attempted and failed — otherwise
    // the panel does not exist at all.
    if (error) {
      return (
        <div
          data-testid="dev-ledger-summary-error"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <div className="font-semibold">DEV: ledger summary unavailable.</div>
          <div className="mt-0.5 break-words font-mono text-[11px] opacity-80">{error}</div>
          <div className="mt-1 opacity-80">
            No totals are shown rather than device totals under a server heading.
          </div>
        </div>
      );
    }
    return null;
  }

  const { totals, counts, balance } = summary;

  return (
    <div
      data-testid="dev-ledger-summary"
      className="space-y-2 rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">DEV: ledger summary from the local API.</span>
        {loading && <span className="opacity-70">refreshing…</span>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="opacity-80">Credit given</dt>
        <dd className="text-right font-mono">{formatMoney(totals.creditGiven)}</dd>
        <dt className="opacity-80">Credit taken</dt>
        <dd className="text-right font-mono">{formatMoney(totals.creditTaken)}</dd>
        <dt className="opacity-80">Payments received</dt>
        <dd className="text-right font-mono">{formatMoney(totals.paymentReceived)}</dd>
        <dt className="opacity-80">Payments made</dt>
        <dd className="text-right font-mono">{formatMoney(totals.paymentPaid)}</dd>
      </dl>

      <div className="flex items-center justify-between border-t border-sky-200 pt-1.5 font-semibold">
        <span>Net</span>
        <span className="font-mono" data-testid="dev-summary-net">
          {formatMoney(balance.net)}
        </span>
      </div>

      <div className="opacity-80">
        {counts.credits} credit{counts.credits === 1 ? "" : "s"}, {counts.payments} payment
        {counts.payments === 1 ? "" : "s"} · position {balance.position}
      </div>
      <div className="opacity-70">
        Gross totals sit beside the net deliberately — &ldquo;given{" "}
        {formatMoney(totals.creditGiven)}, paid back {formatMoney(totals.paymentReceived)}&rdquo; is
        a different fact from the balance.
      </div>
    </div>
  );
}

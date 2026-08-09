"use client";

/**
 * Vyora Alpha — Party statement. The full, dispute-settling history for one
 * party: every credit and payment, a running balance, and the outstanding at
 * top. "Print / Save as PDF" uses the browser's print dialog (the shareable-PDF
 * placeholder for Alpha — no PDF engine yet).
 */

import { useVyora } from "../VyoraProvider";
import { todayISO } from "@/lib/vyora/selectors";
import { isOverdue, remainingLabel } from "@/lib/vyora/duedates";
import { formatMoney, formatDate, balanceLabel, balanceColor } from "@/lib/vyora/format";
import { Empty } from "../components";
import { usePartyDetail } from "../usePartySource";
import { PartySourceNotice } from "../PartySourceNotice";
import {
  useStatement,
  useCreditWriter,
  usePaymentWriter,
  usePartySummary,
} from "../useLedgerSource";
import { DevRecordCredit } from "../DevRecordCredit";
import { DevRecordPayment } from "../DevRecordPayment";
import { DevLedgerSummary } from "../DevLedgerSummary";

export function PartyStatement({ partyId }: { partyId: string }) {
  const { ready, ledger, dispatch } = useVyora();

  // Header identity comes from the party source; the statement rows and the
  // outstanding come from the ledger source. Both default to local and both
  // fall back to local on failure.
  const { party, net: partyNet, source, error, loading, retry } = usePartyDetail(partyId);
  const statement = useStatement(partyId, party?.name ?? "");
  const creditWriter = useCreditWriter();
  const paymentWriter = usePaymentWriter();
  const summary = usePartySummary(partyId);

  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!party) return <Empty title="Party not found" subtitle="It may have been cleared." />;

  const rows = statement.rows;
  // When the statement came from the API its balance is the folded total of the
  // rows on screen, so it is the one that matches what the merchant can see.
  const net = statement.source === "remote" ? statement.net : partyNet;
  const today = todayISO();

  // Due dates live on the transaction, not the statement row — read them off
  // the existing transaction index rather than recomputing anything.
  const dueDates = new Map<string, string>();
  for (const t of ledger.transactions.transactionsByParty.get(partyId) ?? []) {
    if (t.dueDate) dueDates.set(t.id, t.dueDate);
  }

  return (
    <div className="space-y-4">
      {/* Renders nothing unless a developer enabled the API read path. */}
      <PartySourceNotice source={source} error={error} loading={loading} onRetry={retry} />
      {/* Ledger source notice — renders nothing unless remote statements are on. */}
      <PartySourceNotice
        source={statement.source}
        error={statement.error}
        loading={statement.loading}
        onRetry={statement.reload}
      />

      {/* Developer-only credit recording. Renders nothing by default. */}
      <DevRecordCredit
        target={creditWriter.target}
        pending={creditWriter.pending}
        error={creditWriter.error}
        onDismissError={creditWriter.clearError}
        onRecord={async (input) => {
          const ok = await creditWriter.recordCredit(partyId, input);
          // The entry landed in the API, so re-read the statement to show it.
          if (ok) {
            statement.reload();
            summary.reload();
          }
          return ok;
        }}
      />

      {/* Developer-only payment recording. Renders nothing by default. */}
      <DevRecordPayment
        target={paymentWriter.target}
        pending={paymentWriter.pending}
        error={paymentWriter.error}
        onDismissError={paymentWriter.clearError}
        onRecord={async (input) => {
          const ok = await paymentWriter.recordPayment(partyId, input);
          if (ok) {
            statement.reload();
            summary.reload();
          }
          return ok;
        }}
      />

      {/* Developer-only totals. Renders nothing unless the API answered. */}
      <DevLedgerSummary summary={summary.summary} loading={summary.loading} error={summary.error} />

      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{party.name}</h1>
            {party.phone && <p className="text-sm text-gray-500">{party.phone}</p>}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden"
          >
            🖨 Print / PDF
          </button>
        </div>
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{balanceLabel(net)}</div>
          <div
            className={`break-words text-3xl font-bold tabular-nums leading-tight ${balanceColor(net)}`}
          >
            {net === 0 ? "Settled" : formatMoney(net)}
          </div>
        </div>
      </div>

      {/* Statement */}
      {rows.length === 0 ? (
        <Empty title="No entries for this party yet" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Entry</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Balance</span>
            <span className="print:hidden" />
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{r.label}</div>
                  <div className="text-xs text-gray-400">
                    Issued {formatDate(r.date)}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                  {dueDates.get(r.id) && (
                    <div
                      className={`text-xs font-medium ${
                        isOverdue(dueDates.get(r.id) as string, today)
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      Due {formatDate(dueDates.get(r.id) as string)} ·{" "}
                      {remainingLabel(dueDates.get(r.id) as string, today)}
                    </div>
                  )}
                </div>
                <div
                  className={`text-right text-sm font-semibold tabular-nums ${balanceColor(r.signedAmount)}`}
                >
                  {r.signedAmount > 0 ? "+" : "−"}
                  {formatMoney(r.amount)}
                </div>
                <div className={`text-right text-sm tabular-nums ${balanceColor(r.runningNet)}`}>
                  {formatMoney(r.runningNet)}
                </div>
                <button
                  type="button"
                  aria-label="Delete entry"
                  onClick={() => {
                    if (confirm(`Delete this entry (${r.label})?`))
                      dispatch({ type: "DeleteEntry", entryId: r.id });
                  }}
                  className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 print:hidden"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 text-xs text-gray-400">
        Positive = they owe you · Negative = you owe them · Balance is the running outstanding after
        each entry.
      </p>
    </div>
  );
}

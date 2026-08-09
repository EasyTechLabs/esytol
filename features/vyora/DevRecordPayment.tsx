"use client";

/**
 * Developer-only "record a payment" affordance, shown on a party's statement.
 *
 * Separate from `DevRecordCredit` for the same reason the hooks are separate:
 * they post to different endpoints and mint different events, and one combined
 * form with a four-way direction selector is how `given` eventually gets sent
 * to the payments route.
 *
 * It also stays out of the existing `PaymentEntry` screen deliberately. That
 * screen resolves a *contact name* and applies the merchant's local settlement
 * flow; the API takes an existing *party id* and settles nothing in particular.
 * Reshaping it to serve both would change the default merchant path.
 *
 * Renders **nothing** unless remote ledger writes are enabled.
 */

import { useState } from "react";
import type { PartySourceKind } from "@/lib/vyora/party-source";
import type { RecordPaymentInput } from "@/lib/vyora/ledger-source";

export function DevRecordPayment({
  target,
  pending,
  error,
  onRecord,
  onDismissError,
}: {
  target: PartySourceKind;
  pending: boolean;
  error: string | null;
  onRecord: (input: RecordPaymentInput) => Promise<boolean>;
  onDismissError: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"received" | "paid">("received");

  if (target !== "remote") return null;

  const submit = async () => {
    const value = Number.parseInt(amount, 10);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await onRecord({
      amount: value,
      kind,
      date: new Date().toISOString().slice(0, 10),
    });
    // Retained on failure so nothing typed is lost.
    if (ok) setAmount("");
  };

  return (
    <div
      data-testid="dev-record-payment"
      className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900"
    >
      <div className="font-semibold">DEV: record a payment through the local API.</div>
      <div className="opacity-80">
        Moves the running balance. It does not settle any particular entry.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          inputMode="numeric"
          aria-label="Payment amount"
          className="w-28 rounded-lg border border-emerald-300 px-2 py-1"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "received" | "paid")}
          aria-label="Payment direction"
          className="rounded-lg border border-emerald-300 px-2 py-1"
        >
          <option value="received">received — they paid you</option>
          <option value="paid">paid — you paid them</option>
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !amount.trim()}
          className="rounded-lg border border-emerald-400 px-2 py-1 font-semibold disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record payment"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="dev-payment-error"
          className="rounded-lg border border-red-300 bg-red-50 p-2 text-red-900"
        >
          <div className="font-semibold">Write failed. Nothing was saved.</div>
          <div className="mt-0.5 break-words font-mono text-[11px] opacity-80">{error}</div>
          <div className="mt-1 opacity-80">
            Nothing was written locally either — this payment went nowhere. Fix the cause and retry.
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="mt-1.5 rounded border border-current px-2 py-0.5 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Developer-only "record a credit" affordance, shown on a party's statement.
 *
 * It lives here rather than in the existing `CreditEntry` screen on purpose.
 * The local flow takes a *contact name* and creates the party if it does not
 * exist; the API takes an existing *party id*. Reshaping `CreditEntry` to serve
 * both would change the default merchant path, and the requirement is that the
 * local credit flow stays exactly as it is. So the remote path gets its own
 * surface, on the one screen that already knows which party it is looking at.
 *
 * Renders **nothing** unless remote ledger writes are enabled, so the merchant's
 * statement screen is byte-identical to before.
 */

import { useState } from "react";
import type { PartySourceKind } from "@/lib/vyora/party-source";
import type { RecordCreditInput } from "@/lib/vyora/ledger-source";

export function DevRecordCredit({
  target,
  pending,
  error,
  onRecord,
  onDismissError,
}: {
  target: PartySourceKind;
  pending: boolean;
  error: string | null;
  onRecord: (input: RecordCreditInput) => Promise<boolean>;
  onDismissError: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"given" | "taken">("given");

  if (target !== "remote") return null;

  const submit = async () => {
    const value = Number.parseInt(amount, 10);
    if (!Number.isFinite(value) || value <= 0) return;
    const ok = await onRecord({
      amount: value,
      kind,
      date: new Date().toISOString().slice(0, 10),
    });
    // Input is retained on failure so nothing typed is lost; cleared only when
    // the entry actually reached the API.
    if (ok) setAmount("");
  };

  return (
    <div
      data-testid="dev-record-credit"
      className="space-y-2 rounded-xl border border-violet-300 bg-violet-50 p-3 text-xs text-violet-900"
    >
      <div className="font-semibold">DEV: record a credit through the local API.</div>
      <div className="opacity-80">
        Appends an immutable event. Nothing is written to this device.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          inputMode="numeric"
          aria-label="Credit amount"
          className="w-28 rounded-lg border border-violet-300 px-2 py-1"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "given" | "taken")}
          aria-label="Direction"
          className="rounded-lg border border-violet-300 px-2 py-1"
        >
          <option value="given">given — they owe you</option>
          <option value="taken">taken — you owe them</option>
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !amount.trim()}
          className="rounded-lg border border-violet-400 px-2 py-1 font-semibold disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record credit"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="dev-credit-error"
          className="rounded-lg border border-red-300 bg-red-50 p-2 text-red-900"
        >
          <div className="font-semibold">Write failed. Nothing was saved.</div>
          <div className="mt-0.5 break-words font-mono text-[11px] opacity-80">{error}</div>
          <div className="mt-1 opacity-80">
            Nothing was written locally either — this entry went nowhere. Fix the cause and retry.
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

"use client";

/**
 * Vyora — Payment entry. Records money received or paid; balances update
 * automatically (they're always derived from entries, never stored). Same fast
 * shape as credit entry, and since ARCH-004 the same explicit state machine.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaymentKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { paymentWorkflow } from "@/lib/vyora/workflow";
import { useWorkflow } from "../useWorkflow";
import { AmountField, PartyPicker, Segmented, BigButton } from "../components";

export function PaymentEntry() {
  const router = useRouter();
  const definition = useMemo(() => paymentWorkflow(todayISO()), []);
  const { draft, status, error, canSubmit, edit, submit } = useWorkflow(definition);
  // Presentation only — not part of the write, so not part of the machine.
  const [showMore, setShowMore] = useState(false);

  const save = () => {
    const result = submit();
    if (!result?.ok) return; // the machine is now in `failure`; the reason renders below
    router.push("/vyora");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Record payment</h1>

      <Segmented<PaymentKind>
        value={draft.kind}
        onChange={(kind) => edit({ kind })}
        options={[
          { value: "received", label: "They paid me", tone: "in" },
          { value: "paid", label: "I paid them", tone: "out" },
        ]}
      />

      <AmountField value={draft.amount} onChange={(amount) => edit({ amount })} />
      <PartyPicker value={draft.contactName} onChange={(contactName) => edit({ contactName })} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-600">Note (optional)</span>
        <input
          value={draft.note}
          onChange={(e) => edit({ note: e.target.value })}
          placeholder="e.g. UPI, cash"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
        />
      </label>

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-sm font-medium text-brand-700"
        >
          + Change date
        </button>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-600">Date</span>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => edit({ date: e.target.value })}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 outline-none focus:border-brand-500"
          />
        </label>
      )}

      {status === "failure" && error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error.message}
        </p>
      )}

      <div className="pt-2">
        <BigButton type="button" onClick={save} disabled={!canSubmit} tone="emerald">
          Save
        </BigButton>
      </div>
    </div>
  );
}

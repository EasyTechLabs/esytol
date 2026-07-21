"use client";

/**
 * Vyora Alpha — Payment entry. Records money received or paid; balances update
 * automatically (they're always derived from entries, never stored). Same fast
 * shape as credit entry.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVyora } from "../VyoraProvider";
import type { PaymentKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { AmountField, PartyPicker, Segmented, BigButton } from "../components";

export function PaymentEntry() {
  const router = useRouter();
  const { recordPayment } = useVyora();

  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("");
  const [kind, setKind] = useState<PaymentKind>("received"); // default: they paid me
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [date, setDate] = useState(todayISO());

  const amountNum = Number(amount);
  const canSave = amountNum > 0 && party.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    recordPayment({ partyName: party, amount: amountNum, kind, note: note || undefined, date });
    router.push("/vyora");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Record payment</h1>

      <Segmented<PaymentKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: "received", label: "They paid me", tone: "in" },
          { value: "paid", label: "I paid them", tone: "out" },
        ]}
      />

      <AmountField value={amount} onChange={setAmount} />
      <PartyPicker value={party} onChange={setParty} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-600">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 outline-none focus:border-brand-500"
          />
        </label>
      )}

      <div className="pt-2">
        <BigButton type="button" onClick={save} disabled={!canSave} tone="emerald">
          Save
        </BigButton>
      </div>
    </div>
  );
}

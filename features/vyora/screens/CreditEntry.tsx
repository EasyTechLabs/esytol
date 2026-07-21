"use client";

/**
 * Vyora Alpha — Credit entry. Fast (target under 10 s, ≤ 2 taps). Amount is
 * autofocused; the contact is bound by immutable id (existing) or explicitly
 * created (new) — never a silent duplicate. Save shows a confirmation toast with
 * Undo.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVyora } from "../VyoraProvider";
import type { EntryKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { AmountField, PartyPicker, Segmented, BigButton, type PartySelection } from "../components";

const emptyParty: PartySelection = { text: "", ref: null };

export function CreditEntry() {
  const router = useRouter();
  const { recordCredit } = useVyora();

  const [amount, setAmount] = useState("");
  const [party, setParty] = useState<PartySelection>(emptyParty);
  const [kind, setKind] = useState<EntryKind>("given"); // default: they owe me
  const [description, setDescription] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");

  const amountNum = Number(amount);
  const canSave = amountNum > 0 && party.ref !== null;

  const save = (again: boolean) => {
    if (!canSave || !party.ref) return;
    recordCredit({
      party: party.ref,
      amount: amountNum,
      kind,
      description: description || undefined,
      date,
      dueDate: dueDate || undefined,
    });
    if (again) {
      setAmount("");
      setParty(emptyParty);
      setDescription("");
      setDueDate("");
    } else {
      router.push("/vyora");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Record credit</h1>

      <Segmented<EntryKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: "given", label: "They owe me", tone: "in" },
          { value: "taken", label: "I owe them", tone: "out" },
        ]}
      />

      <AmountField value={amount} onChange={setAmount} />
      <PartyPicker value={party} onChange={setParty} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. cement, 2 bags"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
        />
      </label>

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-sm font-medium text-brand-700"
        >
          + Date / due date
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Due (optional)</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 outline-none focus:border-brand-500"
            />
          </label>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <BigButton type="button" onClick={() => save(false)} disabled={!canSave}>
          Save
        </BigButton>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={!canSave}
          className="w-full rounded-2xl border-2 border-gray-200 py-3 text-base font-semibold text-gray-700 disabled:opacity-50"
        >
          Save &amp; add another
        </button>
      </div>
    </div>
  );
}

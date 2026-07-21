"use client";

/**
 * Vyora Alpha — Payment entry. Records money received or paid; balances update
 * automatically. Same fast, id-bound shape as credit entry, with a save toast + Undo.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVyora } from "../VyoraProvider";
import type { PaymentKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { AmountField, PartyPicker, Segmented, BigButton, type PartySelection } from "../components";
import { TextInput } from "../primitives";

const emptyParty: PartySelection = { text: "", ref: null };

export function PaymentEntry() {
  const router = useRouter();
  const { recordPayment, data } = useVyora();

  const [amount, setAmount] = useState("");
  const [party, setParty] = useState<PartySelection>(emptyParty);
  const [kind, setKind] = useState<PaymentKind>("received"); // default: they paid me
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [prefilled, setPrefilled] = useState(false);

  // Pre-select the contact when arriving from a statement (…/payment?party=<id>).
  useEffect(() => {
    if (prefilled) return;
    const id = new URLSearchParams(window.location.search).get("party");
    if (!id) {
      setPrefilled(true);
      return;
    }
    const p = data.parties.find((x) => x.id === id);
    if (p) {
      setParty({ text: p.name, ref: { kind: "existing", id: p.id } });
      setPrefilled(true);
    }
  }, [data.parties, prefilled]);

  const amountNum = Number(amount);
  const canSave = amountNum > 0 && party.ref !== null;

  const save = () => {
    if (!canSave || !party.ref) return;
    recordPayment({ party: party.ref, amount: amountNum, kind, note: note || undefined, date });
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
        <span className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</span>
        <TextInput
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. UPI, cash"
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
          <span className="mb-1 block text-sm font-medium text-gray-700">Date</span>
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3"
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

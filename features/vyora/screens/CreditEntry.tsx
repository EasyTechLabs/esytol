"use client";

/**
 * Vyora Alpha — Credit entry. Fast (target under 10 s, ≤ 2 taps). Amount is
 * autofocused; the contact is bound by immutable id (existing) or explicitly
 * created (new) — never a silent duplicate. Save shows a confirmation toast with
 * Undo.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useVyora } from "../VyoraProvider";
import type { EntryKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { AmountField, PartyPicker, Segmented, BigButton, type PartySelection } from "../components";
import { TextInput, Button } from "../primitives";

const emptyParty: PartySelection = { text: "", ref: null };

export function CreditEntry() {
  const router = useRouter();
  const { recordCredit, data } = useVyora();

  const [amount, setAmount] = useState("");
  const [party, setParty] = useState<PartySelection>(emptyParty);
  const [kind, setKind] = useState<EntryKind>("given"); // default: they owe me
  const [description, setDescription] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // Pre-select the contact when arriving from a statement (…/credit?party=<id>).
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
        <TextInput
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. cement, 2 bags"
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
            <TextInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Due (optional)</span>
            <TextInput
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3"
            />
          </label>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <BigButton type="button" onClick={() => save(false)} disabled={!canSave}>
          Save
        </BigButton>
        <Button
          type="button"
          onClick={() => save(true)}
          disabled={!canSave}
          variant="secondary"
          block
          className="rounded-2xl"
        >
          Save &amp; add another
        </Button>
      </div>
    </div>
  );
}

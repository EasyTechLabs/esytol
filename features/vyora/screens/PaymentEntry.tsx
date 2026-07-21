"use client";

/**
 * Vyora — Fast Payment Entry (P0-003). Record money received: amount autofocused
 * (keyboard opens immediately), payment mode in one tap, optional reference.
 * Save returns to the contact's Statement, where the balance — and the dashboard,
 * recovery, and collect list — update instantly (no reload). When the balance
 * hits zero, the account shows as Settled.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useVyora } from "../VyoraProvider";
import type { PaymentKind, PaymentMode } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { AmountField, PartyPicker, Segmented, BigButton, type PartySelection } from "../components";
import { TextInput } from "../primitives";

const emptyParty: PartySelection = { text: "", ref: null };
const DRAFT_KEY = "vyora.draft.payment"; // crash-recovery: an unfinished payment survives a browser close

interface PaymentDraft {
  amount: string;
  party: PartySelection;
  kind: PaymentKind;
  mode: PaymentMode;
  reference: string;
  date: string;
  showMore: boolean;
}

const MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
];

export function PaymentEntry() {
  const router = useRouter();
  const { recordPayment, data } = useVyora();

  const [amount, setAmount] = useState("");
  const [party, setParty] = useState<PartySelection>(emptyParty);
  const [kind, setKind] = useState<PaymentKind>("received"); // default: they paid me
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [prefilled, setPrefilled] = useState(false);
  const [saving, setSaving] = useState(false); // prevent a double-tap double-save (P3-001)
  const [restored, setRestored] = useState(false); // a draft was recovered
  const [hydrated, setHydrated] = useState(false); // gate the draft-saver until restore has run

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

  // Crash recovery: on a fresh visit (no ?party deep-link) restore an unfinished draft.
  useEffect(() => {
    const hasParam = new URLSearchParams(window.location.search).get("party");
    if (!hasParam) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Partial<PaymentDraft>;
          if (d && typeof d.amount === "string" && d.amount.trim()) {
            setAmount(d.amount);
            if (d.party && typeof d.party === "object") setParty(d.party as PartySelection);
            if (d.kind === "received" || d.kind === "paid") setKind(d.kind);
            if (d.mode) setMode(d.mode);
            if (typeof d.reference === "string") setReference(d.reference);
            if (typeof d.date === "string" && d.date) setDate(d.date);
            if (d.showMore) setShowMore(true);
            setRestored(true);
          }
        }
      } catch {
        /* malformed draft — ignore */
      }
    }
    setHydrated(true);
  }, []);

  // Persist the in-progress payment after every change (only once hydrated, only if worth keeping).
  useEffect(() => {
    if (!hydrated || !amount.trim()) return;
    try {
      const draft: PaymentDraft = { amount, party, kind, mode, reference, date, showMore };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable — best effort */
    }
  }, [hydrated, amount, party, kind, mode, reference, date, showMore]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  const amountNum = Number(amount);
  const canSave = amountNum > 0 && party.ref !== null;

  const discardDraft = () => {
    setAmount("");
    setParty(emptyParty);
    setReference("");
    clearDraft();
    setRestored(false);
  };

  const save = () => {
    if (saving || !canSave || !party.ref) return;
    setSaving(true);
    const partyId = recordPayment({
      party: party.ref,
      amount: amountNum,
      kind,
      mode,
      reference: reference || undefined,
      date,
    });
    clearDraft();
    setRestored(false);
    // Save → return to Statement; balance + dashboard/recovery/collect update live.
    router.push(`/vyora/parties/${partyId}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Record payment</h1>

      {restored && (
        <div className="text-brand-800 flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
          <span>
            <span aria-hidden>↩</span> Restored your unsaved entry.
          </span>
          <button type="button" onClick={discardDraft} className="shrink-0 font-semibold underline">
            Discard
          </button>
        </div>
      )}

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

      {/* Payment mode — one tap */}
      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">Payment mode</span>
        <div className="grid grid-cols-4 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "rounded-xl py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                mode === m.value
                  ? "bg-brand-600 text-white"
                  : "border border-gray-200 bg-white text-gray-600"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reference — optional */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Reference</span>
        <TextInput
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="UPI ref / cheque no. (optional)"
        />
      </label>

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-sm font-medium text-brand-700"
        >
          ＋ Change date
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
        <BigButton type="button" onClick={save} disabled={!canSave || saving} tone="emerald">
          {saving ? "Saving…" : "Save"}
        </BigButton>
      </div>
    </div>
  );
}

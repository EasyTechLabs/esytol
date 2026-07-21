"use client";

/**
 * Vyora — Fast Credit Entry (P0-002). Record a credit sale in under 15 seconds:
 * the amount is autofocused (keyboard opens immediately), the date defaults to
 * today, and due date / reference / notes are optional and tucked out of the
 * fast path. Save returns to the contact's Statement, where outstanding — and
 * the dashboard, recovery, and collect list — update instantly, no reload.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVyora } from "../VyoraProvider";
import type { EntryKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { AmountField, PartyPicker, Segmented, BigButton, type PartySelection } from "../components";
import { TextInput, Button } from "../primitives";

const emptyParty: PartySelection = { text: "", ref: null };
const DRAFT_KEY = "vyora.draft.credit"; // crash-recovery: an unfinished entry survives a browser close

interface CreditDraft {
  amount: string;
  party: PartySelection;
  kind: EntryKind;
  reference: string;
  description: string;
  date: string;
  dueDate: string;
  showMore: boolean;
}

export function CreditEntry() {
  const router = useRouter();
  const { recordCredit, data, settings } = useVyora();

  const [amount, setAmount] = useState("");
  const [party, setParty] = useState<PartySelection>(emptyParty);
  const [kind, setKind] = useState<EntryKind>("given"); // default: they owe me (a credit sale)
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [dueTouched, setDueTouched] = useState(false); // user edited the due date
  const [showMore, setShowMore] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [saving, setSaving] = useState(false); // prevent a double-tap double-save (P3-001)
  const [restored, setRestored] = useState(false); // a draft was recovered
  const [hydrated, setHydrated] = useState(false); // gate the draft-saver until restore has run
  const restoredRef = useRef(false); // synchronous "a draft was restored" flag for the seeder

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

  // Crash recovery: on a fresh visit (no ?party deep-link) restore an unfinished draft.
  useEffect(() => {
    const hasParam = new URLSearchParams(window.location.search).get("party");
    if (!hasParam) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Partial<CreditDraft>;
          if (d && typeof d.amount === "string" && d.amount.trim()) {
            setAmount(d.amount);
            if (d.party && typeof d.party === "object") setParty(d.party as PartySelection);
            if (d.kind === "given" || d.kind === "taken") setKind(d.kind);
            if (typeof d.reference === "string") setReference(d.reference);
            if (typeof d.description === "string") setDescription(d.description);
            if (typeof d.date === "string" && d.date) setDate(d.date);
            if (typeof d.dueDate === "string") setDueDate(d.dueDate);
            if (d.showMore) setShowMore(true);
            restoredRef.current = true;
            setRestored(true);
          }
        }
      } catch {
        /* malformed draft — ignore */
      }
    }
    setHydrated(true);
  }, []);

  // Persist the in-progress entry after every change (only once hydrated, only if worth keeping).
  useEffect(() => {
    if (!hydrated || !amount.trim()) return;
    try {
      const draft: CreditDraft = {
        amount,
        party,
        kind,
        reference,
        description,
        date,
        dueDate,
        showMore,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable — best effort */
    }
  }, [hydrated, amount, party, kind, reference, description, date, dueDate, showMore]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  // Seed the due date from the merchant's "default credit days" (P3-002) — unless a
  // draft was restored or the merchant has already set one.
  useEffect(() => {
    if (restoredRef.current || dueTouched || dueDate) return;
    const days = settings.defaultCreditDays;
    if (days == null) return;
    const d = new Date(`${todayISO()}T00:00:00`);
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  }, [settings.defaultCreditDays, dueTouched, dueDate]);

  const amountNum = Number(amount);
  const canSave = amountNum > 0 && party.ref !== null;

  const resetForm = () => {
    setAmount("");
    setParty(emptyParty);
    setReference("");
    setDescription("");
    setDueDate("");
  };

  const discardDraft = () => {
    resetForm();
    clearDraft();
    setRestored(false);
  };

  const save = (again: boolean) => {
    if (saving || !canSave || !party.ref) return;
    setSaving(true);
    const partyId = recordCredit({
      party: party.ref,
      amount: amountNum,
      kind,
      reference: reference || undefined,
      description: description || undefined,
      date,
      dueDate: dueDate || undefined,
    });
    clearDraft();
    setRestored(false);
    if (again) {
      resetForm();
      setSaving(false);
    } else {
      // Save → return to Statement; outstanding + dashboard/recovery/collect update live.
      router.push(`/vyora/parties/${partyId}`);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Record credit</h1>

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

      {/* Optional details — kept out of the sub-15-second fast path */}
      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-sm font-medium text-brand-700"
        >
          ＋ Due date · reference · notes
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3">
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
              <span className="mb-1 block text-sm font-medium text-gray-700">Due date</span>
              <TextInput
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueTouched(true);
                }}
                className="px-3"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Reference</span>
            <TextInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bill / invoice no. (optional)"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Notes</span>
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. cement, 3 bags (optional)"
            />
          </label>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <BigButton type="button" onClick={() => save(false)} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save"}
        </BigButton>
        <Button
          type="button"
          onClick={() => save(true)}
          disabled={!canSave || saving}
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

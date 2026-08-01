"use client";

/**
 * Vyora — Credit entry. The speed-critical screen. Target: faster than a
 * notebook, under 10 seconds. Amount is autofocused; the party picker creates a
 * new party inline (no separate step); everything else has a sensible default.
 *
 * Since ARCH-004 the write is driven by an explicit state machine — the screen
 * holds no `isSaving` / `isValid` / `hasFailed` flags of its own, only the
 * workflow's status and the draft it carries.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EntryKind } from "@/lib/vyora/types";
import { todayISO } from "@/lib/vyora/selectors";
import { readPartyByName } from "@/lib/vyora/ledger";
import { creditWorkflow } from "@/lib/vyora/workflow";
import { CREDIT_PERIODS, addDays, periodLabel, previewDueDate } from "@/lib/vyora/duedates";
import { creditDaysFor } from "@/lib/vyora/settings";
import { useVyora } from "../VyoraProvider";
import { useWorkflow } from "../useWorkflow";
import { AmountField, PartyPicker, Segmented, BigButton } from "../components";

export function CreditEntry() {
  const router = useRouter();
  const today = todayISO();
  const definition = useMemo(() => creditWorkflow(today), [today]);
  const { draft, status, error, canSubmit, edit, submit, reset } = useWorkflow(definition);
  const { ledger, settings, updateSettings } = useVyora();
  // Presentation only — not part of the write, so not part of the machine.
  const [showMore, setShowMore] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  // The contact typed so far, if we already know them.
  const matched = readPartyByName(ledger, draft.contactName);
  const suggestedDays = creditDaysFor(settings, matched?.id);

  // Which chip is lit: whatever due date is on the draft right now.
  const activeDays = CREDIT_PERIODS.find((d) => addDays(today, d) === draft.dueDate);
  const preview = draft.dueDate ? previewDueDate(draft.dueDate) : null;

  const pickPeriod = (days: number) => {
    setCustomOpen(false);
    edit({ dueDate: addDays(today, days) });
    updateSettings({
      lastCreditDays: days,
      // Remember it for THIS contact too, so their habit sticks next time.
      ...(matched
        ? { contactCreditDays: { ...settings.contactCreditDays, [matched.id]: days } }
        : {}),
    });
  };

  const save = (again: boolean) => {
    const result = submit();
    if (!result?.ok) return; // the machine is now in `failure`; the reason renders below
    if (again) {
      reset();
      setCustomOpen(false);
    } else {
      router.push("/vyora");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Record credit</h1>

      <Segmented<EntryKind>
        value={draft.kind}
        onChange={(kind) => edit({ kind })}
        options={[
          { value: "given", label: "They owe me", tone: "in" },
          { value: "taken", label: "I owe them", tone: "out" },
        ]}
      />

      <AmountField value={draft.amount} onChange={(amount) => edit({ amount })} />
      <PartyPicker value={draft.contactName} onChange={(contactName) => edit({ contactName })} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-600">Note (optional)</span>
        <input
          value={draft.description}
          onChange={(e) => edit({ description: e.target.value })}
          placeholder="e.g. cement, 2 bags"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
        />
      </label>

      {/* One tap sets a due date. No calendar unless the merchant wants one. */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-600">Pay back in</span>
          {preview ? (
            <span className="text-xs font-semibold text-brand-700">
              Due {preview.short} · {preview.weekday}
            </span>
          ) : (
            <span className="text-xs text-gray-400">no due date</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {CREDIT_PERIODS.map((days) => {
            const active = activeDays === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => pickPeriod(days)}
                className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {periodLabel(days)}
                {!active && days === suggestedDays && !draft.dueDate ? " ·" : ""}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomOpen(!customOpen)}
            className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
              customOpen || (draft.dueDate && activeDays === undefined)
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            Custom
          </button>
          {draft.dueDate && (
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
                edit({ dueDate: "" });
              }}
              className="rounded-xl px-2 py-2 text-sm font-medium text-gray-400"
            >
              Clear
            </button>
          )}
        </div>
        {customOpen && (
          <input
            type="date"
            value={draft.dueDate}
            onChange={(e) => edit({ dueDate: e.target.value })}
            className="mt-2 w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-3 outline-none focus:border-brand-500"
          />
        )}
      </div>

      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-sm font-medium text-brand-700"
        >
          + Change entry date
        </button>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-600">Entry date</span>
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

      <div className="space-y-2 pt-2">
        <BigButton type="button" onClick={() => save(false)} disabled={!canSubmit}>
          Save
        </BigButton>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={!canSubmit}
          className="w-full rounded-2xl border-2 border-gray-200 py-3 text-base font-semibold text-gray-700 disabled:opacity-50"
        >
          Save &amp; add another
        </button>
      </div>
    </div>
  );
}

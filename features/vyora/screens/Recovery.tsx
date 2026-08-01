"use client";

/**
 * Vyora — Recovery Workspace (V2-001).
 *
 * One screen that answers everything a merchant needs before making a
 * collection call: **who · phone · outstanding · age · priority · last payment ·
 * last reminder · what to do next** — with the statement, the message and the
 * call history one tap away. No hopping between screens.
 *
 * The merchant sends the message from their own phone. Vyora contacts nobody.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { todayISO } from "@/lib/vyora/selectors";
import {
  REMINDER_TONES,
  buildBulkReminderMessage,
  buildRecoveryList,
  buildReminderMessage,
  recoveryTotals,
  statementPreview,
  type RecoveryItem,
  type ReminderTone,
} from "@/lib/vyora/recovery";
import { formatMoney, formatDate, balanceColor } from "@/lib/vyora/format";
import { Empty } from "../components";

function AgeChip({ item }: { item: RecoveryItem }) {
  if (item.daysOverdue > 0) {
    const tone =
      item.bucket === "60+"
        ? "bg-red-100 text-red-800"
        : item.bucket === "30-60"
          ? "bg-orange-100 text-orange-800"
          : "bg-amber-100 text-amber-800";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
        {item.daysOverdue}d overdue
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
      {item.daysOutstanding}d old
    </span>
  );
}

function PriorityBadge({ item }: { item: RecoveryItem }) {
  const tone =
    item.priority >= 70 ? "bg-red-600" : item.priority >= 45 ? "bg-amber-500" : "bg-gray-400";
  return (
    <span
      className={`rounded-lg px-2 py-0.5 text-[11px] font-bold text-white ${tone}`}
      title="40% outstanding · 30% age · 20% payment behaviour · 10% reminder recency"
    >
      {item.priority}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xs font-medium text-gray-700">{value}</div>
    </div>
  );
}

function ChaseRow({
  item,
  selecting,
  selected,
  onToggle,
}: {
  item: RecoveryItem;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const { dispatch, ledger } = useVyora();
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ReminderTone>("normal");
  const [note, setNote] = useState("");

  const message = useMemo(() => buildReminderMessage(item, { tone }), [item, tone]);
  const preview = useMemo(
    () => (open ? statementPreview(ledger, item.party.id) : []),
    [open, ledger, item.party.id]
  );

  const recordReminder = () => {
    dispatch({ type: "RecordReminder", contactId: item.party.id, tone });
  };

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ text: message });
      } else {
        await navigator.clipboard.writeText(message);
        setNote("Copied — paste it into WhatsApp or SMS.");
      }
      recordReminder();
    } catch {
      // Share sheet cancelled. Nothing was sent, so nothing is recorded —
      // "last reminder" must never claim a message the merchant didn't send.
      setNote("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setNote("Copied.");
      recordReminder();
    } catch {
      setNote("Could not copy. Select the message and copy it manually.");
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-white ${
        selected ? "border-brand-500 ring-2 ring-brand-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {selecting && (
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                aria-label={`Select ${item.party.name}`}
                className="h-5 w-5 accent-brand-600"
              />
            )}
            <PriorityBadge item={item} />
            <Link
              href={`/vyora/parties/${item.party.id}`}
              className="truncate text-base font-semibold text-gray-900"
            >
              {item.party.name}
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <AgeChip item={item} />
            {item.paymentHabit && (
              <span className="text-[11px] text-gray-500">· {item.paymentHabit}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums text-emerald-700">
            {formatMoney(item.outstanding)}
          </div>
          {item.phone ? (
            <a href={`tel:${item.phone}`} className="block text-xs font-medium text-brand-700">
              📞 {item.phone}
            </a>
          ) : (
            <span className="block text-xs text-gray-400">no phone</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-2.5">
        <Fact
          label="Last payment"
          value={
            item.lastPaymentAt && item.lastPaymentAmount
              ? `${formatMoney(item.lastPaymentAmount)} · ${formatDate(item.lastPaymentAt)}`
              : "never"
          }
        />
        <Fact
          label="Last reminder"
          value={item.lastRemindedAt ? formatDate(item.lastRemindedAt.slice(0, 10)) : "never"}
        />
      </div>

      <div className="border-t border-gray-100 px-4 py-2 text-xs font-medium text-gray-700">
        → {item.suggestedAction}
      </div>

      <div className="flex gap-2 border-t border-gray-100 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-xl border-2 border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700"
        >
          {open ? "Hide" : "Details"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex-1 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
        >
          Share reminder
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3">
          <section>
            <h3 className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
              Recent statement
            </h3>
            {preview.length === 0 ? (
              <p className="text-xs text-gray-500">No entries.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {preview.map((row) => (
                  <div key={row.id} className="flex justify-between gap-2 px-3 py-1.5 text-xs">
                    <span className="truncate text-gray-600">
                      {row.label} · {formatDate(row.date)}
                    </span>
                    <span className={`shrink-0 tabular-nums ${balanceColor(row.signedAmount)}`}>
                      {row.signedAmount > 0 ? "+" : "−"}
                      {formatMoney(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
              Suggested message
            </h3>
            <div className="mb-2 flex gap-2">
              {REMINDER_TONES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTone(option)}
                  className={`rounded-lg border-2 px-3 py-1 text-xs font-semibold capitalize ${
                    tone === option
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-sans text-sm text-gray-800">
              {message}
            </pre>
            <button
              type="button"
              onClick={copy}
              className="mt-1 text-sm font-medium text-brand-700"
            >
              Copy message
            </button>
            {note && <p className="mt-1 text-xs text-emerald-700">{note}</p>}
          </section>

          <section>
            <h3 className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
              Reminder history
            </h3>
            {item.reminderHistory.length === 0 ? (
              <p className="text-xs text-gray-500">Not contacted yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {[...item.reminderHistory].reverse().map((entry) => (
                  <li key={entry.at} className="text-xs text-gray-600">
                    {formatDate(entry.at.slice(0, 10))} · {entry.tone}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export function Recovery() {
  const { ready, ledger, events, dispatch } = useVyora();
  const today = todayISO();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);

  const items = useMemo(
    () => (ready ? buildRecoveryList(ledger, events, today) : []),
    [ready, ledger, events, today]
  );
  const totals = recoveryTotals(items);

  if (!ready) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white">
        <div className="text-xs font-medium uppercase tracking-wide text-amber-100">
          Overdue right now
        </div>
        <div className="mt-1 text-3xl font-bold tabular-nums leading-tight">
          {formatMoney(totals.overdueAmount)}
        </div>
        <div className="mt-1 text-sm text-amber-100">
          {totals.overdueCount} of {totals.totalCount} people past their due date ·{" "}
          {formatMoney(totals.pendingAmount)} pending in total
        </div>
      </div>

      {items.length === 0 ? (
        <Empty
          title="Nobody owes you right now"
          subtitle="When you record credit, whoever to chase first will appear here."
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-500">
              Ranked: 40% amount · 30% age · 20% behaviour · 10% reminder recency.
            </p>
            <button
              type="button"
              onClick={() => {
                // Leaving selection mode always clears the selection, so a
                // stale tick can never be shared by accident later.
                setSelected([]);
                setSelecting(!selecting);
              }}
              className="shrink-0 text-xs font-semibold text-brand-700"
            >
              {selecting ? "Cancel" : "Select"}
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <ChaseRow
                key={item.party.id}
                item={item}
                selecting={selecting}
                selected={selected.includes(item.party.id)}
                onToggle={() =>
                  setSelected((previous) =>
                    previous.includes(item.party.id)
                      ? previous.filter((id) => id !== item.party.id)
                      : [...previous, item.party.id]
                  )
                }
              />
            ))}
          </div>

          {selecting && selected.length > 0 && (
            <div className="fixed inset-x-0 bottom-[4.75rem] z-30 mx-auto w-full max-w-lg px-3">
              <button
                type="button"
                onClick={async () => {
                  const chosen = items.filter((i) => selected.includes(i.party.id));
                  const text = buildBulkReminderMessage(chosen);
                  const nav = navigator as Navigator & {
                    share?: (d: { text: string }) => Promise<void>;
                  };
                  try {
                    if (nav.share) await nav.share({ text });
                    else await navigator.clipboard.writeText(text);
                    // Only record reminders once the share actually went out.
                    for (const item of chosen) {
                      dispatch({
                        type: "RecordReminder",
                        contactId: item.party.id,
                        tone: "normal",
                      });
                    }
                    setSelected([]);
                    setSelecting(false);
                  } catch {
                    // Cancelled — nothing shared, so nothing recorded.
                  }
                }}
                className="w-full rounded-2xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-lg"
              >
                Share {selected.length} reminder{selected.length === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

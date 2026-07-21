"use client";

/**
 * Vyora — Collect ("Who to chase today"). The recovery worklist: overdue
 * receivables first, ranked by how much × how late, then open-but-not-yet-overdue
 * shown SEPARATELY (never mislabelled). Sharing a reminder is one tap and hands
 * off to the phone's own share sheet — Vyora sends nothing itself (no SMS API,
 * no WhatsApp API, no backend).
 */

import Link from "next/link";
import { useVyora } from "../VyoraProvider";
import { useToast } from "../Toast";
import { formatMoney } from "@/lib/vyora/format";
import { Card } from "../primitives";
import { PriorityBadge, LoadingList } from "../components";
import { useCollect } from "../useCollect";

function reminderText(name: string, amount: number): string {
  return (
    `Namaste ${name},\n` +
    `A gentle reminder about your account with our shop.\n` +
    `Outstanding: ${formatMoney(amount)}.\n` +
    `Kindly clear it at your convenience. Thank you.`
  );
}

export function Collect() {
  const { ready, data } = useVyora();
  const toast = useToast();
  const { overdue, open } = useCollect(data);

  if (!ready) return <LoadingList />;

  const nameOf = (id: string) => data.parties.find((p) => p.id === id)?.name ?? "Contact";

  // Share a reminder via the OS share sheet. The app transmits nothing itself.
  const share = async (partyId: string, amount: number) => {
    const text = reminderText(nameOf(partyId), amount);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: "Payment reminder", text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast.info("Copied — paste into WhatsApp to send");
      } else {
        toast.info("Sharing isn't supported on this device");
      }
    } catch {
      // User dismissed the share sheet — a no-op, by design.
    }
  };

  const overdueTotal = overdue.reduce((s, r) => s + r.overdueAmount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Who to chase today</h1>
        <p className="text-sm text-gray-500">
          Money owed to you, past its due date — the most worth chasing first.
        </p>
      </div>

      {overdue.length === 0 ? (
        <Card className="flex items-center gap-3 border-positive-line bg-positive-tint">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-positive text-lg font-bold text-white"
          >
            ✓
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-positive-strong">All caught up</p>
            <p className="text-sm text-gray-600">Nobody is overdue right now.</p>
          </div>
        </Card>
      ) : (
        <>
          <Card tone="danger">
            <div className="text-xs font-semibold uppercase tracking-wide text-negative-strong">
              Overdue total
            </div>
            <div className="break-words text-2xl font-bold tabular-nums leading-tight text-negative">
              {formatMoney(overdueTotal)}
            </div>
            <div className="text-xs text-gray-600">
              across {overdue.length} contact{overdue.length === 1 ? "" : "s"}
            </div>
          </Card>

          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {overdue.map((r) => (
              <div key={r.partyId} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={`/vyora/parties/${r.partyId}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-800">{nameOf(r.partyId)}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-lg bg-negative-tint px-1.5 py-0.5 text-xs font-semibold text-negative-strong">
                      Overdue {r.daysOverdue}d
                    </span>
                    {r.priority && <PriorityBadge priority={r.priority} />}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="font-semibold tabular-nums text-negative">
                      {formatMoney(r.overdueAmount)}
                    </div>
                    <div className="text-xs text-gray-500">of {formatMoney(r.openReceivable)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => share(r.partyId, r.openReceivable)}
                    aria-label={`Share a reminder with ${nameOf(r.partyId)}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-200 text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Open — owed but NOT overdue. Shown separately so nothing is called "overdue" unless it is. */}
      {open.length > 0 && (
        <section>
          <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Open · not yet overdue
          </h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {open.map((r) => (
              <Link
                key={r.partyId}
                href={`/vyora/parties/${r.partyId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800">{nameOf(r.partyId)}</div>
                  <span className="mt-1 inline-flex items-center rounded-lg bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                    {r.oldestOpenDays >= 0 ? `Open ${r.oldestOpenDays}d` : "Not due yet"}
                  </span>
                </div>
                <div className="shrink-0 font-semibold tabular-nums text-positive">
                  {formatMoney(r.openReceivable)}
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-gray-500">
            Owed to you but not past a due date — never counted as “overdue”.
          </p>
        </section>
      )}
    </div>
  );
}

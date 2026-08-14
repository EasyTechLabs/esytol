"use client";

/**
 * Vyora — Item lists.
 *
 * What somebody asked for, what the shop says it comes to, and how it ended.
 *
 * ## A list is not a debt
 *
 * Nothing on this page is a balance. A customer who owes ₹5,000 and sends a
 * ₹700 list still owes ₹5,000. The two endings say what actually happened:
 *
 * - **credit** — a request the other side still has to accept. Only that
 *   acceptance puts anything in a book.
 * - **paid outside Vyora** — a receipt. It moves no balance, and every place
 *   one appears carries the disclaimer, because Vyora saw no money. Two people
 *   tapped a button.
 *
 * ## Active shop, always
 *
 * The shop list is not parameterised by shop. It resolves to the shop this
 * person has selected, held on the server, so a browser cannot read or answer
 * another shop's list by editing a URL.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  AGREE_EXPLANATION,
  CREDIT_EXPLANATION,
  SETTLED_DISCLAIMER,
  SETTLE_EXPLANATION,
  canAgree,
  canCancel,
  canChooseOutcome,
  canPrice,
  describeChanges,
  describeLine,
  describeMethod,
  isShopsOwn,
  splitSided,
  type PresentedQuote,
  type SidedQuote,
} from "@/lib/vyora/quotes";
import { explainRefusal } from "@/lib/vyora/proposals";
import { shopClient, type QuoteLineInput, type SettlementMethod } from "@/lib/vyora/shop-client";

const UNREACHABLE =
  "Vyora needs a connection to show item lists. Your book still works — this list does not.";

const METHODS: readonly SettlementMethod[] = ["cash", "upi", "bank_transfer", "other"];

const money = (rupees: number) => `₹${rupees.toLocaleString("en-IN")}`;

export function Quotes() {
  const [rows, setRows] = useState<readonly SidedQuote[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState<string | null>(null);
  const [pricing, setPricing] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [shopSide, mySide] = await Promise.all([
      shopClient.listQuotes(),
      shopClient.listMyQuotes(),
    ]);

    // A shop list refused is not an error — it is somebody with no shop of
    // their own. Their customer side still loads, and that is the page they
    // should get.
    const failure =
      shopSide.kind === "unreachable" ? shopSide : mySide.kind !== "ok" ? mySide : null;
    if (failure !== null) {
      setProblem(failure.kind === "unreachable" ? UNREACHABLE : explainRefusal(failure.message));
      setRows([]);
      return;
    }

    const next: SidedQuote[] = [];
    if (shopSide.kind === "ok") {
      for (const quote of shopSide.value.items) next.push({ quote, side: "shop" });
    }
    if (mySide.kind === "ok") {
      for (const quote of mySide.value.items) {
        // One bill shown twice is how somebody comes to think there are two.
        if (next.some((r) => r.quote.quoteId === quote.quoteId)) continue;
        next.push({ quote, side: "customer" });
      }
    }

    setProblem(null);
    setRows(next);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = useCallback(
    async (row: PresentedQuote, action: "agree" | "credit" | "cancel") => {
      setBusy(true);
      setProblem(null);
      setNote(null);

      const result = await shopClient.answerQuote(row.quoteId, action, row.version);
      setBusy(false);

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        void load();
        return;
      }

      setNote(
        action === "agree"
          ? "Agreed. Now choose credit or paid."
          : action === "credit"
            ? "Sent as a credit request. It goes in the book when they accept."
            : "Withdrawn. Nothing was added to anybody's book."
      );
      void load();
    },
    [load]
  );

  const settle = useCallback(
    async (row: PresentedQuote, method: SettlementMethod) => {
      setBusy(true);
      setProblem(null);
      setNote(null);

      // Minted here, with the intent. A retry carries the same one.
      const result = await shopClient.settleQuote(
        row.quoteId,
        { version: row.version, method },
        crypto.randomUUID()
      );
      setBusy(false);
      setSettling(null);

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        void load();
        return;
      }

      setNote(SETTLED_DISCLAIMER);
      void load();
    },
    [load]
  );

  const sendPrices = useCallback(
    async (row: PresentedQuote) => {
      const lines: QuoteLineInput[] = [];
      for (const line of row.lines) {
        const typed = prices[line.lineId] ?? String(line.amount ?? "");
        const amount = Number(typed.replace(/[^0-9]/g, ""));
        if (!Number.isInteger(amount) || amount <= 0) {
          setProblem(`What does ${line.title} cost? Type whole rupees.`);
          return;
        }
        lines.push({
          lineId: line.lineId,
          title: line.title,
          quantity: line.quantity,
          unit: line.unit,
          amount,
        });
      }

      setBusy(true);
      setProblem(null);
      const result = await shopClient.reviseQuote(row.quoteId, { version: row.version, lines });
      setBusy(false);
      setPricing(null);
      setPrices({});

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        void load();
        return;
      }
      setNote("Prices sent. It is waiting for them now.");
      void load();
    },
    [prices, load]
  );

  if (rows === null) return <p className="p-4 text-sm text-gray-500">Loading…</p>;

  const { incoming, sent } = splitSided(rows);
  const byId = new Map(rows.map((r) => [r.quote.quoteId, r.quote]));

  const card = (row: PresentedQuote) => {
    const original = byId.get(row.quoteId)!;
    const isOpen = open === row.quoteId;

    return (
      <li
        key={row.quoteId}
        className={cn(
          "flex flex-col gap-3 rounded-2xl border bg-white p-4",
          row.mine ? "border-blue-500" : "border-gray-200",
          row.finished && "opacity-70"
        )}
        data-testid={`quote-${row.quoteId}`}
      >
        <button
          type="button"
          onClick={() => setOpen(isOpen ? null : row.quoteId)}
          className="flex items-start justify-between gap-3 text-left"
          data-testid={`quote-open-${row.quoteId}`}
        >
          <div>
            <p className="text-xl font-semibold tabular-nums text-gray-900">
              {row.priced ? money(row.total) : "Not priced yet"}
            </p>
            <p className="text-sm text-gray-700">{row.counterparty}</p>
            {row.side === "customer" ? (
              <p className="text-xs text-gray-500">You, as their customer</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {row.lines.length} item{row.lines.length === 1 ? "" : "s"}
          </span>
        </button>

        <p
          className={cn("text-sm", row.mine ? "font-semibold text-blue-700" : "text-gray-500")}
          data-testid={`quote-state-${row.quoteId}`}
        >
          {row.state}
        </p>

        {/* A settled bill always carries the disclaimer. Never a bare tick. */}
        {row.settledEventId ? (
          <div
            className="flex flex-col gap-1 rounded-xl bg-gray-50 p-3"
            data-testid={`quote-receipt-${row.quoteId}`}
          >
            <p className="text-sm font-semibold text-gray-900">
              {row.settledMethod ? describeMethod(row.settledMethod) : "Paid"} · {money(row.total)}
            </p>
            <p className="text-sm text-gray-600">
              {row.settledJointly
                ? SETTLED_DISCLAIMER
                : "Your own record. This customer does not use Vyora, so nobody else confirmed it."}
            </p>
            <p className="text-xs text-gray-500">This does not change what they owe you.</p>
          </div>
        ) : null}

        {isShopsOwn(row) ? (
          <p className="text-xs text-gray-500">Yours to keep — this customer does not use Vyora.</p>
        ) : null}

        {isOpen ? (
          <div className="flex flex-col gap-1" data-testid={`quote-detail-${row.quoteId}`}>
            <ul className="flex flex-col gap-1 text-sm text-gray-700">
              {row.lines.map((line) => (
                <li key={line.lineId}>{describeLine(line)}</li>
              ))}
            </ul>
            {row.note ? <p className="text-sm text-gray-500">{row.note}</p> : null}

            {row.revisions > 0 ? (
              <button
                type="button"
                onClick={() => setShowing(showing === row.quoteId ? null : row.quoteId)}
                className="self-start text-sm font-semibold text-blue-700 hover:underline"
                data-testid={`quote-history-toggle-${row.quoteId}`}
              >
                {showing === row.quoteId
                  ? "Hide what changed"
                  : row.revisions === 1
                    ? "Changed once — see what changed"
                    : `Changed ${row.revisions} times — see what changed`}
              </button>
            ) : null}

            {showing === row.quoteId ? (
              // Words, no identifiers.
              <ol
                className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700"
                data-testid={`quote-history-${row.quoteId}`}
              >
                {original.history.slice(1).map((version, i) => (
                  <li key={version.version}>
                    <p className="text-xs text-gray-500">
                      {version.side === row.side ? "You" : "They"} ·{" "}
                      {version.total > 0 ? money(version.total) : "no prices"}
                    </p>
                    {describeChanges(original.history[i]!.lines, version.lines).map((said, j) => (
                      <p key={j}>{said}</p>
                    ))}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        {pricing === row.quoteId ? (
          <div className="flex flex-col gap-2">
            {row.lines.map((line) => (
              <label key={line.lineId} className="flex flex-col gap-1 text-sm text-gray-700">
                {line.quantity}
                {line.unit ? ` ${line.unit}` : ""} × {line.title}
                <input
                  inputMode="numeric"
                  value={prices[line.lineId] ?? String(line.amount ?? "")}
                  onChange={(e) => setPrices((p) => ({ ...p, [line.lineId]: e.target.value }))}
                  className="rounded-xl border border-gray-300 px-3 py-2.5 text-base"
                  data-testid={`quote-price-${line.lineId}`}
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendPrices(row)}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                data-testid={`quote-price-send-${row.quoteId}`}
              >
                {busy ? "Sending…" : "Send these prices"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPricing(null);
                  setPrices({});
                  setProblem(null);
                }}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : settling === row.quoteId ? (
          <div className="flex flex-col gap-2 rounded-xl bg-blue-50 p-3">
            {/* Said before it is done: a claim, not a verified payment. */}
            <p className="text-sm text-blue-900">{SETTLE_EXPLANATION}</p>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  disabled={busy}
                  onClick={() => void settle(row, method)}
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-blue-800 hover:border-blue-400 disabled:opacity-55"
                  data-testid={`quote-settle-${method}-${row.quoteId}`}
                >
                  {describeMethod(method)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSettling(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400"
              >
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {canChooseOutcome(row) ? (
              <p className="text-sm text-gray-600">{CREDIT_EXPLANATION}</p>
            ) : canAgree(row) ? (
              <p className="text-sm text-gray-600">{AGREE_EXPLANATION}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {canPrice(row) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPricing(row.quoteId)}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                  data-testid={`quote-price-open-${row.quoteId}`}
                >
                  {row.priced ? "Change the prices" : "Put prices on"}
                </button>
              ) : null}

              {canAgree(row) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void answer(row, "agree")}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                  data-testid={`quote-agree-${row.quoteId}`}
                >
                  Agree {money(row.total)}
                </button>
              ) : null}

              {canChooseOutcome(row) ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void answer(row, "credit")}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                    data-testid={`quote-credit-${row.quoteId}`}
                  >
                    Ask for credit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSettling(row.quoteId)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-55"
                    data-testid={`quote-settle-open-${row.quoteId}`}
                  >
                    Paid outside Vyora
                  </button>
                </>
              ) : null}

              {canCancel(row) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void answer(row, "cancel")}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-55"
                  data-testid={`quote-cancel-${row.quoteId}`}
                >
                  Withdraw
                </button>
              ) : null}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {problem ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="quotes-problem"
        >
          {problem}
        </div>
      ) : null}

      {note ? (
        <p
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          data-testid="quotes-note"
        >
          {note}
        </p>
      ) : null}

      <section className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Item lists</h2>
        <p className="text-sm text-gray-600">
          What somebody asked for, and what it comes to. Nothing here changes a balance — you choose
          credit or paid once you both agree the total.
        </p>
      </section>

      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Waiting for you
      </h3>
      {incoming.length === 0 ? (
        <p
          className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500"
          data-testid="quotes-incoming-empty"
        >
          Nothing waiting. Lists people send you appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="quotes-incoming">
          {incoming.map(card)}
        </ul>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">You sent</h3>
      {sent.length === 0 ? (
        <p
          className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500"
          data-testid="quotes-sent-empty"
        >
          You have not sent a list yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="quotes-sent">
          {sent.map(card)}
        </ul>
      )}
    </div>
  );
}

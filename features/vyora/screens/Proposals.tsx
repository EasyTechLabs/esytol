"use client";

/**
 * Vyora — Requests.
 *
 * The two-sided half of the book: amounts that are not in anybody's ledger
 * until both people have agreed to them.
 *
 * ## Nothing here says "recorded" before it is
 *
 * A proposal is not an entry. Until the server has finalised it *and* the event
 * has been written, the row says what is actually true — waiting for you,
 * waiting for them, or agreed and being added. This is the one mistake the
 * screen must not make: a merchant who reads "recorded" goes and acts on money
 * that does not exist yet.
 *
 * ## Both sides of the same person
 *
 * A merchant is a shop to their customers and a customer to their wholesaler.
 * So two lists are read — the active shop's, and this person's own — and each
 * row carries the side it was read from, because every word on it depends on
 * which side is reading.
 *
 * ## Active shop, always
 *
 * The shop list is not parameterised by shop. It resolves to the shop this
 * person has selected, held on the server and changed only by choosing a
 * different one. A browser cannot name a shop on these requests, so it cannot
 * read or answer another shop's proposal by editing a URL.
 *
 * ## It needs the API, and says so
 *
 * The ledger works with no connection; that premise is untouched. A negotiation
 * does not — it has to reach somebody who is not at this screen. With no API
 * this page says the list cannot be loaded rather than showing a stale one.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ACCEPT_EXPLANATION,
  canAnswer,
  canRevise,
  canWithdraw,
  describeHistory,
  describeType,
  explainRefusal,
  splitSided,
  type PresentedProposal,
  type SidedProposal,
} from "@/lib/vyora/proposals";
import { shopClient, type Proposal } from "@/lib/vyora/shop-client";

const UNREACHABLE =
  "Vyora needs a connection to show requests. Your book still works — this list does not.";

const money = (rupees: number) => `₹${rupees.toLocaleString("en-IN")}`;

export function Proposals() {
  const [rows, setRows] = useState<readonly SidedProposal[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The row a confirmation, a counter-offer or the history is open for. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revising, setRevising] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const load = useCallback(async () => {
    const [shopSide, mySide] = await Promise.all([
      shopClient.listProposals(),
      shopClient.listMyProposals(),
    ]);

    // A shop list refused with 403 is not an error — it is a person with no
    // shop of their own, or one whose role does not reach it. Their own
    // customer side still loads, and that is the page they should get.
    const failure =
      shopSide.kind === "unreachable" ? shopSide : mySide.kind !== "ok" ? mySide : null;

    if (failure !== null) {
      setProblem(failure.kind === "unreachable" ? UNREACHABLE : explainRefusal(failure.message));
      setRows([]);
      return;
    }

    const next: SidedProposal[] = [];
    if (shopSide.kind === "ok") {
      for (const proposal of shopSide.value.items) next.push({ proposal, side: "shop" });
    }
    if (mySide.kind === "ok") {
      for (const proposal of mySide.value.items) {
        // A person on both sides of the same negotiation sees it in both
        // lists. The shop reading wins — showing one figure twice under two
        // headings is how somebody comes to believe there are two debts.
        if (next.some((r) => r.proposal.proposalId === proposal.proposalId)) continue;
        next.push({ proposal, side: "customer" });
      }
    }

    setProblem(null);
    setRows(next);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = useCallback(
    async (row: PresentedProposal, action: "accept" | "reject" | "cancel") => {
      setBusy(true);
      setProblem(null);
      setNote(null);

      const result = await shopClient.answerProposal(row.proposalId, action, row.version);
      setBusy(false);
      setConfirming(null);

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        // A refusal usually means the other side moved. Re-read rather than
        // leaving a figure on screen that nobody is offering any more.
        void load();
        return;
      }

      // Said from the server's own answer, not from what was asked for. The
      // gap between `accepted` and `recorded` is where a retry lives, and this
      // page must not close it with a sentence.
      setNote(
        action === "accept"
          ? result.value.status === "recorded"
            ? "Agreed. It is in the book for both of you."
            : "Agreed. It is being added to the book now."
          : action === "reject"
            ? "Declined. Nothing was added to either book."
            : "Withdrawn. Nothing was added to either book."
      );
      void load();
    },
    [load]
  );

  const revise = useCallback(
    async (row: PresentedProposal) => {
      const amount = Number(typed.replace(/[^0-9]/g, ""));
      if (!Number.isInteger(amount) || amount <= 0) {
        setProblem("Type the amount in whole rupees.");
        return;
      }

      setBusy(true);
      setProblem(null);
      setNote(null);

      const result = await shopClient.reviseProposal(row.proposalId, {
        version: row.version,
        amount,
      });
      setBusy(false);

      if (result.kind !== "ok") {
        setProblem(result.kind === "unreachable" ? UNREACHABLE : explainRefusal(result.message));
        void load();
        return;
      }

      setRevising(null);
      setTyped("");
      setNote("Sent back with your figure. It is waiting for them now.");
      void load();
    },
    [typed, load]
  );

  if (rows === null) {
    return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  }

  const { incoming, sent } = splitSided(rows);
  const byId = new Map(rows.map((r) => [r.proposal.proposalId, r.proposal]));

  const card = (row: PresentedProposal) => {
    const original = byId.get(row.proposalId)!;
    const openRevision = revising === row.proposalId;
    const openConfirm = confirming === row.proposalId;
    const openHistory = showing === row.proposalId;

    return (
      <li
        key={row.proposalId}
        className={cn(
          "flex flex-col gap-3 rounded-2xl border bg-white p-4",
          row.mine ? "border-blue-500" : "border-gray-200",
          row.finished && "opacity-70"
        )}
        data-testid={`proposal-${row.proposalId}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-semibold tabular-nums text-gray-900">{money(row.amount)}</p>
            <p className="text-sm text-gray-700">{row.counterparty}</p>
            {row.side === "customer" ? (
              <p className="text-xs text-gray-500">You, as their customer</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {describeType(row.type)}
          </span>
        </div>

        {row.dueDate ? <p className="text-sm text-gray-500">Due {row.dueDate}</p> : null}
        {row.note ? <p className="text-sm text-gray-500">{row.note}</p> : null}

        <p
          className={cn("text-sm", row.mine ? "font-semibold text-blue-700" : "text-gray-500")}
          data-testid={`proposal-state-${row.proposalId}`}
        >
          {row.state}
        </p>

        {row.revisions > 0 ? (
          <button
            type="button"
            onClick={() => setShowing(openHistory ? null : row.proposalId)}
            className="self-start text-sm font-semibold text-blue-700 hover:underline"
            data-testid={`proposal-history-toggle-${row.proposalId}`}
          >
            {openHistory
              ? "Hide what changed"
              : row.revisions === 1
                ? "Changed once — see what changed"
                : `Changed ${row.revisions} times — see what changed`}
          </button>
        ) : null}

        {openHistory ? (
          // Words, no identifiers. Somebody arguing about a figure needs to see
          // it moved from ₹2,500 to ₹1,800 and who moved it; a version id
          // teaches them to read identifiers instead.
          <ol
            className="flex flex-col gap-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-700"
            data-testid={`proposal-history-${row.proposalId}`}
          >
            {describeHistory(original, row.side).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        ) : null}

        {openConfirm ? (
          <div className="flex flex-col gap-3 rounded-xl bg-blue-50 p-3">
            {/* Said before it is done: this is the moment a figure becomes a debt. */}
            <p className="text-sm text-blue-900">{ACCEPT_EXPLANATION}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void answer(row, "accept")}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                data-testid={`proposal-accept-confirm-${row.proposalId}`}
              >
                {busy ? "Agreeing…" : `Agree to ${money(row.amount)}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400"
              >
                Not yet
              </button>
            </div>
          </div>
        ) : null}

        {openRevision ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-700" htmlFor={`revise-${row.proposalId}`}>
              Your figure, in whole rupees
            </label>
            <input
              id={`revise-${row.proposalId}`}
              inputMode="numeric"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-base"
              data-testid={`proposal-revise-input-${row.proposalId}`}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void revise(row)}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                data-testid={`proposal-revise-send-${row.proposalId}`}
              >
                {busy ? "Sending…" : "Send this figure back"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevising(null);
                  setTyped("");
                  setProblem(null);
                }}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {!openConfirm && !openRevision ? (
          <div className="flex flex-wrap gap-2">
            {canAnswer(row) ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(row.proposalId)}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-55"
                  data-testid={`proposal-accept-${row.proposalId}`}
                >
                  Agree
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void answer(row, "reject")}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-55"
                  data-testid={`proposal-reject-${row.proposalId}`}
                >
                  Decline
                </button>
              </>
            ) : null}

            {canRevise(row) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRevising(row.proposalId);
                  setTyped(String(row.amount));
                  setProblem(null);
                }}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-55"
                data-testid={`proposal-revise-${row.proposalId}`}
              >
                {canAnswer(row) ? "Send a different figure" : "Change the figure"}
              </button>
            ) : null}

            {canWithdraw(row) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void answer(row, "cancel")}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-55"
                data-testid={`proposal-cancel-${row.proposalId}`}
              >
                Withdraw
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {problem ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="proposals-problem"
        >
          {problem}
        </div>
      ) : null}

      {note ? (
        <p
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          data-testid="proposals-note"
        >
          {note}
        </p>
      ) : null}

      <section className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Requests</h2>
        <p className="text-sm text-gray-600">
          Nothing here is in anybody&rsquo;s book until both of you agree. A request you accept is
          added once, and cannot be edited afterwards — a mistake is corrected by a new entry.
        </p>
      </section>

      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Waiting for you
      </h3>
      {incoming.length === 0 ? (
        <p
          className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500"
          data-testid="proposals-incoming-empty"
        >
          Nothing waiting. Requests other people send you appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="proposals-incoming">
          {incoming.map(card)}
        </ul>
      )}

      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">You asked</h3>
      {sent.length === 0 ? (
        <p
          className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500"
          data-testid="proposals-sent-empty"
        >
          You have not asked for anything yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="proposals-sent">
          {sent.map(card)}
        </ul>
      )}
    </div>
  );
}

export type { Proposal };

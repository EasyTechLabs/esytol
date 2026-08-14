/**
 * Proposals, as each side reads them.
 *
 * Pure: no fetch, no storage, no React. The mobile app holds the same rules in
 * `src/features/proposals.ts`, and the two are kept in step deliberately —
 * parity here is not code sharing, it is the same sentences appearing on both
 * screens so a merchant is never told two different things about one figure.
 *
 * ## The distinction this module exists to keep
 *
 * A proposal is **not** an entry. Until it is `recorded`, nothing has happened:
 * no money has moved and neither book knows about it. A screen that showed a
 * pending proposal as a credit would be telling somebody they are owed money
 * nobody has agreed to.
 *
 * ## Expiry is recomputed here
 *
 * The API derives expiry from the clock rather than storing it, so a list
 * fetched at 09:00 and still open at 09:20 can hold a proposal that has since
 * lapsed. Recomputing on render means Accept stops being offered when the offer
 * stops meaning anything, rather than staying live until a request comes back
 * refused.
 */

import type { Proposal, ProposalSide, ProposalStatus, ProposalType } from "./shop-client";

export interface PresentedProposal {
  readonly proposalId: string;
  readonly version: number;
  readonly type: ProposalType;
  readonly status: ProposalStatus;
  readonly amount: number;
  readonly dueDate: string | null;
  readonly note: string | null;
  /** Who this is with, from the reading side's point of view. */
  readonly counterparty: string;
  /** Which side did the reading. Carried per row, not per screen. */
  readonly side: ProposalSide;
  /** Who opened this negotiation. Only they may withdraw it. */
  readonly initiator: ProposalSide;
  /** True when this side is the one being waited for. */
  readonly mine: boolean;
  /** True once the ledger holds it. Only then has anything happened. */
  readonly recorded: boolean;
  readonly finished: boolean;
  /** One line a merchant can act on. */
  readonly state: string;
  readonly revisions: number;
}

export function describeType(type: ProposalType): string {
  switch (type) {
    case "credit":
      return "Credit";
    case "payment":
      return "Payment";
    case "advance_payment":
      return "Advance payment";
  }
}

/**
 * The one line under the amount, written for whichever side is reading.
 *
 * "Waiting for you" and "Waiting for them" are the same server state and
 * completely different instructions.
 */
export function describeState(proposal: Proposal, side: ProposalSide, now: number): string {
  if (hasLapsed(proposal, now)) return "This expired before it was answered";

  switch (proposal.status) {
    case "proposed":
    case "revised":
      return proposal.awaitingSide === side ? "Waiting for you to answer" : "Waiting for them";
    case "recorded":
      return "Agreed and recorded in the book";
    case "rejected":
      return "Declined";
    case "cancelled":
      return "Withdrawn";
    case "expired":
      return "This expired before it was answered";
    case "accepted":
      // The gap between agreeing and the entry existing. Real, and worth being
      // honest about: it is where a retry lives.
      return "Agreed — adding it to the book";
    default:
      return "Waiting";
  }
}

const LIVE: readonly ProposalStatus[] = ["proposed", "revised"];

function hasLapsed(proposal: Proposal, now: number): boolean {
  return (
    LIVE.includes(proposal.status) &&
    proposal.expiresAt !== null &&
    Date.parse(proposal.expiresAt) <= now
  );
}

export function present(
  proposal: Proposal,
  side: ProposalSide,
  now: number = Date.now()
): PresentedProposal {
  const lapsed = hasLapsed(proposal, now);
  const status: ProposalStatus = lapsed ? "expired" : proposal.status;
  const finished =
    status === "recorded" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "expired";

  return {
    proposalId: proposal.proposalId,
    version: proposal.version,
    type: proposal.type,
    status,
    amount: proposal.amount,
    dueDate: proposal.dueDate,
    note: proposal.note,
    // A shop reads the customer's name; a customer reads the shop's.
    counterparty: side === "shop" ? proposal.partyName : proposal.shopName,
    side,
    initiator: proposal.initiator,
    mine: !lapsed && LIVE.includes(proposal.status) && proposal.awaitingSide === side,
    // Never true on `accepted`. The server has agreed; the entry is not there
    // yet, and claiming it would send somebody to look for money that has not
    // arrived.
    recorded: status === "recorded",
    finished,
    state: describeState(proposal, side, now),
    revisions: Math.max(0, proposal.history.length - 1),
  };
}

/** Whether this side may answer right now. */
export function canAnswer(proposal: PresentedProposal): boolean {
  return proposal.mine;
}

/**
 * Whether this side may counter-offer.
 *
 * Either side may revise a live proposal — a counter-offer is a revision, not a
 * rejection. Including the side that made it: changing your own offer before
 * anybody answers is the ordinary thing to want.
 */
export function canRevise(proposal: PresentedProposal): boolean {
  return !proposal.finished && LIVE.includes(proposal.status);
}

/** Only the side that asked may withdraw, and only while it is unanswered. */
export function canWithdraw(proposal: PresentedProposal): boolean {
  return canRevise(proposal) && proposal.initiator === proposal.side;
}

export interface SidedProposal {
  readonly proposal: Proposal;
  readonly side: ProposalSide;
}

/**
 * The two lists a screen shows, in the order they are useful.
 *
 * Yours to answer first — that is the only part of this screen that is work.
 * Then what you are waiting on, then everything finished.
 *
 * "Incoming" is anything the other side started, whatever state it is in;
 * "sent" is anything this side started. Not the same as "needs an answer": a
 * rejected request you sent still belongs under sent, because that is where you
 * will look for it.
 */
export function splitSided(
  rows: readonly SidedProposal[],
  now: number = Date.now()
): { incoming: PresentedProposal[]; sent: PresentedProposal[] } {
  const all = rows
    .map((r) => present(r.proposal, r.side, now))
    .sort((a, b) => {
      if (a.mine !== b.mine) return a.mine ? -1 : 1;
      if (a.finished !== b.finished) return a.finished ? 1 : -1;
      return a.counterparty.localeCompare(b.counterparty);
    });

  return {
    incoming: all.filter((p) => p.initiator !== p.side),
    sent: all.filter((p) => p.initiator === p.side),
  };
}

/**
 * The history, in words, with no identifiers in it.
 *
 * A merchant arguing about a figure needs to see it moved from ₹2,500 to
 * ₹1,800 and who moved it. They do not need a proposal id, a version id or a
 * person id, and showing one would teach them to read identifiers.
 */
export function describeHistory(proposal: Proposal, side: ProposalSide): readonly string[] {
  return proposal.history.map((version, index) => {
    const who = version.side === side ? "You" : "They";
    const opening = index === 0 ? "asked for" : "changed it to";
    const due = version.dueDate ? `, due ${version.dueDate}` : "";
    return `${who} ${opening} ₹${version.amount.toLocaleString("en-IN")}${due}`;
  });
}

/**
 * What to say when the server refuses.
 *
 * The API's refusals in this area are written for merchants — "The amount
 * changed while you were looking" — so they pass through. Anything that reads
 * like plumbing is replaced.
 */
export function explainRefusal(message: string): string {
  const said = message.trim();
  if (!said) return "Vyora could not do that just now.";
  if (/\b(400|401|403|404|409|412|500|conflict|forbidden|unauthori[sz]ed)\b/i.test(said)) {
    return "Vyora could not do that just now.";
  }
  return said;
}

/**
 * What somebody is told before agreeing.
 *
 * Naming the consequence, because this is the moment a figure becomes a debt.
 */
export const ACCEPT_EXPLANATION =
  "Agreeing puts this in the book for both of you. It cannot be edited afterwards — a mistake is corrected by a new entry, and both stay on the record.";

/** And why a shop cannot propose to somebody who does not use Vyora. */
export const NOT_LINKED_EXPLANATION =
  "This customer does not use Vyora, so there is nobody to agree. Record the entry yourself — it goes in your book exactly as it always has, marked as your own record rather than an agreed one.";

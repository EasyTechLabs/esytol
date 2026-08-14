/**
 * Item lists, as each side reads them.
 *
 * Pure: no fetch, no storage, no React. The phone holds the same rules in
 * `src/features/quotes.ts`, and the two are kept in step deliberately — parity
 * here is the same sentences reaching a merchant whichever screen they read.
 *
 * ## The claim this module keeps
 *
 * **A list is not a debt.** Nothing here is a balance and nothing here folds
 * into one. A customer with ₹5,000 of udhaar who sends a ₹700 list still owes
 * ₹5,000, and every sentence below is written so a merchant cannot read it
 * otherwise.
 *
 * ## And the sharper one
 *
 * A bill paid outside Vyora is **not** a payment. Vyora saw no money; two
 * people tapped a button. `SETTLED_DISCLAIMER` says exactly that, and every
 * screen showing a receipt shows it. See ADR-0014 §5.
 */

import type { Quote, QuoteLine, QuoteStatus, ProposalSide, SettlementMethod } from "./shop-client";

/** The states in which a list can still be answered. Same shape as a proposal. */
const LIVE: readonly QuoteStatus[] = ["proposed", "revised", "agreed"];

export interface PresentedQuote {
  readonly quoteId: string;
  readonly version: number;
  readonly status: QuoteStatus;
  readonly total: number;
  readonly lines: readonly QuoteLine[];
  readonly note: string | null;
  /** Who this is with, from the reading side's point of view. */
  readonly counterparty: string;
  readonly side: ProposalSide;
  readonly initiator: ProposalSide;
  /** True when this side is the one being waited for. */
  readonly mine: boolean;
  readonly finished: boolean;
  /** True once every line carries a price. */
  readonly priced: boolean;
  /** One line a merchant can act on. */
  readonly state: string;
  readonly revisions: number;
  readonly creditProposalId: string | null;
  readonly settledEventId: string | null;
  readonly settledMethod: SettlementMethod | null;
  readonly settledJointly: boolean | null;
}

/** How the customer said they paid, in words. */
export function describeMethod(method: SettlementMethod): string {
  switch (method) {
    case "cash":
      return "Cash";
    case "upi":
      return "UPI";
    case "bank_transfer":
      return "Bank transfer";
    case "other":
      return "Some other way";
  }
}

/**
 * The one line under the total, written for whichever side is reading.
 *
 * Never says a list is in the book, because a list never is. The two endings
 * say what actually happened: a credit is waiting to be accepted, or a receipt
 * exists and nobody's balance moved.
 */
export function describeState(quote: Quote, side: ProposalSide, now: number): string {
  if (hasLapsed(quote, now)) return "This expired before it was answered";

  switch (quote.status) {
    case "draft":
      return "Yours to keep — this customer does not use Vyora";
    case "proposed":
    case "revised":
      if (!isPriced(quote.lines)) {
        return side === "shop" ? "Waiting for you to price it" : "Waiting for the shop's total";
      }
      return quote.awaitingSide === side ? "Waiting for you to answer" : "Waiting for them";
    case "agreed":
      return "Agreed — now choose credit or paid";
    case "credited":
      // Not "in the book". The proposal still has to be accepted, and that is
      // where the one ledger event comes from.
      return "Sent as a credit request";
    case "settled":
      return "Payment confirmed by both sides";
    case "cancelled":
      return "Withdrawn";
    case "expired":
      return "This expired before it was answered";
    default:
      return "Waiting";
  }
}

function hasLapsed(quote: Quote, now: number): boolean {
  return (
    LIVE.includes(quote.status) && quote.expiresAt !== null && Date.parse(quote.expiresAt) <= now
  );
}

/** True when every line carries a price. A half-priced list has no honest total. */
export function isPriced(lines: readonly QuoteLine[]): boolean {
  return lines.length > 0 && lines.every((l) => l.amount !== null);
}

/**
 * The total, computed here only to check what the server said.
 *
 * The server's figure is the one shown. This exists so a test can assert the
 * two agree, and so a screen never has to add up anything itself.
 */
export function sumLines(lines: readonly QuoteLine[]): number {
  return lines.reduce((total, line) => total + (line.amount ?? 0), 0);
}

export function present(
  quote: Quote,
  side: ProposalSide,
  now: number = Date.now()
): PresentedQuote {
  const lapsed = hasLapsed(quote, now);
  const status: QuoteStatus = lapsed ? "expired" : quote.status;
  const finished =
    status === "credited" || status === "settled" || status === "cancelled" || status === "expired";

  return {
    quoteId: quote.quoteId,
    version: quote.version,
    status,
    total: quote.total,
    lines: quote.lines,
    note: quote.note,
    // A shop reads the customer's name; a customer reads the shop's.
    counterparty: side === "shop" ? quote.partyName : quote.shopName,
    side,
    initiator: quote.initiator,
    mine: !lapsed && LIVE.includes(quote.status) && quote.awaitingSide === side,
    finished,
    priced: isPriced(quote.lines),
    state: describeState(quote, side, now),
    revisions: Math.max(0, quote.history.length - 1),
    creditProposalId: quote.creditProposalId,
    settledEventId: quote.settledEventId,
    settledMethod: quote.settledMethod,
    settledJointly: quote.settledJointly,
  };
}

/** Whether this side may send a new version. */
export function canRevise(quote: PresentedQuote): boolean {
  return !quote.finished && (quote.status === "proposed" || quote.status === "revised");
}

/** Only the shop puts prices on. A customer pricing their own list is not pricing. */
export function canPrice(quote: PresentedQuote): boolean {
  return canRevise(quote) && quote.side === "shop";
}

/**
 * Whether this side may agree the figure.
 *
 * The list has to be priced, live, and waiting on this side. Agreeing with
 * yourself is not agreement, which is why `mine` is required rather than
 * merely "not finished".
 */
export function canAgree(quote: PresentedQuote): boolean {
  return quote.mine && quote.priced && quote.status !== "agreed";
}

/**
 * Whether this side may choose an outcome.
 *
 * Only once both sides have agreed the figure. "That is the right figure" and
 * "put it on my tab" are two different sentences, and a customer should be able
 * to say the first without being taken to have said the second.
 */
export function canChooseOutcome(quote: PresentedQuote): boolean {
  return quote.status === "agreed";
}

/** A list for somebody with no Vyora account can only ever be the shop's own. */
export function isShopsOwn(quote: PresentedQuote): boolean {
  return quote.status === "draft";
}

export function canCancel(quote: PresentedQuote): boolean {
  return !quote.finished;
}

export interface SidedQuote {
  readonly quote: Quote;
  readonly side: ProposalSide;
}

/**
 * The two lists a screen shows, in the order they are useful.
 *
 * Yours to answer first — that is the only part that is work. Then what you are
 * waiting on, then everything finished.
 */
export function splitSided(
  rows: readonly SidedQuote[],
  now: number = Date.now()
): { incoming: PresentedQuote[]; sent: PresentedQuote[] } {
  const all = rows
    .map((r) => present(r.quote, r.side, now))
    .sort((a, b) => {
      if (a.mine !== b.mine) return a.mine ? -1 : 1;
      if (a.finished !== b.finished) return a.finished ? 1 : -1;
      return a.counterparty.localeCompare(b.counterparty);
    });

  return {
    incoming: all.filter((q) => q.initiator !== q.side),
    sent: all.filter((q) => q.initiator === q.side),
  };
}

/**
 * One line, in words.
 *
 * "2 × Rice (bags) — ₹2,400", or without the price while the shop has not said.
 */
export function describeLine(line: QuoteLine): string {
  const unit = line.unit ? ` ${line.unit}` : "";
  const what = `${line.quantity}${unit} × ${line.title}`;
  return line.amount === null ? what : `${what} — ₹${line.amount.toLocaleString("en-IN")}`;
}

/**
 * What changed between two versions, in words.
 *
 * Written for somebody holding a phone across a counter, so it names items and
 * rupees and never a line id.
 */
export function describeChanges(
  before: readonly QuoteLine[],
  after: readonly QuoteLine[]
): readonly string[] {
  const said: string[] = [];
  const byId = new Map(before.map((l) => [l.lineId, l]));

  for (const line of after) {
    const was = byId.get(line.lineId);
    if (!was) {
      said.push(`Added ${line.title}`);
      continue;
    }
    if (was.amount !== line.amount) {
      said.push(
        was.amount === null
          ? `Priced ${line.title} at ₹${(line.amount ?? 0).toLocaleString("en-IN")}`
          : `${line.title}: ₹${was.amount.toLocaleString("en-IN")} → ₹${(line.amount ?? 0).toLocaleString("en-IN")}`
      );
    }
    if (was.quantity !== line.quantity) {
      said.push(`${line.title}: ${was.quantity} → ${line.quantity}`);
    }
  }

  const kept = new Set(after.map((l) => l.lineId));
  for (const line of before) {
    if (!kept.has(line.lineId)) said.push(`Removed ${line.title}`);
  }

  return said.length > 0 ? said : ["Nothing changed"];
}

/**
 * What a merchant is told before agreeing to a figure.
 *
 * Naming what agreeing does *not* do, because the next screen is where the
 * money decision actually happens.
 */
export const AGREE_EXPLANATION =
  "Agreeing means the figure is right. Nothing goes in either book yet — you choose credit or paid next.";

/** And before putting it on credit. */
export const CREDIT_EXPLANATION =
  "This asks for the total as credit. It goes in the book once they accept, and cannot be edited afterwards — a mistake is corrected by a new entry.";

/**
 * The sentence that must appear wherever a settled bill does.
 *
 * A merchant who reads this and still wants proof will open their UPI app,
 * which is the correct outcome. A merchant shown a green tick and the word
 * "Paid" will not.
 */
export const SETTLED_DISCLAIMER = "Payment confirmed by both sides — not verified by Vyora.";

/** What settling claims, said before it is done. */
export const SETTLE_EXPLANATION =
  "This records that the bill was paid outside Vyora. It does not change what they owe you, and Vyora does not check that the money arrived.";

/** A list for somebody with no account. */
export const NOT_LINKED_EXPLANATION =
  "This customer does not use Vyora, so nobody can agree to this list. Keep it to read back at the counter, and record the entry yourself if they take it on credit.";

export const UNREACHABLE =
  "Vyora needs a connection to show item lists. Your own book still works — this list does not.";

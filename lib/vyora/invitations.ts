/**
 * Vyora — invitations, as the person who received one sees them.
 *
 * Pure: no fetch, no storage, no React.
 *
 * ## Why expiry is recomputed here
 *
 * The API derives `expired` from the clock rather than storing it, so a list
 * fetched at 09:00 and still on screen at 09:20 can hold an invitation that has
 * since lapsed. Recomputing on render means Accept disappears when it stops
 * meaning anything, instead of staying live until the server refuses it.
 *
 * The server still decides. This only stops the screen offering something that
 * will fail.
 *
 * ## What an invitee may know
 *
 * They are a stranger to that shop until they accept — the same line ADR-0006
 * draws for the verification window. Name, public Shop ID, confirmed locality.
 * No street address, no member list, no book.
 *
 * The same rules exist in `vyora-mobile/src/features/invitations.ts`. Copied
 * rather than shared for the reason every other pure module here is: the two
 * repositories have no runtime dependency on each other, and both are checked
 * against the same API.
 */

import type { IncomingInvitation } from "./shop-client";

/** Everything an invitation may carry to its recipient. */
export const SAFE_FIELDS = [
  "expiresAt",
  "invitationId",
  "locality",
  "role",
  "shopId",
  "shopName",
] as const;

export type InvitationState = "open" | "expired";

export interface PresentedInvitation {
  readonly invitationId: string;
  readonly shopName: string;
  readonly shopId: string | null;
  readonly locality: string | null;
  readonly role: IncomingInvitation["role"];
  readonly state: InvitationState;
  readonly expiry: string;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * How much longer this stands, in words a person uses.
 *
 * Not a date. "Expires 27 Aug 2026" makes somebody do arithmetic to work out
 * whether they need to act today.
 */
export function describeExpiry(expiresAt: string, now: number): string {
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return "Expiry unknown";

  const left = at - now;
  if (left <= 0) return "This invitation has expired";
  if (left < 60 * 60 * 1000) return "Expires within the hour";
  if (left < DAY) return "Expires today";
  if (left < 2 * DAY) return "Expires tomorrow";
  return `Expires in ${Math.round(left / DAY)} days`;
}

export function present(
  invitation: IncomingInvitation,
  now: number = Date.now()
): PresentedInvitation {
  const at = Date.parse(invitation.expiresAt);
  // An unparseable timestamp counts as expired. Offering Accept on something
  // whose life cannot be established is the wrong way to be wrong.
  const expired = !Number.isFinite(at) || at <= now;

  return {
    invitationId: invitation.invitationId,
    shopName: invitation.shopName,
    shopId: invitation.shopId,
    locality: invitation.locality,
    role: invitation.role,
    state: expired ? "expired" : "open",
    expiry: describeExpiry(invitation.expiresAt, now),
  };
}

export function presentAll(
  invitations: readonly IncomingInvitation[],
  now: number = Date.now()
): PresentedInvitation[] {
  // Open first, soonest to lapse first within those: the one needing a decision
  // today should not sit below one with a fortnight left.
  return invitations
    .map((i) => present(i, now))
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "open" ? -1 : 1;
      return a.expiry.localeCompare(b.expiry);
    });
}

export function canAccept(invitation: PresentedInvitation): boolean {
  return invitation.state === "open";
}

export const EXPIRED_EXPLANATION = "This invitation has expired. Ask the shop to send a new one.";

export const UNREACHABLE =
  "Vyora needs a connection to show invitations. Your own book still works — this list does not.";

/**
 * What to say when the server refuses.
 *
 * Never a status code, and never the word "forbidden". A merchant reads this,
 * and "403" tells them to phone somebody.
 *
 * The API's own refusals are written for merchants — "Only an owner can add or
 * change the people in this shop" — so they are passed through. The `fallback`
 * is what replaces anything that reads like plumbing, and it is a parameter
 * because the right substitute depends on what was being attempted: an
 * invitation that will not open and a page that will not load need different
 * sentences, and a generic one would fit neither.
 */
export function explainRefusal(message: string, fallback = UNAVAILABLE): string {
  const said = message.trim();
  if (!said) return fallback;
  if (/\b(403|401|404|forbidden|unauthori[sz]ed)\b/i.test(said)) return fallback;
  return said;
}

const UNAVAILABLE = "That invitation is no longer available.";

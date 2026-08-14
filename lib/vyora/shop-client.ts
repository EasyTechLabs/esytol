/**
 * Vyora — the browser's half of sign-in and shop setup.
 *
 * Every call goes to this app's own server, never to the API directly. The
 * session token lives in an httpOnly cookie the browser cannot read, so the
 * only way to use it is to ask the server to. `credentials: "same-origin"` is
 * what sends the cookie; without it, every authenticated call would come back
 * 401 with nothing to show for it.
 *
 * Failures collapse to two kinds, because the screens have exactly two things
 * to say. `unreachable` means nothing was decided and trying again is safe;
 * `refused` means the server answered and the answer is no.
 */

import type { CreateShopBody, ShopVerification } from "./shops";

export type Result<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "unreachable"; readonly message: string }
  | { readonly kind: "refused"; readonly status: number; readonly message: string };

const UNREACHABLE =
  "Vyora could not reach the server. Nothing has been sent. Check your connection and try again.";

export interface Shop {
  readonly merchantId: string;
  readonly shopId: string | null;
  readonly name: string;
  readonly addressLine: string | null;
  readonly pincode: string | null;
  readonly localitySuggested: string | null;
  readonly localityConfirmed: string | null;
  readonly createdAt: string;
}

/**
 * A shop, plus what I may do in it.
 *
 * Was `ShopMember` until SHOP-MEMBERSHIP-001, which needed that name for *a
 * person in a shop*. Of the two this was the inaccurate one: it is a shop.
 */
export interface ShopWithRole extends Shop {
  readonly role: "owner" | "staff";
}

export interface Person {
  readonly personId: string | null;
  readonly email: string | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      // The cookie is the credential. Omitting this silently signs every
      // request out.
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return { kind: "unreachable", message: UNREACHABLE };
  }

  const text = await response.text();

  if (response.ok) {
    try {
      return { kind: "ok", value: JSON.parse(text) as T };
    } catch {
      return { kind: "unreachable", message: UNREACHABLE };
    }
  }

  // 5xx and 502 are this app failing to reach the API — the same situation as
  // no network, from the merchant's point of view.
  if (response.status >= 500) return { kind: "unreachable", message: UNREACHABLE };

  let message = "Vyora could not do that.";
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    // Non-JSON body; the status is all there is.
  }
  return { kind: "refused", status: response.status, message };
}

const ROOT = "/api/vyora-shops";

// ── People in a shop (SHOP-MEMBERSHIP-001) ───────────────────────────────────

export type MembershipRole = "owner" | "staff" | "viewer";

/**
 * A phone signed in to this account.
 *
 * Mirrors the contract's `Device`, and the list is closed for the same reason
 * it is closed there: no installation key, no hash of one, and nothing about
 * the handset or the network — not an Android ID, an advertising ID, an IMEI, a
 * MAC address, a SIM or phone number, an IP address or a user agent. The only
 * free text is what the merchant typed.
 */
export interface Device {
  readonly deviceId: string;
  /** What the merchant called it. Their words, never the handset's. */
  readonly label: string | null;
  readonly registeredAt: string;
  readonly lastSeenAt: string | null;
  /** Never true from a browser: a device is a phone that registered a key. */
  readonly current: boolean;
  readonly status: "active" | "revoked";
}

export interface ShopMember {
  readonly personId: string;
  readonly displayName: string | null;
  /** `r••••h@example.com`. The API masks it; this name is the reminder why. */
  readonly emailMasked: string | null;
  readonly role: MembershipRole;
  readonly status: "active" | "inactive";
  readonly joinedAt: string;
}

/**
 * Merchant-facing wording for each role, served by the API rather than written
 * here, so the browser and the phone cannot describe the same role differently.
 */
export type RoleSummaries = Readonly<Record<MembershipRole, string>>;

export interface ShopInvitation {
  readonly invitationId: string;
  readonly role: MembershipRole;
  readonly status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  readonly invitedEmailMasked: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/**
 * An invitation as its recipient sees it — the shop's name and public code, and
 * nothing about its book. They are a stranger to that shop until they accept.
 */
export interface IncomingInvitation {
  readonly invitationId: string;
  readonly shopId: string | null;
  readonly shopName: string;
  readonly locality: string | null;
  readonly role: MembershipRole;
  readonly expiresAt: string;
}

export type ProposalType = "credit" | "payment" | "advance_payment";
export type ProposalSide = "shop" | "customer";
export type ProposalStatus =
  "draft" | "proposed" | "revised" | "accepted" | "recorded" | "rejected" | "cancelled" | "expired";

export interface ProposalVersion {
  readonly version: number;
  readonly amount: number;
  readonly dueDate: string | null;
  readonly note: string | null;
  readonly side: ProposalSide;
  readonly at: string;
}

/**
 * A proposal as both sides see it.
 *
 * Note what is absent: no person id, no device id, no merchant id. Two people
 * who are not the same person read this object, and neither needs an
 * identifier for the other.
 *
 * `amount` is **whole rupees**, exactly as the ledger stores it. Anything that
 * multiplies by 100 to "be safe" introduces a hundredfold error into somebody's
 * debt.
 */
export interface Proposal {
  readonly proposalId: string;
  readonly type: ProposalType;
  readonly initiator: ProposalSide;
  readonly status: ProposalStatus;
  readonly version: number;
  readonly amount: number;
  readonly dueDate: string | null;
  readonly note: string | null;
  readonly partyId: string;
  readonly partyName: string;
  readonly shopId: string;
  readonly shopName: string;
  readonly expiresAt: string | null;
  /** Set only once the ledger holds it. Until then nothing has happened. */
  readonly finalEventId: string | null;
  readonly awaitingSide: ProposalSide | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly ProposalVersion[];
}

export type QuoteStatus =
  "draft" | "proposed" | "revised" | "agreed" | "credited" | "settled" | "cancelled" | "expired";

export type SettlementMethod = "cash" | "upi" | "bank_transfer" | "other";

export interface QuoteLine {
  readonly lineId: string;
  readonly title: string;
  readonly quantity: number;
  readonly unit: string | null;
  /**
   * Whole rupees for **this line**, entered by the shop. Not a unit price.
   *
   * Null until the shop has priced it — a customer's first list is titles and
   * quantities and nothing else.
   */
  readonly amount: number | null;
}

export interface QuoteLineInput {
  readonly lineId?: string;
  readonly title: string;
  readonly quantity: number;
  readonly unit?: string | null;
  readonly amount?: number | null;
}

export interface QuoteVersion {
  readonly version: number;
  readonly total: number;
  readonly note: string | null;
  readonly lines: readonly QuoteLine[];
  readonly side: ProposalSide;
  readonly at: string;
}

/**
 * An item list, as either side reads it.
 *
 * **A quote is not a debt.** Nothing here is folded into any balance. The only
 * two things that leave this object and reach a ledger are a credit proposal
 * (`creditProposalId`, which produces one `CreditRecorded` when accepted) and a
 * settlement receipt (`settledEventId`, which is audit-only and produces
 * nothing at all). See ADR-0014.
 */
export interface Quote {
  readonly quoteId: string;
  readonly initiator: ProposalSide;
  readonly status: QuoteStatus;
  readonly version: number;
  readonly total: number;
  readonly lines: readonly QuoteLine[];
  readonly note: string | null;
  readonly partyId: string;
  readonly partyName: string;
  readonly shopId: string | null;
  readonly shopName: string;
  readonly expiresAt: string | null;
  readonly awaitingSide: ProposalSide | null;
  readonly creditProposalId: string | null;
  /** An **audit** event id. It moves no balance and is not a payment. */
  readonly settledEventId: string | null;
  readonly settledMethod: SettlementMethod | null;
  /**
   * True only when both sides confirmed. False for a shop's own record against
   * a customer who does not use Vyora — never to be shown as agreed.
   */
  readonly settledJointly: boolean | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly QuoteVersion[];
}

export const shopClient = {
  requestCode: (email: string) =>
    call<{ status: string; message: string }>(`${ROOT}/auth/request-code`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  /** Returns the person only. The token stays in the cookie, unreadable here. */
  verifyCode: (email: string, code: string) =>
    call<{ person: Person }>(`${ROOT}/auth/verify-code`, {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  me: () =>
    call<{ person: Person; memberships: ReadonlyArray<{ merchantId: string }> }>(
      `${ROOT}/auth/session`
    ),

  signOut: () => call<{ status: string }>(`${ROOT}/auth/session`, { method: "DELETE" }),

  listShops: () => call<{ items: ShopWithRole[] }>(`${ROOT}/shops`),

  createShop: (body: CreateShopBody) =>
    call<Shop>(`${ROOT}/shops`, { method: "POST", body: JSON.stringify(body) }),

  /**
   * Takes the **public** shop code, never the internal merchant id.
   *
   * This sent a `merchantId` once and every selection came back 400. The
   * contract accepts a `merchantId` in no request anywhere — that is the API's
   * first enforced rule — and this endpoint resolves membership by `public_id`.
   */
  selectActiveShop: (shopId: string) =>
    call<{ merchantId: string; shopId: string | null; name: string; role: string }>(
      `${ROOT}/shops/active`,
      { method: "POST", body: JSON.stringify({ shopId }) }
    ),

  lookupShop: (shopId: string) =>
    call<ShopVerification>(`${ROOT}/shops/lookup/${encodeURIComponent(shopId)}`),

  listDevices: () => call<{ items: Device[] }>(`${ROOT}/devices`),

  renameDevice: (deviceId: string, label: string | null) =>
    call<Device>(`${ROOT}/devices/${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      body: JSON.stringify({ label }),
    }),

  /**
   * Sign a phone out of this account.
   *
   * No confirmation flag is sent, and that is not an omission. The flag exists
   * for the case where the caller *is* the device being revoked, and a browser
   * never is — a device is a phone that registered an installation key, and
   * this one has not.
   */
  revokeDevice: (deviceId: string) =>
    call<null>(`${ROOT}/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  listShopMembers: () =>
    call<{ items: ShopMember[]; roleSummaries: RoleSummaries }>(`${ROOT}/members`),

  updateShopMembership: (
    personId: string,
    change: { role?: MembershipRole; status?: "active" | "inactive" }
  ) =>
    call<ShopMember>(`${ROOT}/members/${encodeURIComponent(personId)}`, {
      method: "PATCH",
      body: JSON.stringify(change),
    }),

  listShopInvitations: () => call<{ items: ShopInvitation[] }>(`${ROOT}/invitations`),

  createShopInvitation: (body: { email?: string; personId?: string; role: MembershipRole }) =>
    call<{ status: string; invitationId: string; message: string }>(`${ROOT}/invitations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cancelShopInvitation: (invitationId: string) =>
    call<null>(`${ROOT}/invitations/${encodeURIComponent(invitationId)}/cancel`, {
      method: "POST",
    }),

  /** Invitations addressed to me. Person-scoped — I am not in those shops yet. */
  listMyInvitations: () =>
    call<{ items: IncomingInvitation[]; roleSummaries: RoleSummaries }>(`${ROOT}/my-invitations`),

  acceptInvitation: (invitationId: string) =>
    call<{ merchantId: string; shopId: string | null; name: string; role: MembershipRole }>(
      `${ROOT}/my-invitations/${encodeURIComponent(invitationId)}/accept`,
      { method: "POST" }
    ),

  declineInvitation: (invitationId: string) =>
    call<null>(`${ROOT}/my-invitations/${encodeURIComponent(invitationId)}/decline`, {
      method: "POST",
    }),

  /**
   * The active shop's proposals.
   *
   * No shop parameter, deliberately. The shop comes from the person's
   * selection, held on the server, so a browser cannot ask for another shop's
   * requests by changing what it sends.
   */
  listProposals: () => call<{ items: Proposal[] }>(`${ROOT}/proposals`),

  /** Requests addressed to me personally, at anybody's shop. */
  listMyProposals: () => call<{ items: Proposal[] }>(`${ROOT}/my-proposals`),

  createProposal: (body: {
    partyId: string;
    type: ProposalType;
    /** Whole rupees. Never paise — see the `Money` schema in the contract. */
    amount: number;
    dueDate?: string | null;
    note?: string | null;
  }) => call<Proposal>(`${ROOT}/proposals`, { method: "POST", body: JSON.stringify(body) }),

  /**
   * Answer one. `version` is what the caller was looking at when they decided.
   *
   * The server refuses a stale version rather than applying it, which is what
   * stops somebody agreeing to a figure the other side has already changed.
   */
  answerProposal: (
    proposalId: string,
    action: "accept" | "reject" | "cancel",
    version: number,
    /**
     * Required for `accept`, which appends a ledger event.
     *
     * Minted by the caller with the intent, so a retry carries the same one.
     * This was missing when the route was written, and the API had been
     * refusing every acceptance from the browser with `400 Idempotency-Key
     * header is required` ever since.
     */
    idempotencyKey?: string
  ) =>
    call<Proposal>(`${ROOT}/proposals/${encodeURIComponent(proposalId)}/${action}`, {
      method: "POST",
      ...(idempotencyKey ? { headers: { "idempotency-key": idempotencyKey } } : {}),
      body: JSON.stringify({ version }),
    }),

  reviseProposal: (
    proposalId: string,
    body: { version: number; amount: number; dueDate?: string | null; note?: string | null }
  ) =>
    call<Proposal>(`${ROOT}/proposals/${encodeURIComponent(proposalId)}/revise`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Item lists ──────────────────────────────────────────────────────────────
  //
  // No shop parameter on the shop-side calls: the active shop is held on the
  // server, so a browser cannot ask for another shop's lists.

  listQuotes: () => call<{ items: Quote[] }>(`${ROOT}/quotes`),

  listMyQuotes: () => call<{ items: Quote[] }>(`${ROOT}/my-quotes`),

  createQuote: (body: { partyId: string; lines: QuoteLineInput[]; note?: string | null }) =>
    call<Quote>(`${ROOT}/quotes`, { method: "POST", body: JSON.stringify(body) }),

  /** A customer's list, by the shop's public code. No prices — those are the shop's. */
  createQuoteForShop: (shopId: string, body: { lines: QuoteLineInput[]; note?: string | null }) =>
    call<Quote>(`${ROOT}/shops/${encodeURIComponent(shopId)}/quotes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /**
   * Send a new version. Pricing is a revision like any other.
   *
   * Note the absence of a total: the server sums the lines, and there is no
   * field here through which a client could offer one.
   */
  reviseQuote: (
    quoteId: string,
    body: { version: number; lines: QuoteLineInput[]; note?: string | null }
  ) =>
    call<Quote>(`${ROOT}/quotes/${encodeURIComponent(quoteId)}/revise`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Agree, ask for credit, or withdraw. None of these move a balance. */
  answerQuote: (quoteId: string, action: "agree" | "credit" | "cancel", version: number) =>
    call<Quote>(`${ROOT}/quotes/${encodeURIComponent(quoteId)}/${action}`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),

  /**
   * Record that the bill was paid outside Vyora.
   *
   * The key is minted here, once, with the intent — not per request. A fresh
   * key on a retry is how one receipt becomes two.
   *
   * **This changes no balance.** Vyora saw no money; two people said so.
   */
  settleQuote: (
    quoteId: string,
    body: { version: number; method: SettlementMethod; note?: string | null },
    idempotencyKey: string
  ) =>
    call<Quote>(`${ROOT}/quotes/${encodeURIComponent(quoteId)}/settle`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    }),

  suggestLocalities: (pincode: string) =>
    call<{ pincode: string; localities: string[]; source: string; known: boolean }>(
      `${ROOT}/localities?${new URLSearchParams({ pincode })}`
    ),
};

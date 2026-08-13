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

  suggestLocalities: (pincode: string) =>
    call<{ pincode: string; localities: string[]; source: string; known: boolean }>(
      `${ROOT}/localities?${new URLSearchParams({ pincode })}`
    ),
};

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

export interface ShopMember extends Shop {
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

  listShops: () => call<{ items: ShopMember[] }>(`${ROOT}/shops`),

  createShop: (body: CreateShopBody) =>
    call<Shop>(`${ROOT}/shops`, { method: "POST", body: JSON.stringify(body) }),

  selectActiveShop: (merchantId: string) =>
    call<{ merchantId: string; shopId: string | null; name: string; role: string }>(
      `${ROOT}/shops/active`,
      { method: "POST", body: JSON.stringify({ merchantId }) }
    ),

  lookupShop: (shopId: string) =>
    call<ShopVerification>(`${ROOT}/shops/lookup/${encodeURIComponent(shopId)}`),

  suggestLocalities: (pincode: string) =>
    call<{ pincode: string; localities: string[]; source: string; known: boolean }>(
      `${ROOT}/localities?${new URLSearchParams({ pincode })}`
    ),
};

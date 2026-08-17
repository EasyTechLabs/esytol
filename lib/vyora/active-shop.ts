/**
 * Vyora — which shop this browser is working in (WEB-SYNC-003).
 *
 * Sync is shop-scoped: `/api/vyora-sync/*` requires an `x-vyora-shop` header and
 * refuses without one. Until now nothing in the browser remembered which shop
 * had been chosen — `ShopSetup` called `selectActiveShop` and navigated away,
 * and the choice lived only on the server as the person's default membership.
 * That is enough for a screen that asks the API a question and forgets; it is
 * not enough for a background sync that has to name a shop on every call.
 *
 * ## Why this may live in `localStorage`
 *
 * **It is not a credential and it grants nothing.** A merchant id names a shop;
 * it does not open one. Every request carrying this header is authenticated by
 * the session cookie the browser cannot read, and the API resolves the shop from
 * the *membership row* rather than from the header — a browser naming somebody
 * else's shop gets a `404` and learns only that it is not theirs, which is
 * asserted in the API's own tests. So the worst a tampered value achieves is
 * refusing to sync this browser.
 *
 * That is the same reasoning that keeps the session token in an `httpOnly`
 * cookie *and* keeps the shop id out of one: the token is the thing worth
 * stealing, and it is the thing the browser cannot touch.
 *
 * ## Why it is cleared on sign-out, then
 *
 * Not for secrecy — for isolation. The local book belongs to one shop, and the
 * next person to sign in on this browser must not open it. Forgetting the shop
 * is half of that; `clearAll` on the event store is the other half, and the two
 * happen together (see `signOutLocal`).
 */

export const ACTIVE_SHOP_KEY = "vyora.shop.v1";

/** The merchant id this browser is working in, or null. */
export function readActiveShop(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SHOP_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    // A browser with storage disabled entirely. Answering "no shop" leaves the
    // app working and unsynced, which is the honest outcome.
    return null;
  }
}

/**
 * Remember the shop that was just selected.
 *
 * Returns the previous shop when it differs, so the caller can decide what to do
 * about a book belonging to a different one. This function does not decide that
 * itself — erasing a merchant's local ledger is not a side effect a setter
 * should have.
 */
export function rememberActiveShop(merchantId: string): { readonly previous: string | null } {
  const previous = readActiveShop();
  if (typeof window === "undefined") return { previous };
  try {
    window.localStorage.setItem(ACTIVE_SHOP_KEY, merchantId);
  } catch {
    // Nothing to do. Sync will simply not start until the shop is selected
    // again, and the merchant's book is unaffected.
  }
  return { previous: previous === merchantId ? null : previous };
}

export function forgetActiveShop(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_SHOP_KEY);
  } catch {
    // Ignored for the same reason as above.
  }
}

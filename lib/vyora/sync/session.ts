/**
 * Vyora — starting and ending a browser's session with a shop (WEB-SYNC-003).
 *
 * Two events, and both are about isolation rather than secrecy:
 *
 *   sign out      this browser stops holding a shop's book
 *   switch shop   this browser starts holding a different one
 *
 * They do the same work for the same reason. The local store is a single book —
 * one IndexedDB database, no shop column, exactly as the `localStorage` ledger
 * before it was a single key. That is a deliberate simplification and it carries
 * one obligation: **whatever is in the store belongs to the shop named in
 * `active-shop`, and when that changes the store goes.**
 *
 * The cursor is the sharp edge. It is a position in *one* shop's log, and a
 * cursor kept across a switch would have the new shop's first pull start at the
 * old shop's position and skip everything before it — permanently, because a
 * cursor only moves forward. `clearAll` takes the cursor with the events, which
 * is why both live in the same store and are cleared by the same call.
 *
 * Nothing here talks to the network. Signing out of the *session* is
 * `shopClient.signOut()`, which deletes the httpOnly cookie on this app's own
 * server; this is the local half, and it runs whether or not that call
 * succeeded — a browser that failed to reach the server must still not be left
 * holding the book.
 */

import { forgetActiveShop, readActiveShop, rememberActiveShop } from "../active-shop";
import { clearLog } from "../store";
import { clearAll } from "./store";

/**
 * Erase the book, both copies of it.
 *
 * The `localStorage` log goes too. `clearAll` takes the migration marker with
 * the meta store, so leaving the original behind would have the next launch
 * migrate it straight back — the previous shop's entries reappearing inside the
 * new one, which is precisely the isolation this module exists to keep.
 */
async function erase(db: IDBDatabase): Promise<void> {
  await clearAll(db);
  clearLog();
}

/**
 * Forget the shop and erase this browser's copy of its book.
 *
 * Safe to call with no database — a browser on the `localStorage` fallback has
 * no IndexedDB store to clear, and its book is cleared through the repository
 * by the caller that owns it.
 */
export async function signOutLocal(db: IDBDatabase | null): Promise<void> {
  if (db) await erase(db);
  forgetActiveShop();
}

export type ShopSwitch =
  | { readonly kind: "same-shop" }
  | { readonly kind: "first-shop" }
  | { readonly kind: "switched"; readonly from: string };

/**
 * Point this browser at a shop, erasing another shop's book if one is held.
 *
 * Returns what happened, so a caller can reload rather than guess. The erase is
 * unconditional on a real switch and is not offered as a choice: there is
 * nowhere to put a second shop's events, and merging two books produces balances
 * belonging to neither.
 */
export async function enterShop(db: IDBDatabase | null, merchantId: string): Promise<ShopSwitch> {
  const current = readActiveShop();
  if (current === merchantId) return { kind: "same-shop" };

  if (current && db) await erase(db);
  rememberActiveShop(merchantId);

  return current ? { kind: "switched", from: current } : { kind: "first-shop" };
}

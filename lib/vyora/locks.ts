/**
 * Vyora — serialising ledger writes (WEB-MULTITAB-001).
 *
 * `saveLog` rewrites the whole log from one tab's memory. Two tabs each hold
 * their own `events` array, so the second to save overwrites everything the
 * first recorded since they both loaded. Measured at the real boundary: two
 * tabs recording ₹100 and ₹200 leave `[200]` on the device, and a credit in one
 * tab with a payment in the other loses the credit outright — after the merchant
 * has already been shown a success toast for it.
 *
 * The fix is not a lock on a button. The whole read-modify-write has to be
 * inside one critical section:
 *
 *     fresh read → execute the command against THAT state → append →
 *     persist log and clock floor → verify → hand back to the UI
 *
 * Re-reading inside the lock is the part that matters. Serialising two tabs that
 * each compute from a stale in-memory projection would still produce a log
 * missing one of them; the lock buys nothing unless the work it guards starts
 * from what is actually stored.
 *
 * ## Why this is async, and why it has to be
 *
 * `navigator.locks` is the only same-origin cross-tab mutex browsers offer, and
 * it is promise-based. There is no synchronous equivalent, so `dispatch` became
 * async. That is a consequence of the requirement rather than a preference.
 *
 * ## When the browser has no Web Locks
 *
 * The in-process queue below serialises writes *within one tab*, which is real
 * but is **not** cross-tab safety — a second tab in a different context shares
 * nothing with it. So capability detection is exported separately, and the
 * provider uses it to make extra tabs read-only rather than pretending they are
 * safe. See `writer.ts`.
 */

export const LEDGER_LOCK = "vyora.ledger.write";

interface LockManagerLike {
  request(name: string, callback: () => Promise<unknown>): Promise<unknown>;
}

function lockManager(): LockManagerLike | null {
  if (typeof navigator === "undefined") return null;
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

/**
 * Can this browser serialise across tabs?
 *
 * Read at the moment it is asked rather than cached at module load, so a test
 * can install or remove the capability and the answer follows.
 */
export function hasWebLocks(): boolean {
  return lockManager() !== null;
}

/**
 * Serialises writes inside this context when Web Locks is unavailable.
 *
 * A promise chain, not a timer: each write waits for the previous one to settle.
 * It cannot be skipped by a rejection, which is why both handlers are attached.
 */
let queue: Promise<unknown> = Promise.resolve();

export async function withLedgerLock<T>(run: () => Promise<T>): Promise<T> {
  const manager = lockManager();
  if (manager) {
    return manager.request(LEDGER_LOCK, run as () => Promise<unknown>) as Promise<T>;
  }

  const settled = queue.then(run, run);
  queue = settled.then(
    () => undefined,
    () => undefined
  );
  return settled;
}

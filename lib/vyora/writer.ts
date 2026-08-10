/**
 * Vyora — which tab may write when the browser cannot serialise (WEB-MULTITAB-001).
 *
 * `navigator.locks` is the only same-origin cross-tab mutex browsers offer. Where
 * it is missing there is **no** way to make two tabs write safely, so this does
 * not try. One tab holds a claim and may write; every other tab is read-only and
 * says so. That is a real restriction rather than a silent downgrade, which is
 * the point — telling a merchant their second tab is fine when it can erase
 * their first tab's entries would be worse than telling them it is read-only.
 *
 * ## The claim, and why it has a staleness window
 *
 * A tab releases its claim on `pagehide`. A tab that is killed — crash, force
 * quit, OS reclaiming a background page — never gets to. Without a staleness
 * window the merchant would be locked out of writing until they cleared site
 * data, which is a worse failure than the one being prevented.
 *
 * So a claim carries a timestamp, the holder refreshes it while it writes and
 * while the page is visible, and a claim nobody has touched for `STALE_AFTER_MS`
 * is considered abandoned. This is liveness detection, not a retry loop: nothing
 * here waits, polls for a lock, or races to acquire one.
 *
 * It is **best effort and documented as such**. Two tabs could both consider a
 * claim stale within the same instant and both take it. That window is small and
 * only reachable on browsers old enough to lack Web Locks — every current
 * engine has it — and it is strictly better than the status quo, where every tab
 * writes freely and the last one wins.
 */

const WRITER_KEY = "vyora.writer.v1";

export { WRITER_KEY };

/**
 * How long a claim survives without being touched.
 *
 * Long enough that a busy tab is never mistaken for a dead one, short enough
 * that a merchant who force-quits does not stare at a read-only ledger.
 */
export const STALE_AFTER_MS = 15_000;

interface Claim {
  readonly id: string;
  readonly at: number;
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function readClaim(): Claim | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(WRITER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Claim>;
    if (typeof parsed?.id !== "string" || typeof parsed?.at !== "number") return null;
    return { id: parsed.id, at: parsed.at };
  } catch {
    return null;
  }
}

function writeClaim(claim: Claim): boolean {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(WRITER_KEY, JSON.stringify(claim));
    return true;
  } catch {
    return false;
  }
}

/**
 * Take or keep the right to write in this tab.
 *
 * Succeeds when nothing holds the claim, when this tab already holds it, or when
 * the holder has gone quiet long enough to be considered gone.
 */
export function claimWriting(tabId: string, nowMs: number = Date.now()): boolean {
  const held = readClaim();
  const mine = held?.id === tabId;
  const abandoned = !held || nowMs - held.at > STALE_AFTER_MS;
  if (!mine && !abandoned) return false;
  return writeClaim({ id: tabId, at: nowMs });
}

/**
 * Does a *different* tab currently hold the claim? A read, with no side effect.
 *
 * This is what a tab checks on open. Merely being open must not take the claim:
 * a session that only reads — or one using the remote party source, which never
 * touches the device log at all — should write nothing to storage. The claim is
 * taken at the first actual write, which is the moment exclusivity matters.
 */
export function writerElsewhere(tabId: string, nowMs: number = Date.now()): boolean {
  const held = readClaim();
  if (!held || held.id === tabId) return false;
  return nowMs - held.at <= STALE_AFTER_MS;
}

/** Is this tab the writer right now? A read, with no side effect. */
export function isWriting(tabId: string, nowMs: number = Date.now()): boolean {
  const held = readClaim();
  if (!held) return false;
  if (held.id !== tabId) return false;
  return nowMs - held.at <= STALE_AFTER_MS;
}

/**
 * Give up the claim, so the next tab can write immediately rather than waiting
 * out the staleness window. Only the holder may release it — a tab that never
 * held it must not be able to evict the one that does.
 */
export function releaseWriting(tabId: string): void {
  if (!hasWindow()) return;
  try {
    const held = readClaim();
    if (held?.id !== tabId) return;
    window.localStorage.removeItem(WRITER_KEY);
  } catch {
    // Nothing to do: a claim we cannot remove simply expires.
  }
}

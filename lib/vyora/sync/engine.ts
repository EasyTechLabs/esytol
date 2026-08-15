/**
 * Vyora — the one place that synchronises (WEB-SYNC-002).
 *
 * There is exactly one orchestrator, and screens do not call push or pull. They
 * ask for a sync and get the same in-flight one as everybody else. That is a
 * correctness requirement rather than tidiness: five components each running
 * their own cycle would push the same batch five times, and while the server
 * would deduplicate every copy, the browser would have spent five round trips
 * to learn what one would have told it.
 *
 * ## The cycle
 *
 *     PUSH ─► PULL ─► APPLY ─► ADVANCE CURSOR ─► SYNCED
 *
 * **Push first.** The server's log then already contains this browser's work
 * before we ask what we are missing, so one round trip converges instead of
 * two. It also means a pull can never be blamed for a push that had not
 * happened yet.
 *
 * **The cursor advances only with the page it describes.** Both are written in
 * one IndexedDB transaction (`applyPage`), so a browser closed mid-page replays
 * that page rather than stepping over it. Replay is free because storing an
 * event already held is a no-op.
 *
 * **A failed push never discards queued work.** Nothing here deletes a pending
 * event except on the server's own acknowledgement, and `duplicate` counts as
 * one — it means the server already holds that id, which is what a retry after
 * an unknown outcome produces.
 *
 * ## What holds the lock, and why it is the same lock
 *
 * Sync runs inside `withLedgerLock`, the mutex WEB-MULTITAB-001 introduced for
 * ledger writes. Not a second lock of its own: applying a pulled page *is* a
 * ledger write, and two mutexes guarding one resource is a race with extra
 * steps. Two tabs therefore cannot sync at once, and a sync cannot interleave
 * with a merchant recording a payment in another tab.
 */

import { withLedgerLock } from "../locks";
import { reduceEvents, type LedgerEvent } from "../events";
import type { VyoraData } from "../types";
import { pullEvents, pushEvents, type ApiOutcome, type SyncFetchOptions } from "./client";
import { fromRemoteEvent, toBatch, SCHEMA_VERSION } from "./protocol";
import {
  applyPage,
  countPending,
  markConfirmed,
  readLog,
  readMeta,
  readPending,
  writeMeta,
} from "./store";

/**
 * What the merchant is shown, and nothing more technical than this.
 *
 * `conflict` is absent deliberately. The web client sends whole events rather
 * than field updates, and an event is never refused for being stale — two
 * clients editing the same contact produce two events, both true, folded in
 * order. There is no state here for a merchant to resolve, so inventing one to
 * fill out a diagram would be inventing a worry.
 */
export type SyncState =
  "idle" | "auth-required" | "pushing" | "pulling" | "synced" | "offline" | "retry-wait" | "error";

export interface SyncSnapshot {
  readonly state: SyncState;
  readonly pending: number;
  readonly lastSyncAt: string | null;
  /** A sentence for the merchant, or null. Never a code, never a stack. */
  readonly message: string | null;
}

export interface SyncOutcome {
  readonly state: SyncState;
  readonly pushed: number;
  readonly rejected: number;
  readonly pulled: number;
  readonly pages: number;
  readonly message: string | null;
}

/** Pages taken in one sync before yielding, so a month away cannot hang a screen. */
export const MAX_PAGES_PER_SYNC = 10;
/** Events per push. The contract's ceiling is 500. */
export const MAX_EVENTS_PER_PUSH = 200;
export const PULL_PAGE_SIZE = 200;

export const LAST_SYNC_KEY = "lastSyncAt";
export const CURSOR_KEY = "cursor";
/** Minted once per batch and reused for every attempt at that batch. */
export const PUSH_KEY_KEY = "pushIdempotencyKey";

export interface EngineOptions extends SyncFetchOptions {
  readonly db: IDBDatabase;
  readonly now?: () => string;
  readonly newKey?: () => string;
}

function defaultKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.round(Math.random() * 1e9).toString(36)}`;
}

/** The state an unhappy outcome maps to. One place, so the UI cannot drift. */
function stateFor<T>(outcome: ApiOutcome<T>): SyncState {
  switch (outcome.kind) {
    case "auth":
      return "auth-required";
    case "retry":
      return "offline";
    case "permanent":
      return "error";
    default:
      return "synced";
  }
}

/**
 * Send what this browser owes.
 *
 * The idempotency key is stored *before* the request and cleared only once the
 * server has answered. A key regenerated per attempt would make every retry a
 * new batch as far as the server's replay cache is concerned — so it is minted
 * once, with the intent, exactly as the mobile outbox does.
 */
async function push(options: EngineOptions): Promise<{
  outcome: ApiOutcome<unknown> | null;
  pushed: number;
  rejected: number;
}> {
  const pending = await readPending(options.db, MAX_EVENTS_PER_PUSH);
  if (pending.length === 0) return { outcome: null, pushed: 0, rejected: 0 };

  const events = toBatch(pending.map((row) => row.event));
  if (events.length === 0) {
    // Everything queued was a snapshot event, which sync never carries. They
    // are confirmed locally so the queue drains rather than retrying forever
    // against a boundary that will always refuse them.
    await markConfirmed(
      options.db,
      pending.map((row) => ({ eventId: row.id, recordedAt: row.event.at }))
    );
    return { outcome: null, pushed: 0, rejected: 0 };
  }

  const stored = await readMeta<string>(options.db, PUSH_KEY_KEY);
  const key = stored ?? (options.newKey ?? defaultKey)();
  if (!stored) await writeMeta(options.db, PUSH_KEY_KEY, key);

  const outcome = await pushEvents({ schemaVersion: SCHEMA_VERSION, events }, key, options);
  if (outcome.kind !== "ok") return { outcome, pushed: 0, rejected: 0 };

  await writeMeta<string | null>(options.db, PUSH_KEY_KEY, null);

  // Accepted and duplicate are both successes and are treated identically.
  const acknowledged = [...outcome.value.accepted, ...outcome.value.duplicate];
  await markConfirmed(options.db, acknowledged);

  // A rejected event is left pending on purpose. It is one specific event the
  // server will not take — a build older than the contract, most likely — and
  // dropping it would delete something the merchant recorded. It stays, it is
  // counted, and it is visible.
  return { outcome, pushed: acknowledged.length, rejected: outcome.value.rejected.length };
}

/** Take what this browser is owed, one page at a time. */
async function pull(options: EngineOptions): Promise<{
  outcome: ApiOutcome<unknown> | null;
  pulled: number;
  pages: number;
}> {
  let pulled = 0;
  let pages = 0;

  while (pages < MAX_PAGES_PER_SYNC) {
    // Re-read each time: the cursor advanced inside the previous page's
    // transaction, so reading it back is what guarantees we resume from what
    // was committed rather than from what we believe we sent.
    const cursor = await readMeta<string>(options.db, CURSOR_KEY);
    const outcome = await pullEvents(cursor, PULL_PAGE_SIZE, options);
    if (outcome.kind !== "ok") return { outcome, pulled, pages };

    const page = outcome.value;
    const incoming: { event: LedgerEvent; recordedAt: string }[] = [];
    for (const remote of page.events) {
      const event = fromRemoteEvent(remote);
      // Null is a snapshot event, which sync refuses in both directions. It is
      // skipped rather than stored: applying one out of order would discard
      // newer events from another client.
      if (event) incoming.push({ event, recordedAt: remote.recordedAt });
    }

    if (incoming.length === 0) {
      // Nothing to apply. The cursor is left exactly as it is — the server
      // echoes the one we sent when a page is empty, and rewriting it would be
      // a no-op that still looks like progress in the record.
      return { outcome, pulled, pages };
    }

    const result = await applyPage(options.db, incoming, page.nextCursor);
    pulled += result.applied;
    pages += 1;

    if (!page.hasMore) return { outcome, pulled, pages };
  }

  return { outcome: null, pulled, pages };
}

/**
 * One full cycle. Not exported — everything goes through `sync`.
 */
async function runCycle(options: EngineOptions): Promise<SyncOutcome> {
  const pushResult = await push(options);
  if (pushResult.outcome && pushResult.outcome.kind !== "ok") {
    return {
      state: stateFor(pushResult.outcome),
      pushed: 0,
      rejected: 0,
      pulled: 0,
      pages: 0,
      message: pushResult.outcome.message,
    };
  }

  const pullResult = await pull(options);
  if (pullResult.outcome && pullResult.outcome.kind !== "ok") {
    // The push half already succeeded and stays succeeded. Flattening the two
    // into one "sync failed" would hide that the merchant's work is safely on
    // the server and this browser is merely behind.
    return {
      state: stateFor(pullResult.outcome),
      pushed: pushResult.pushed,
      rejected: pushResult.rejected,
      pulled: pullResult.pulled,
      pages: pullResult.pages,
      message: pullResult.outcome.message,
    };
  }

  const now = (options.now ?? (() => new Date().toISOString()))();
  await writeMeta(options.db, LAST_SYNC_KEY, now);

  return {
    state: pushResult.rejected > 0 ? "error" : "synced",
    pushed: pushResult.pushed,
    rejected: pushResult.rejected,
    pulled: pullResult.pulled,
    pages: pullResult.pages,
    message:
      pushResult.rejected > 0
        ? "Some entries could not be sent. Update Vyora and try again."
        : null,
  };
}

/**
 * Sync now — or join the sync already running.
 *
 * Every trigger the mission names (startup, sign-in, a local mutation, coming
 * back online, the merchant pressing the button) lands here, and concurrent
 * callers share one promise. That is the whole anti-storm mechanism, and it is
 * one variable rather than a scheduler: a queue of deferred syncs would still
 * be a queue of round trips, and there is nothing a second immediate cycle can
 * learn that the first has not just asked.
 */
let inFlight: Promise<SyncOutcome> | null = null;

export function isSyncing(): boolean {
  return inFlight !== null;
}

export async function sync(options: EngineOptions): Promise<SyncOutcome> {
  if (inFlight) return inFlight;
  inFlight = withLedgerLock(() => runCycle(options)).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** For tests, which must not inherit a promise from the previous case. */
export function resetInFlight(): void {
  inFlight = null;
}

// ── What the screens read ────────────────────────────────────────────────────

export async function readSnapshot(db: IDBDatabase, state: SyncState): Promise<SyncSnapshot> {
  return {
    state,
    pending: await countPending(db),
    lastSyncAt: await readMeta<string>(db, LAST_SYNC_KEY),
    message: null,
  };
}

/** The projection every screen ultimately reads, folded from the stored log. */
export async function projectionFrom(db: IDBDatabase): Promise<VyoraData> {
  return reduceEvents(await readLog(db));
}

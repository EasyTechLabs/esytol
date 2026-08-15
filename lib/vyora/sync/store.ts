/**
 * Vyora — the sync-capable event store (WEB-SYNC-002).
 *
 * The ledger has always been an event log; what changes here is *where* it
 * lives. `store.ts` keeps the whole log in one `localStorage` key and rewrites
 * the entire string on every append. That is fine for a book only this browser
 * writes to, and it stops being fine the moment a second client can add to it:
 *
 *  - the origin cap is a hard ~5 MB shared with everything else on the domain,
 *    and a synced log accumulates other people's entries as well as this
 *    browser's;
 *  - re-serialising E events per append is O(E²) over a session, which is the
 *    exact shape ENG-010 spent a milestone removing from the *fold*. Putting it
 *    back in the *write* path would have been a poor trade.
 *
 * So the log moves to IndexedDB, where an append is one record.
 *
 * ## Ordering, which is the whole design
 *
 * A projection is a fold, so the order events are folded in *is* the answer.
 * Two clients that hold the same events in different orders can show different
 * balances, and "eventually consistent" is not a thing to say to someone about
 * their money.
 *
 * Every record therefore carries an `order` key, and the fold reads the log in
 * that key's order:
 *
 *     confirmed   "2026-08-15T09:14:22.115Z|evt_7f3a…"   the server's own order
 *     pending     "~000000000000042"                     this browser's order
 *
 * Confirmed events sort by the server's `recordedAt` — the same
 * `(recorded_at, event_id)` ordering a cursor walks — and pending events sort
 * after all of them, because `~` (0x7E) is greater than any digit an ISO
 * timestamp can start with. So the log reads as *the shared history, then the
 * work this browser has not sent yet*, and the moment a pending event is
 * acknowledged it takes its true place in the shared part.
 *
 * That is what makes convergence a property rather than a hope: once every
 * client has pushed, every client folds the identical sequence.
 *
 * ## Availability is not assumed
 *
 * A browser in private mode, or an old one, may have no IndexedDB at all.
 * `isAvailable` answers honestly and the caller keeps the merchant on the
 * existing `localStorage` ledger rather than showing them an empty book. Sync
 * is an addition to this product, never a precondition for using it.
 */

import type { LedgerEvent } from "../events";

export const DB_NAME = "vyora";
export const DB_VERSION = 1;
export const EVENTS_STORE = "events";
export const META_STORE = "meta";

/** How a stored event is ordered, and whether the server has it yet. */
export type EventState = "pending" | "confirmed";

export interface StoredEvent {
  /** Assigned by IndexedDB. Insertion order, and the tiebreak for pending. */
  readonly seq?: number;
  /** The event's own id — `evt_…`, minted once and never regenerated. */
  readonly id: string;
  readonly state: EventState;
  /** The server's clock, once it has one. Null while pending. */
  readonly recordedAt: string | null;
  /** Sort key. See the module note — this is the fold order. */
  readonly order: string;
  readonly event: LedgerEvent;
}

/** Sort key for an event the server has accepted. */
export function confirmedOrder(recordedAt: string, id: string): string {
  return `${recordedAt}|${id}`;
}

/**
 * Sort key for an event this browser is still holding.
 *
 * The event's own instant, behind a `~` so all pending work sorts after all
 * confirmed work. That instant is already strictly monotonic per device —
 * `nowISO` "never equal to, and never before, the last one", which
 * WEB-LEDGER-ORDERING-001 introduced for exactly this class of problem — so it
 * needs no counter of its own.
 *
 * Using it rather than the record's `seq` is what lets an append be a single
 * write. `seq` does not exist until the record has been added, so ordering by
 * it meant add-then-patch: two writes and an index update per entry, which the
 * benchmark showed getting slower as the book grew.
 *
 * Two events that do share an instant — a log migrated from v1 carries entity
 * `createdAt` values rather than clock instants, and two tabs each hold their
 * own counter — tie, and IndexedDB breaks a tie in an index by primary key.
 * That is `seq`, which is insertion order. The fallback is the guarantee that
 * was wanted anyway.
 */
export function pendingOrder(at: string): string {
  return `~${at}`;
}

export function isAvailable(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!isAvailable()) return Promise.reject(new Error("IndexedDB is not available"));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const events = db.createObjectStore(EVENTS_STORE, { keyPath: "seq", autoIncrement: true });
        // Unique, and that uniqueness is the local half of idempotency: an
        // event that arrives twice — pulled back after being pushed, or
        // replayed after a crash mid-page — cannot be stored twice.
        events.createIndex("by_id", "id", { unique: true });
        events.createIndex("by_order", "order", { unique: false });
        events.createIndex("by_state", "state", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the Vyora database"));
  });
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export async function readMeta<T>(db: IDBDatabase, key: string): Promise<T | null> {
  const tx = db.transaction(META_STORE, "readonly");
  const row = await request<{ key: string; value: T } | undefined>(
    tx.objectStore(META_STORE).get(key)
  );
  return row ? row.value : null;
}

export async function writeMeta<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put({ key, value });
  await finished(tx);
}

// ── Reading the log ──────────────────────────────────────────────────────────

/**
 * The whole log, in fold order.
 *
 * One index scan. The caller folds it with the existing `reduceEvents`, so
 * there is exactly one implementation of what an event means — the sync layer
 * adds a place to keep events and never a second opinion about them.
 */
export async function readLog(db: IDBDatabase): Promise<LedgerEvent[]> {
  const tx = db.transaction(EVENTS_STORE, "readonly");
  const rows = await request<StoredEvent[]>(
    tx.objectStore(EVENTS_STORE).index("by_order").getAll()
  );
  return rows.map((row) => row.event);
}

/** Everything still waiting to be sent, oldest first. */
export async function readPending(db: IDBDatabase, limit = 500): Promise<StoredEvent[]> {
  const tx = db.transaction(EVENTS_STORE, "readonly");
  const rows = await request<StoredEvent[]>(
    tx.objectStore(EVENTS_STORE).index("by_state").getAll(IDBKeyRange.only("pending"))
  );
  rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  return rows.slice(0, limit);
}

export async function countEvents(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(EVENTS_STORE, "readonly");
  return request<number>(tx.objectStore(EVENTS_STORE).count());
}

export async function countPending(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(EVENTS_STORE, "readonly");
  return request<number>(
    tx.objectStore(EVENTS_STORE).index("by_state").count(IDBKeyRange.only("pending"))
  );
}

export async function hasEvent(db: IDBDatabase, id: string): Promise<boolean> {
  const tx = db.transaction(EVENTS_STORE, "readonly");
  const found = await request<StoredEvent | undefined>(
    tx.objectStore(EVENTS_STORE).index("by_id").get(id)
  );
  return found !== undefined;
}

// ── Writing the log ──────────────────────────────────────────────────────────

/**
 * Record something the merchant just did.
 *
 * One write. The order key comes from the event's own instant rather than from
 * the auto-generated `seq`, so nothing has to be read back or patched — see
 * `pendingOrder`.
 */
export async function appendLocal(db: IDBDatabase, event: LedgerEvent): Promise<StoredEvent> {
  const row = {
    id: event.id,
    state: "pending" as const,
    recordedAt: null,
    order: pendingOrder(event.at),
    event,
  };
  const tx = db.transaction(EVENTS_STORE, "readwrite");
  const seq = (await request<IDBValidKey>(tx.objectStore(EVENTS_STORE).add(row))) as number;
  await finished(tx);
  return { ...row, seq };
}

/**
 * Store events pulled from the server, and advance the cursor — together.
 *
 * One IndexedDB transaction spans both stores, so the cursor can only move if
 * the page it describes was actually written. A crash between the two is the
 * failure that silently loses a page forever, and it is prevented here rather
 * than compensated for later. It is the same rule the mobile client follows and
 * the same rule the server's own batch follows.
 *
 * Events already held are skipped, not overwritten: the local copy may be the
 * very one this browser pushed, and re-writing it would move its place in the
 * fold.
 */
export async function applyPage(
  db: IDBDatabase,
  incoming: readonly { event: LedgerEvent; recordedAt: string }[],
  nextCursor: string | null
): Promise<{ applied: number; skipped: number }> {
  const tx = db.transaction([EVENTS_STORE, META_STORE], "readwrite");
  const store = tx.objectStore(EVENTS_STORE);
  const byId = store.index("by_id");

  let applied = 0;
  let skipped = 0;

  for (const item of incoming) {
    const existing = await request<StoredEvent | undefined>(byId.get(item.event.id));
    if (existing) {
      // Already held. If this browser pushed it and has not been told the
      // server's clock yet, take that now — it is what moves the event out of
      // the pending tail and into its true place in the shared history.
      if (existing.state === "pending") {
        store.put({
          ...existing,
          state: "confirmed" as const,
          recordedAt: item.recordedAt,
          order: confirmedOrder(item.recordedAt, item.event.id),
        });
      }
      skipped += 1;
      continue;
    }
    store.add({
      id: item.event.id,
      state: "confirmed",
      recordedAt: item.recordedAt,
      order: confirmedOrder(item.recordedAt, item.event.id),
      event: item.event,
    });
    applied += 1;
  }

  if (nextCursor !== null) {
    tx.objectStore(META_STORE).put({ key: "cursor", value: nextCursor });
  }

  await finished(tx);
  return { applied, skipped };
}

/**
 * Mark events the server has accepted.
 *
 * `duplicate` is an acceptance, not an error: it means the server already holds
 * that id, which is exactly what a retry after an unknown outcome produces.
 * Treating it as a failure is how an outbox comes to never drain.
 */
export async function markConfirmed(
  db: IDBDatabase,
  acknowledged: readonly { eventId: string; recordedAt: string }[]
): Promise<number> {
  if (acknowledged.length === 0) return 0;
  const tx = db.transaction(EVENTS_STORE, "readwrite");
  const store = tx.objectStore(EVENTS_STORE);
  const byId = store.index("by_id");

  let marked = 0;
  for (const ack of acknowledged) {
    const existing = await request<StoredEvent | undefined>(byId.get(ack.eventId));
    if (!existing) continue;
    store.put({
      ...existing,
      state: "confirmed" as const,
      recordedAt: ack.recordedAt,
      order: confirmedOrder(ack.recordedAt, ack.eventId),
    });
    marked += 1;
  }
  await finished(tx);
  return marked;
}

/**
 * Erase this browser's copy — for signing out, or switching shops.
 *
 * Everything goes, including the cursor: a cursor is a position in one shop's
 * log, and keeping it across a sign-out would have the next person's first pull
 * start from where the last person got to.
 */
export async function clearAll(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([EVENTS_STORE, META_STORE], "readwrite");
  tx.objectStore(EVENTS_STORE).clear();
  tx.objectStore(META_STORE).clear();
  await finished(tx);
}

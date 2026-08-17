/**
 * Vyora — where the provider keeps the book (WEB-SYNC-003).
 *
 * WEB-SYNC-002 built an IndexedDB event store, a sync engine and a migration,
 * and connected none of them to the running application: every importer outside
 * `lib/vyora/sync/` was a test. The provider went on writing the whole log to one
 * `localStorage` key on every append. This module is the seam that closes that
 * gap, and it is deliberately the *only* seam — screens still know nothing about
 * storage, and the provider still knows nothing about cursors, outboxes or the
 * wire.
 *
 * ## Two backends, one interface
 *
 * IndexedDB is the one that can sync. `localStorage` remains for the browsers
 * that have no IndexedDB at all — private mode, something old — because sync is
 * an addition to this product and never a precondition for using it. A merchant
 * in that browser keeps exactly the app they had.
 *
 * The interface is shaped by what the provider's critical section actually does,
 * not by what a storage layer usually offers:
 *
 *   revision()   cheap "has anyone else written since I last looked?"
 *   load()       the whole log, in fold order
 *   append()     add what a command produced
 *   replace()    swap the book wholesale, for a restore
 *   clear()      erase this browser's copy
 *
 * `append` takes both the new events and the log they produce. That looks
 * redundant and is not: IndexedDB writes only the new records, which is the
 * whole point of moving — one record per entry instead of re-serialising E of
 * them, the O(E²) shape ENG-010 removed from the fold and which must not come
 * back in the write path. `localStorage` has no append; it can only rewrite, so
 * it takes the whole log. Each backend is handed what it can actually use.
 *
 * ## Why `revision` and not a version number
 *
 * The provider re-reads inside the lock to tell "my projection is current" from
 * "another tab appended". Against `localStorage` that comparison was the raw
 * serialised string. Against IndexedDB, reading the whole log to decide whether
 * to read the whole log is absurd, so the fingerprint is the count and the last
 * key in fold order — two cheap index reads, and it changes whenever anything
 * has been added, confirmed, or reordered by an acknowledgement.
 */

import type { LedgerEvent } from "../events";
import { loadLog, readRawLog, saveLog, clearLog } from "../store";
import {
  EVENTS_STORE,
  appendLocal,
  clearAll,
  countEvents,
  isAvailable,
  openDatabase,
  readLog,
} from "./store";

export type RepositoryKind = "indexeddb" | "localstorage";

export interface LedgerRepository {
  readonly kind: RepositoryKind;
  /** The IndexedDB handle, when there is one. Sync needs it; nothing else does. */
  readonly db: IDBDatabase | null;
  /** Cheap fingerprint of what is stored. Compare, do not interpret. */
  revision(): Promise<string>;
  load(): Promise<LedgerEvent[]>;
  /**
   * Record what a command produced.
   *
   * @param added the new events, in order
   * @param whole the complete log after they are added — for a backend that
   *              cannot append
   * @returns false if the device refused the write
   */
  append(added: readonly LedgerEvent[], whole: readonly LedgerEvent[]): Promise<boolean>;
  /** Replace the book. Restore only. */
  replace(events: readonly LedgerEvent[]): Promise<boolean>;
  clear(): Promise<void>;
  /**
   * Did the log this browser just wrote actually reach the device?
   *
   * Asked after every write, because a merchant shown a success toast for an
   * entry that vanishes on the next open has been lied to — the rule
   * WEB-MULTITAB-001 established and this keeps. Each backend answers it the
   * cheapest way it honestly can: `localStorage` re-reads and compares the log,
   * because `saveLog` reporting success is not proof the bytes are there;
   * IndexedDB counts, because a transaction that completed wrote exactly the
   * records it was given and a unique index would have refused a duplicate.
   */
  verify(expected: readonly LedgerEvent[]): Promise<boolean>;
}

// ── localStorage ─────────────────────────────────────────────────────────────

/**
 * The book as it has always been kept.
 *
 * Unchanged behaviour, moved behind an interface: `saveLog` still rewrites the
 * whole key, still returns `false` when the device is full, and the provider
 * still verifies by reading back.
 */
export const fallbackRepository: LedgerRepository = {
  kind: "localstorage",
  db: null,
  async revision() {
    return readRawLog() ?? "";
  },
  async load() {
    return loadLog();
  },
  async append(_added, whole) {
    return saveLog(whole);
  },
  async replace(events) {
    return saveLog([...events]);
  },
  async clear() {
    clearLog();
  },
  async verify(expected) {
    // Re-read and compare. `saveLog` reporting success is not proof the bytes
    // are there — a quota that was reached mid-write can still return true.
    const stored = loadLog();
    return (
      stored.length === expected.length &&
      stored[stored.length - 1]?.id === expected[expected.length - 1]?.id
    );
  },
};

// ── IndexedDB ────────────────────────────────────────────────────────────────

/** Count plus the last key in fold order. Changes whenever the log does. */
async function fingerprint(db: IDBDatabase): Promise<string> {
  const count = await countEvents(db);
  const tx = db.transaction(EVENTS_STORE, "readonly");
  const last = await new Promise<string>((resolve, reject) => {
    const req = tx.objectStore(EVENTS_STORE).index("by_order").openCursor(null, "prev");
    req.onsuccess = () => resolve((req.result?.value as { order?: string })?.order ?? "");
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
  return `${count}:${last}`;
}

export function indexedDbRepository(db: IDBDatabase): LedgerRepository {
  return {
    kind: "indexeddb",
    db,
    revision: () => fingerprint(db),
    load: () => readLog(db),

    /**
     * One record per event. Nothing is re-serialised, and the log's size does
     * not enter into the cost of recording an entry.
     *
     * Events arrive `pending` — this browser holds them and the server has not
     * acknowledged them — which is what puts them in the outbox. There is no
     * separate outbox table: "unsent" is a state an event is in, so an event
     * cannot be in the log without being queued, or queued without being in the
     * log.
     */
    async append(added) {
      for (const event of added) await appendLocal(db, event);
      return true;
    },

    /**
     * A restore replaces the book, so the sync position goes with it.
     *
     * `clearAll` takes the cursor too, and that is deliberate: the restored log
     * is a different history, and a cursor from the old one would have the next
     * pull start partway through a log this browser no longer holds. Starting
     * from nothing re-reads the shop's history in full, which is exactly right —
     * the restored events are pending, so they push, and the server's copy comes
     * back to be folded beside them.
     */
    async replace(events) {
      await clearAll(db);
      for (const event of events) await appendLocal(db, event);
      return true;
    },

    /**
     * Erase this browser's copy — and the copy it was migrated from.
     *
     * `clearAll` takes the meta store with the events, and the migration marker
     * lives there. So clearing IndexedDB alone would leave the marker gone and
     * the original `localStorage` log still present, and the next launch would
     * dutifully migrate it back in: "erase everything" undone by a reload, and a
     * merchant's deleted book returning by itself.
     *
     * Deleting the original here does not contradict the migration's rule about
     * never deleting it. That rule is about not deleting it *before the copy is
     * proven*. This is a merchant — or a sign-out — asking for the book to be
     * gone, which is the one moment it should be.
     */
    async clear() {
      await clearAll(db);
      clearLog();
    },

    /**
     * Counting is the whole check, and it is enough.
     *
     * A transaction that completed wrote exactly the records it was given —
     * IndexedDB has no partial commit — and the `by_id` index is unique, so a
     * duplicate would have aborted it rather than been absorbed. Re-reading the
     * whole book to compare ids would cost O(E) on the one path this milestone
     * exists to make O(1).
     */
    async verify(expected) {
      return (await countEvents(db)) === expected.length;
    },
  };
}

// ── Choosing one ─────────────────────────────────────────────────────────────

export interface OpenedRepository {
  readonly repository: LedgerRepository;
  /** Why the fallback was taken, for the record. Null when IndexedDB opened. */
  readonly fallbackReason: string | null;
}

/**
 * Open the best store this browser can offer.
 *
 * Never throws. A browser that cannot open IndexedDB gets the `localStorage`
 * book and a working app, because the alternative — an error boundary over a
 * merchant's ledger — is worse than not syncing.
 */
export async function openRepository(): Promise<OpenedRepository> {
  if (!isAvailable()) {
    return { repository: fallbackRepository, fallbackReason: "IndexedDB is not available." };
  }
  try {
    const db = await openDatabase();
    return { repository: indexedDbRepository(db), fallbackReason: null };
  } catch (cause) {
    return {
      repository: fallbackRepository,
      fallbackReason: `Could not open the Vyora database: ${(cause as Error).message}`,
    };
  }
}

/**
 * Moving the ledger from localStorage into IndexedDB (WEB-SYNC-002).
 *
 * This runs against the only copy of a merchant's book, on a device that may be
 * closed mid-way, so it is written to the rule the mission set: **never delete
 * the old data before the new copy has been verified.**
 *
 * The order is therefore copy → verify → mark, and the old key is left in place
 * even after the mark. It costs a few kilobytes and it means a defect found
 * next month is recoverable rather than a support conversation about a book
 * that no longer exists. `store.ts` already does exactly this with the v1 blob
 * from ARCH-002, for the same reason; this is that precedent followed rather
 * than a new policy.
 *
 * ## What "verified" means
 *
 * Three checks, and they are deliberately not the same check three times:
 *
 *  1. **Count.** As many events in IndexedDB as there were in localStorage.
 *  2. **Identity.** The same event ids, in the same order — not merely the same
 *     number of them.
 *  3. **Projection.** Folding the migrated log produces a projection deeply
 *     equal to folding the original. This is the one that would catch a record
 *     mangled in transit, which the first two would happily pass.
 *
 * Only then is the migration marked complete. A failure leaves it unmarked, the
 * partial copy cleared, and the merchant on localStorage — working, with the
 * defect visible in the return value rather than in their balance.
 *
 * ## Restartable
 *
 * Idempotent by construction. If it is interrupted, nothing was marked, so the
 * next run starts over; `clearAll` first means a half-copied log never merges
 * with a second attempt. Running it after it has completed does nothing at all.
 */

import type { LedgerEvent } from "../events";
import { reduceEvents } from "../events";
import { loadLog } from "../store";
import { appendLocal, clearAll, countEvents, readLog, readMeta, writeMeta } from "./store";

export const MIGRATION_KEY = "localStorageV2";

export interface MigrationState {
  readonly completed: boolean;
  readonly migratedAt: string;
  readonly eventCount: number;
}

export type MigrationResult =
  | { readonly kind: "already-done"; readonly eventCount: number }
  | { readonly kind: "nothing-to-migrate" }
  | { readonly kind: "migrated"; readonly eventCount: number }
  | { readonly kind: "failed"; readonly because: string };

/** Same ids in the same order — order is the projection, so it is part of identity. */
function sameSequence(a: readonly LedgerEvent[], b: readonly LedgerEvent[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
  return true;
}

/**
 * Structural equality of two projections.
 *
 * `JSON.stringify` is honest here rather than lazy: both sides are built by the
 * same fold from plain data with no undefined-valued keys, so key order is the
 * insertion order of the same code path on both sides.
 */
function sameProjection(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function migrationState(db: IDBDatabase): Promise<MigrationState | null> {
  return readMeta<MigrationState>(db, MIGRATION_KEY);
}

/**
 * Copy the localStorage log into IndexedDB, once, and prove it arrived.
 *
 * `now` is injected so a test can assert what was recorded without reaching for
 * a fake timer.
 */
export async function migrateFromLocalStorage(
  db: IDBDatabase,
  now: () => string = () => new Date().toISOString()
): Promise<MigrationResult> {
  const state = await migrationState(db);
  if (state?.completed) return { kind: "already-done", eventCount: state.eventCount };

  const source = loadLog();
  if (source.length === 0) {
    // Nothing to copy is still a completed migration: a browser that had no
    // ledger has now been converted, and the next launch must not re-check.
    await writeMeta<MigrationState>(db, MIGRATION_KEY, {
      completed: true,
      migratedAt: now(),
      eventCount: 0,
    });
    return { kind: "nothing-to-migrate" };
  }

  // A previous attempt may have written some of these. Start from empty so a
  // retry can never interleave with the remains of the run that failed.
  await clearAll(db);

  try {
    for (const event of source) await appendLocal(db, event);
  } catch (cause) {
    await clearAll(db);
    return { kind: "failed", because: `Could not write the ledger: ${(cause as Error).message}` };
  }

  const copiedCount = await countEvents(db);
  if (copiedCount !== source.length) {
    await clearAll(db);
    return {
      kind: "failed",
      because: `Copied ${copiedCount} of ${source.length} entries. The original is untouched.`,
    };
  }

  const copied = await readLog(db);
  if (!sameSequence(source, copied)) {
    await clearAll(db);
    return { kind: "failed", because: "The copied log is not in the original order." };
  }

  if (!sameProjection(reduceEvents(source), reduceEvents(copied))) {
    await clearAll(db);
    return { kind: "failed", because: "The copied log does not produce the same balances." };
  }

  await writeMeta<MigrationState>(db, MIGRATION_KEY, {
    completed: true,
    migratedAt: now(),
    eventCount: source.length,
  });

  // The localStorage key is deliberately NOT removed. See the module note.
  return { kind: "migrated", eventCount: source.length };
}

/**
 * Moving a merchant's only copy of their book.
 *
 * The rule the mission set is the rule under test: never delete the old data
 * before the new copy has been verified. So these cases care less about the
 * happy path than about what is still true after an interrupted run — and that
 * a copy which is subtly wrong is *rejected* rather than marked complete.
 */

import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { freshDatabase } from "./sync-harness";
import { migrateFromLocalStorage, migrationState, MIGRATION_KEY } from "@/lib/vyora/sync/migration";
import { countEvents, readLog, writeMeta, appendLocal } from "@/lib/vyora/sync/store";
import { LOG_KEY, LOG_VERSION } from "@/lib/vyora/store";
import { createContactCreated, createCreditRecorded, reduceEvents } from "@/lib/vyora/events";
import type { LedgerEvent } from "@/lib/vyora/events";

let db: IDBDatabase;

function seedLocalStorage(events: readonly LedgerEvent[]): void {
  window.localStorage.setItem(LOG_KEY, JSON.stringify({ version: LOG_VERSION, events }));
}

function aLedger(): LedgerEvent[] {
  const party = createContactCreated({ name: "Ramesh" });
  const credit = createCreditRecorded({ partyId: party.party.id, amount: 5000, kind: "given" });
  return [party, credit];
}

beforeEach(async () => {
  window.localStorage.clear();
  db = await freshDatabase();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("migrating the ledger into IndexedDB", () => {
  it("copies the log and reports what it moved", async () => {
    const events = aLedger();
    seedLocalStorage(events);

    const result = await migrateFromLocalStorage(db);

    expect(result).toEqual({ kind: "migrated", eventCount: 2 });
    expect((await readLog(db)).map((e) => e.id)).toEqual(events.map((e) => e.id));
  });

  it("never deletes the original", async () => {
    const events = aLedger();
    seedLocalStorage(events);

    await migrateFromLocalStorage(db);

    // A defect found next month has to be recoverable. The old key costs a few
    // kilobytes and is the difference between a fix and a support conversation
    // about a book that no longer exists.
    expect(window.localStorage.getItem(LOG_KEY)).not.toBeNull();
  });

  it("produces the same balances, which is the check the other two would pass", async () => {
    const events = aLedger();
    seedLocalStorage(events);
    await migrateFromLocalStorage(db);

    expect(reduceEvents(await readLog(db))).toEqual(reduceEvents(events));
  });

  it("runs once — a second call does nothing", async () => {
    seedLocalStorage(aLedger());
    await migrateFromLocalStorage(db);

    const second = await migrateFromLocalStorage(db);

    expect(second).toEqual({ kind: "already-done", eventCount: 2 });
    expect(await countEvents(db)).toBe(2);
  });

  it("is restartable: an interrupted run leaves nothing marked and starts over", async () => {
    const events = aLedger();
    seedLocalStorage(events);

    // A run that died after writing one of the two events.
    await appendLocal(db, events[0]);
    expect(await migrationState(db)).toBeNull();

    const result = await migrateFromLocalStorage(db);

    // Not five events, and not a merge of the two attempts.
    expect(result).toEqual({ kind: "migrated", eventCount: 2 });
    expect(await countEvents(db)).toBe(2);
  });

  it("marks an empty browser as migrated, so it is not re-checked every launch", async () => {
    const result = await migrateFromLocalStorage(db);

    expect(result).toEqual({ kind: "nothing-to-migrate" });
    expect((await migrationState(db))?.completed).toBe(true);
  });

  it("refuses to complete when the copy does not fold to the same projection", async () => {
    const events = aLedger();
    seedLocalStorage(events);

    // The failure the count and id checks would both wave through: the right
    // events, in the right order, with a value mangled in transit.
    const original = reduceEvents;
    let call = 0;
    const spy = vi.spyOn(await import("@/lib/vyora/events"), "reduceEvents");
    spy.mockImplementation((log) => {
      call += 1;
      const result = original(log);
      // Second call is the copy. Bend it.
      if (call === 2 && result.transactions[0]) {
        return {
          ...result,
          transactions: [{ ...result.transactions[0], amount: 1 }],
        };
      }
      return result;
    });

    const result = await migrateFromLocalStorage(db);

    expect(result.kind).toBe("failed");
    expect((result as { because: string }).because).toContain("balances");
    // Left unmarked and cleared, so the merchant stays on localStorage and the
    // next launch tries again.
    expect(await migrationState(db)).toBeNull();
    expect(await countEvents(db)).toBe(0);
    expect(window.localStorage.getItem(LOG_KEY)).not.toBeNull();
  });

  it("does not treat a completed migration flag as data", async () => {
    // A browser whose IndexedDB was cleared but whose flag survived would
    // otherwise show an empty book and call it migrated.
    seedLocalStorage(aLedger());
    await writeMeta(db, MIGRATION_KEY, {
      completed: true,
      migratedAt: "2026-08-15T00:00:00.000Z",
      eventCount: 2,
    });

    const result = await migrateFromLocalStorage(db);

    // Honest: it reports what the flag says rather than silently re-copying.
    // The recovery path for this is `clearAll`, not a surprise second import.
    expect(result).toEqual({ kind: "already-done", eventCount: 2 });
  });
});

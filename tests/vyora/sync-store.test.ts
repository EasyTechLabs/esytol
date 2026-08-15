/**
 * The event store, and the ordering that makes two clients agree.
 *
 * A projection is a fold, so the order events are folded in *is* the balance.
 * These tests are mostly about that: that pending work sorts after the shared
 * history, that an acknowledged event moves into its true place, and that a
 * page and its cursor are written together or not at all.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { freshDatabase } from "./sync-harness";
import {
  appendLocal,
  applyPage,
  clearAll,
  confirmedOrder,
  countEvents,
  countPending,
  hasEvent,
  markConfirmed,
  pendingOrder,
  readLog,
  readMeta,
  readPending,
  writeMeta,
} from "@/lib/vyora/sync/store";
import { createContactCreated, createCreditRecorded, reduceEvents } from "@/lib/vyora/events";
import type { LedgerEvent } from "@/lib/vyora/events";

let db: IDBDatabase;
beforeEach(async () => {
  db = await freshDatabase();
});

const remote = (event: LedgerEvent, recordedAt: string) => ({ event, recordedAt });

describe("the event store", () => {
  it("keeps events in the order they were recorded", async () => {
    const first = createContactCreated({ name: "First" });
    const second = createContactCreated({ name: "Second" });
    await appendLocal(db, first);
    await appendLocal(db, second);

    const log = await readLog(db);
    expect(log.map((e) => e.id)).toEqual([first.id, second.id]);
  });

  it("keeps insertion order for events that share an instant", async () => {
    // A log migrated from v1 carries entity `createdAt` values rather than
    // clock instants, so ties are real. IndexedDB breaks a tie in an index by
    // primary key, which is insertion order — the guarantee that was wanted.
    const at = "2026-08-15T00:00:00.000Z";
    const tied: LedgerEvent[] = [0, 1, 2].map((i) => ({
      id: `evt_tied-${i}`,
      at,
      type: "ContactCreated" as const,
      party: { id: `pty_tied-${i}`, name: `Tied ${i}`, createdAt: at },
    }));
    for (const event of tied) await appendLocal(db, event);

    expect(pendingOrder(at)).toBe(`~${at}`);
    expect((await readLog(db)).map((e) => e.id)).toEqual(tied.map((e) => e.id));
  });

  it("orders many entries by the clock, which never repeats an instant", async () => {
    const events: LedgerEvent[] = [];
    for (let i = 0; i < 12; i++) {
      const event = createContactCreated({ name: `Contact ${i}` });
      events.push(event);
      await appendLocal(db, event);
    }
    const log = await readLog(db);
    expect(log.map((e) => e.id)).toEqual(events.map((e) => e.id));
  });

  it("folds the shared history before this browser's unsent work", async () => {
    // Whatever order they arrive in locally, confirmed events come first.
    const local = createContactCreated({ name: "Mine, unsent" });
    await appendLocal(db, local);

    const theirs = createContactCreated({ name: "Theirs" });
    await applyPage(db, [remote(theirs, "2026-08-15T00:00:00.001Z")], "c1");

    const log = await readLog(db);
    expect(log.map((e) => e.id)).toEqual([theirs.id, local.id]);
    expect(confirmedOrder("2026-08-15T00:00:00.001Z", theirs.id) < pendingOrder(local.at)).toBe(
      true
    );
  });

  it("moves an acknowledged event into its place in the shared history", async () => {
    const mine = createContactCreated({ name: "Mine" });
    await appendLocal(db, mine);
    const theirs = createContactCreated({ name: "Theirs" });
    await applyPage(db, [remote(theirs, "2026-08-15T00:00:00.009Z")], "c1");

    // Mine was recorded first on the server, so once acknowledged it belongs
    // BEFORE theirs — not at the tail where it sat while it was pending.
    await markConfirmed(db, [{ eventId: mine.id, recordedAt: "2026-08-15T00:00:00.005Z" }]);

    const log = await readLog(db);
    expect(log.map((e) => e.id)).toEqual([mine.id, theirs.id]);
    expect(await countPending(db)).toBe(0);
  });

  it("stores an event only once, however many times it arrives", async () => {
    const event = createContactCreated({ name: "Once" });
    await appendLocal(db, event);

    // Pulled back after being pushed — the ordinary case, because a browser
    // reads with no device and so receives its own work.
    const first = await applyPage(db, [remote(event, "2026-08-15T00:00:00.001Z")], "c1");
    const second = await applyPage(db, [remote(event, "2026-08-15T00:00:00.001Z")], "c2");

    expect(first.applied).toBe(0);
    expect(first.skipped).toBe(1);
    expect(second.skipped).toBe(1);
    expect(await countEvents(db)).toBe(1);
  });

  it("confirms a pending event that comes back from the server", async () => {
    const event = createContactCreated({ name: "Pushed then pulled" });
    await appendLocal(db, event);
    expect(await countPending(db)).toBe(1);

    await applyPage(db, [remote(event, "2026-08-15T00:00:00.001Z")], "c1");

    // It was ours and is now shared; it must not be pushed a second time.
    expect(await countPending(db)).toBe(0);
  });

  it("advances the cursor with the page, never without it", async () => {
    const event = createContactCreated({ name: "Paged" });
    await applyPage(db, [remote(event, "2026-08-15T00:00:00.001Z")], "cursor-1");

    expect(await readMeta<string>(db, "cursor")).toBe("cursor-1");
    expect(await hasEvent(db, event.id)).toBe(true);
  });

  it("leaves the cursor alone when a page carries nothing to apply", async () => {
    await writeMeta(db, "cursor", "cursor-1");
    await applyPage(db, [], null);
    expect(await readMeta<string>(db, "cursor")).toBe("cursor-1");
  });

  it("reads pending work oldest first, which is the order it must be sent in", async () => {
    const party = createContactCreated({ name: "Payer" });
    await appendLocal(db, party);
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 500, kind: "given" });
    await appendLocal(db, credit);

    const pending = await readPending(db);
    // The credit references the party. Sent the other way round the server has
    // an entry for a contact it has never heard of.
    expect(pending.map((row) => row.id)).toEqual([party.id, credit.id]);
  });

  it("folds to the same projection the local engine would produce", async () => {
    const party = createContactCreated({ name: "Ramesh" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 500, kind: "given" });
    await appendLocal(db, party);
    await appendLocal(db, credit);

    // The store adds a place to keep events, never a second opinion about what
    // they mean: the same `reduceEvents` folds both.
    const stored = reduceEvents(await readLog(db));
    const direct = reduceEvents([party, credit]);
    expect(stored).toEqual(direct);
  });

  it("erases everything, including the cursor, on request", async () => {
    await appendLocal(db, createContactCreated({ name: "Gone" }));
    await writeMeta(db, "cursor", "cursor-1");

    await clearAll(db);

    expect(await countEvents(db)).toBe(0);
    // A cursor is a position in one shop's log. Keeping it would have the next
    // person's first pull start from where the last one got to.
    expect(await readMeta<string>(db, "cursor")).toBeNull();
  });
});

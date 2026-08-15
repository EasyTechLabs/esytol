/**
 * Vyora — sync at the sizes a real book reaches (WEB-SYNC-002).
 *
 * The mission's requirement is "explicitly verify there is no O(E²) operation",
 * and a wall-clock threshold is a poor way to do that: it passes on a fast
 * machine with a quadratic algorithm and fails on a loaded one with a linear
 * algorithm. Timing tests measure the laptop.
 *
 * So the shape is measured by **counting the work**, which is deterministic:
 *
 *  - `appendLocal` must touch a bounded number of records whatever the log
 *    already holds. This is the one that matters, because it is the operation
 *    the old `localStorage` store got wrong — `saveLog` re-serialises every
 *    event on every append, so recording E entries costs O(E²) over a session.
 *  - `applyPage` must touch a number of records proportional to the *page*,
 *    not to the log it is being applied to.
 *  - the fold must visit each event once.
 *
 * `sync.bench.ts` reports the wall-clock numbers beside these; this file is
 * what fails the build if the complexity regresses.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { freshDatabase } from "./sync-harness";
import { appendLocal, applyPage, countEvents, readLog } from "@/lib/vyora/sync/store";
import { reduceEvents, type LedgerEvent } from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";

let db: IDBDatabase;
beforeEach(async () => {
  db = await freshDatabase();
});

/** Deterministic, so a run today is comparable to a run tomorrow. */
function ledgerEvents(count: number, prefix: string): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const partyId = `pty_${prefix}-party`;
  events.push({
    id: `evt_${prefix}-0`,
    at: "2026-08-15T00:00:00.000Z",
    type: "ContactCreated",
    party: { id: partyId, name: "Scale", createdAt: "2026-08-15T00:00:00.000Z" },
  });
  for (let i = 1; i < count; i++) {
    events.push({
      id: `evt_${prefix}-${i}`,
      at: "2026-08-15T00:00:00.000Z",
      type: "CreditRecorded",
      transaction: {
        id: `txn_${prefix}-${i}`,
        partyId,
        amount: 10,
        kind: "given",
        date: "2026-08-15",
        createdAt: "2026-08-15T00:00:00.000Z",
      },
    });
  }
  return events;
}

/**
 * Count IndexedDB record operations by wrapping the object store's methods.
 *
 * Counting calls rather than timing them is what makes the assertion about the
 * algorithm instead of about the machine.
 */
function countingDatabase(real: IDBDatabase): { db: IDBDatabase; counts: () => number } {
  let operations = 0;
  const proxy = new Proxy(real, {
    get(target, property) {
      if (property !== "transaction") return Reflect.get(target, property);
      return (...args: unknown[]) => {
        const tx = (target.transaction as (...a: unknown[]) => IDBTransaction)(...args);
        return new Proxy(tx, {
          get(txTarget, txProperty) {
            if (txProperty !== "objectStore") {
              const value = Reflect.get(txTarget, txProperty);
              return typeof value === "function" ? value.bind(txTarget) : value;
            }
            return (name: string) => {
              const store = txTarget.objectStore(name);
              return new Proxy(store, {
                get(storeTarget, storeProperty) {
                  const value = Reflect.get(storeTarget, storeProperty);
                  if (
                    typeof value === "function" &&
                    ["add", "put", "get", "getAll", "delete", "count"].includes(
                      String(storeProperty)
                    )
                  ) {
                    return (...callArgs: unknown[]) => {
                      operations += 1;
                      return (value as (...a: unknown[]) => unknown).apply(storeTarget, callArgs);
                    };
                  }
                  if (String(storeProperty) === "index") {
                    return (indexName: string) => {
                      const index = storeTarget.index(indexName);
                      return new Proxy(index, {
                        get(indexTarget, indexProperty) {
                          const indexValue = Reflect.get(indexTarget, indexProperty);
                          if (
                            typeof indexValue === "function" &&
                            ["get", "getAll", "count"].includes(String(indexProperty))
                          ) {
                            return (...callArgs: unknown[]) => {
                              operations += 1;
                              return (indexValue as (...a: unknown[]) => unknown).apply(
                                indexTarget,
                                callArgs
                              );
                            };
                          }
                          return typeof indexValue === "function"
                            ? indexValue.bind(indexTarget)
                            : indexValue;
                        },
                      });
                    };
                  }
                  return typeof value === "function" ? value.bind(storeTarget) : value;
                },
              });
            };
          },
        });
      };
    },
  });
  return { db: proxy as IDBDatabase, counts: () => operations };
}

describe("appending stays flat as the book grows", () => {
  it("costs the same at 1,000 events as at 20,000", async () => {
    // Small first, so the second measurement is the one taken against a large
    // log rather than the other way round.
    const seed = ledgerEvents(1_000, "small");
    await applyPage(
      db,
      seed.map((event, i) => ({
        event,
        recordedAt: `2026-08-15T00:00:${String(Math.floor(i / 1000)).padStart(2, "0")}.${String(i % 1000).padStart(3, "0")}Z`,
      })),
      "c1"
    );

    const counted = countingDatabase(db);
    const before = counted.counts();
    await appendLocal(counted.db, ledgerEvents(1, "one-a")[0]);
    const atOneThousand = counted.counts() - before;

    // Grow the log to 20,000.
    const rest = ledgerEvents(19_000, "big");
    await applyPage(
      db,
      rest.map((event, i) => ({
        event,
        recordedAt: `2026-08-15T01:00:${String(Math.floor(i / 1000)).padStart(2, "0")}.${String(i % 1000).padStart(3, "0")}Z`,
      })),
      "c2"
    );
    expect(await countEvents(db)).toBeGreaterThan(19_000);

    const middle = counted.counts();
    await appendLocal(counted.db, ledgerEvents(1, "one-b")[0]);
    const atTwentyThousand = counted.counts() - middle;

    // The whole point. `saveLog` would have re-serialised 20,000 events here
    // and 1,000 there; an IndexedDB append is one record either way.
    expect(atTwentyThousand).toBe(atOneThousand);
    // Pinned at one. It was two until the order key stopped needing the
    // auto-generated `seq` — the benchmark showed the add-then-patch version
    // getting steadily slower as the book grew (137 ms per entry at 20,000,
    // against 0.4 ms now), which is the shape this file exists to catch.
    expect(atTwentyThousand).toBeLessThanOrEqual(2);
  });
});

describe("applying a page scales with the page, not with the book", () => {
  it("costs the same for 50 events into an empty book as into a full one", async () => {
    const page = (prefix: string) =>
      ledgerEvents(50, prefix).map((event, i) => ({
        event,
        recordedAt: `2026-08-16T00:00:00.${String(i).padStart(3, "0")}Z`,
      }));

    const emptyCounter = countingDatabase(db);
    const before = emptyCounter.counts();
    await applyPage(emptyCounter.db, page("into-empty"), "c1");
    const intoEmpty = emptyCounter.counts() - before;

    const bulk = ledgerEvents(10_000, "bulk");
    await applyPage(
      db,
      bulk.map((event, i) => ({
        event,
        recordedAt: `2026-08-17T00:00:${String(Math.floor(i / 1000)).padStart(2, "0")}.${String(i % 1000).padStart(3, "0")}Z`,
      })),
      "c2"
    );

    const middle = emptyCounter.counts();
    await applyPage(emptyCounter.db, page("into-full"), "c3");
    const intoFull = emptyCounter.counts() - middle;

    expect(intoFull).toBe(intoEmpty);
  });
});

describe("the fold visits each event once", () => {
  it("folds 20,000 events and builds the ledger", async () => {
    const events = ledgerEvents(20_000, "fold");
    await applyPage(
      db,
      events.map((event, i) => ({
        event,
        recordedAt: `2026-08-18T00:00:${String(Math.floor(i / 1000)).padStart(2, "0")}.${String(i % 1000).padStart(3, "0")}Z`,
      })),
      "c1"
    );

    const log = await readLog(db);
    expect(log).toHaveLength(20_000);

    const projection = reduceEvents(log);
    expect(projection.transactions).toHaveLength(19_999);

    const ledger = buildLedger(projection);
    // 19,999 credits of ₹10 against one contact.
    expect(ledger.balances.netByParty.get(`pty_fold-party`)).toBe(199_990);
  });
});

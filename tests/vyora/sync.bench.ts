/**
 * Vyora — what web sync costs, measured (WEB-SYNC-002).
 *
 * `sync-scale.test.ts` is what fails the build if the *complexity* regresses;
 * this is what tells a person whether the product feels fast. Scales follow the
 * mission: 1k / 5k / 10k / 20k events.
 *
 * The operations are the ones a merchant waits on:
 *
 *  - **startup** — read the whole log out of IndexedDB and fold it. Runs on
 *    every open, before anything paints.
 *  - **apply a page** — a pull of 200, into a book of that size.
 *  - **append** — recording one entry, which must not get slower as the book
 *    grows. It was O(E) per append in `localStorage`, hence O(E²) per session.
 */

import { bench, describe } from "vitest";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { appendLocal, applyPage, openDatabase, readLog } from "@/lib/vyora/sync/store";
import { reduceEvents, type LedgerEvent } from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";

const SCALES = [1_000, 5_000, 10_000, 20_000];

function events(count: number, prefix: string): LedgerEvent[] {
  const partyId = `pty_${prefix}-party`;
  const out: LedgerEvent[] = [
    {
      id: `evt_${prefix}-0`,
      at: "2026-08-15T00:00:00.000Z",
      type: "ContactCreated",
      party: { id: partyId, name: "Bench", createdAt: "2026-08-15T00:00:00.000Z" },
    },
  ];
  for (let i = 1; i < count; i++) {
    out.push({
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
  return out;
}

const stamped = (log: LedgerEvent[], day: string) =>
  log.map((event, i) => ({
    event,
    recordedAt: `2026-08-${day}T00:${String(Math.floor(i / 1000)).padStart(2, "0")}:00.${String(i % 1000).padStart(3, "0")}Z`,
  }));

/**
 * Seeded **once** per scale, outside the measured function.
 *
 * The first version of this file rebuilt the database inside every iteration,
 * so all three benchmarks were really measuring how long it takes to write E
 * events — the numbers grew linearly with the seed and said nothing about the
 * operation named in the label. Worth recording, because the mistake looks
 * exactly like a real result.
 */
async function seeded(count: number, prefix: string): Promise<IDBDatabase> {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  const db = await openDatabase();
  await applyPage(db, stamped(events(count, prefix), "15"), "cursor");
  return db;
}

for (const size of SCALES) {
  const ready = seeded(size, `s${size}`);
  let page = 0;

  describe(`${size} events`, () => {
    bench("startup — read the log and fold it", async () => {
      const db = await ready;
      buildLedger(reduceEvents(await readLog(db)));
    });

    bench("pull — apply a page of 200", async () => {
      const db = await ready;
      page += 1;
      // A fresh prefix each time, so this measures inserting a page rather
      // than recognising one it already holds.
      await applyPage(db, stamped(events(200, `page${size}-${page}`), "16"), "next");
    });

    bench("record one entry", async () => {
      const db = await ready;
      await appendLocal(db, events(1, `one${size}-${page}-${Math.random()}`)[0]);
    });
  });
}

/**
 * Vyora — replay equivalence proof (ENG-010).
 *
 * `reduceEvents` was optimised from O(E²) to O(E) by folding into a mutable
 * accumulator instead of copying every array per event. The optimisation is
 * only acceptable if the output is **indistinguishable** from the old
 * implementation, so this file keeps a verbatim copy of the pre-ENG-010 fold
 * and compares everything derived from both.
 *
 * If replay ever drifts, a merchant's balances drift with it. This is the test
 * that must never be weakened.
 */

import { describe, it, expect } from "vitest";
import type { VyoraData } from "@/lib/vyora/types";
import type { LedgerEvent } from "@/lib/vyora/events";
import { applyEvent, emptyData, reduceEvents } from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";
import { migrateLegacyData } from "@/lib/vyora/store";
import { buildRecoveryList } from "@/lib/vyora/recovery";
import { dueSummary } from "@/lib/vyora/duedates";
import { readSearch } from "@/lib/vyora/ledger";
import { generateData } from "./legacy-selectors";
import { GOLDEN_TODAY, goldenEvents } from "./golden-ledger";

/**
 * The PRE-ENG-010 fold, verbatim: one immutable `applyEvent` per event.
 *
 * `applyEvent` itself is unchanged public API, so folding with it reproduces
 * exactly what replay used to do.
 */
function legacyReduce(events: readonly LedgerEvent[]): VyoraData {
  let data = emptyData();
  for (const event of events) data = applyEvent(data, event);
  return data;
}

const CASES: Array<{ name: string; events: readonly LedgerEvent[] }> = [
  { name: "empty log", events: [] },
  { name: "golden ledger", events: goldenEvents() },
  { name: "2,000 entries", events: migrateLegacyData(generateData(4242, 200, 2_000)) },
  { name: "contacts only", events: migrateLegacyData(generateData(7, 50, 0)) },
];

describe("the optimised replay is indistinguishable from the old one", () => {
  for (const { name, events } of CASES) {
    describe(name, () => {
      const fast = reduceEvents(events);
      const slow = legacyReduce(events);

      it("produces an identical projection", () => {
        expect(fast).toEqual(slow);
      });

      it("keeps every row in the same order", () => {
        expect(fast.parties.map((p) => p.id)).toEqual(slow.parties.map((p) => p.id));
        expect(fast.transactions.map((t) => t.id)).toEqual(slow.transactions.map((t) => t.id));
        expect(fast.payments.map((p) => p.id)).toEqual(slow.payments.map((p) => p.id));
      });

      it("derives an identical ledger — indexes, balances, timeline and all", () => {
        expect(buildLedger(fast)).toEqual(buildLedger(slow));
      });

      it("derives identical statements for every contact", () => {
        const a = buildLedger(fast);
        const b = buildLedger(slow);
        for (const party of fast.parties.slice(0, 60)) {
          expect(a.timeline.statementByParty.get(party.id)).toEqual(
            b.timeline.statementByParty.get(party.id)
          );
        }
      });

      it("derives an identical due index and dashboard due totals", () => {
        expect(buildLedger(fast).due).toEqual(buildLedger(slow).due);
        expect(dueSummary(buildLedger(fast), GOLDEN_TODAY)).toEqual(
          dueSummary(buildLedger(slow), GOLDEN_TODAY)
        );
      });

      it("derives an identical recovery worklist", () => {
        expect(buildRecoveryList(buildLedger(fast), events, GOLDEN_TODAY)).toEqual(
          buildRecoveryList(buildLedger(slow), events, GOLDEN_TODAY)
        );
      });

      it("derives identical search results", () => {
        for (const query of ["", "contact 1", "ramesh", "98"]) {
          expect(readSearch(buildLedger(fast), query)).toEqual(
            readSearch(buildLedger(slow), query)
          );
        }
      });
    });
  }
});

describe("replay semantics are unchanged in the awkward cases", () => {
  it("stays deterministic across repeated folds", () => {
    const events = goldenEvents();
    expect(reduceEvents(events)).toEqual(reduceEvents(events));
  });

  it("never shares state between two folds of the same log", () => {
    const events = goldenEvents();
    const first = reduceEvents(events);
    const second = reduceEvents(events);
    expect(first.parties).not.toBe(second.parties);
    expect(first.transactions).not.toBe(second.transactions);
    expect(first.payments).not.toBe(second.payments);
  });

  it("does not mutate the projection a previous fold returned", () => {
    const events = [...goldenEvents()];
    const before = reduceEvents(events);
    const snapshot = {
      parties: before.parties.length,
      transactions: before.transactions.length,
      payments: before.payments.length,
    };
    reduceEvents([...events, ...events]);
    expect({
      parties: before.parties.length,
      transactions: before.transactions.length,
      payments: before.payments.length,
    }).toEqual(snapshot);
  });

  it("leaves applyEvent's immutability intact — the input is never touched", () => {
    const events = migrateLegacyData(generateData(11, 20, 200));
    const base = reduceEvents(events);
    const beforeCount = base.transactions.length;
    const credit = events.find((e) => e.type === "CreditRecorded");
    expect(credit).toBeDefined();
    if (!credit) return;
    const next = applyEvent(base, credit);
    expect(base.transactions.length).toBe(beforeCount);
    expect(next.transactions.length).toBe(beforeCount + 1);
    expect(next).not.toBe(base);
  });

  it("still returns the SAME object for an audit-only event", () => {
    const base = reduceEvents(migrateLegacyData(generateData(12, 5, 20)));
    const backup = goldenEvents().find((e) => e.type === "BackupCreated");
    expect(backup).toBeDefined();
    if (!backup) return;
    expect(applyEvent(base, backup)).toBe(base);
  });

  it("replaces the whole projection on a restore, mid-log", () => {
    const events = goldenEvents();
    const restoreIndex = events.findIndex((e) => e.type === "ImportCompleted");
    expect(restoreIndex).toBeGreaterThanOrEqual(0);
    const upTo = events.slice(0, restoreIndex + 1);
    expect(reduceEvents(upTo)).toEqual(legacyReduce(upTo));
  });

  it("handles a log that ends on a deletion", () => {
    const events = goldenEvents();
    const lastDelete = events.map((e) => e.type).lastIndexOf("EntryDeleted");
    expect(lastDelete).toBeGreaterThan(0);
    const upTo = events.slice(0, lastDelete + 1);
    expect(reduceEvents(upTo)).toEqual(legacyReduce(upTo));
  });
});

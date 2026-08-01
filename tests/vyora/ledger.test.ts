/**
 * Vyora — Ledger Engine v2 regression tests (ARCH-001).
 *
 * ARCH-001 replaced repeated O(P×N) sweeps with one normalized index set. The
 * only thing that must NOT change is every number the merchant sees. So this
 * file does not assert the engine against hand-written expectations — it
 * asserts it against `legacy-selectors.ts`, a verbatim copy of the pre-v2
 * code, over generated ledgers. If the refactor changed any observable value or
 * any ordering, these fail.
 *
 * The second half pins the incremental path: folding an append must produce a
 * ledger indistinguishable from rebuilding from scratch. If it does not, the
 * fast path is a silent balance-drift bug — the one failure this product cannot
 * survive.
 */

import { describe, it, expect } from "vitest";
import type { VyoraData, Party, Transaction } from "@/lib/vyora/types";
import {
  buildLedger,
  appendToLedger,
  readDashboardTotals,
  readPartyByName,
  readPartyNet,
  readRecentActivity,
  readSearch,
  readStatement,
} from "@/lib/vyora/ledger";
import { ledgerFor, cacheLedger } from "@/lib/vyora/selectors";
import {
  refAllActivity,
  refAllBalances,
  refDashboardTotals,
  refFindPartyByName,
  refPartyNet,
  refPartyStatement,
  refRecentActivity,
  refSearchParties,
  generateData,
  makeAppend,
  makeRng,
  stamp,
  type AppendStep,
} from "./legacy-selectors";

const EMPTY: VyoraData = { version: 1, parties: [], transactions: [], payments: [] };

// ─── Equivalence with the pre-v2 behaviour ───────────────────────────────────

describe("ledger engine matches the pre-v2 selectors exactly", () => {
  const cases = [
    { name: "empty", data: EMPTY },
    { name: "parties but no entries", data: generateData(1, 10, 0) },
    { name: "small", data: generateData(2, 5, 40) },
    { name: "typical merchant", data: generateData(3, 60, 800) },
  ];

  for (const { name, data } of cases) {
    describe(name, () => {
      const ledger = buildLedger(data);

      it("derives the same net for every party", () => {
        for (const party of data.parties) {
          expect(readPartyNet(ledger, party.id)).toBe(refPartyNet(data, party.id));
        }
      });

      it("ranks balances identically, ties included", () => {
        expect(ledger.balances.ranked).toEqual(refAllBalances(data));
      });

      it("produces the same newest-first activity, ties in original order", () => {
        expect(ledger.timeline.newestFirst).toEqual(refAllActivity(data));
      });

      it("produces the same statement and running balance for every party", () => {
        for (const party of data.parties) {
          expect(readStatement(ledger, party.id)).toEqual(refPartyStatement(data, party.id));
        }
      });

      it("returns the same dashboard totals for every business date touched", () => {
        const dates = new Set(data.payments.map((p) => p.date));
        dates.add("2026-01-01"); // a date with no activity at all
        for (const date of dates) {
          expect(readDashboardTotals(ledger, date)).toEqual(refDashboardTotals(data, date));
        }
      });

      it("returns the same search results", () => {
        const queries = ["", "party", "PARTY 1", "shared", "9800", "  party 2  ", "zzz"];
        for (const query of queries) {
          expect(readSearch(ledger, query)).toEqual(refSearchParties(data, query));
        }
      });

      it("resolves a name to the same party the old find() would have", () => {
        for (const party of data.parties) {
          expect(readPartyByName(ledger, party.name)).toBe(refFindPartyByName(data, party.name));
        }
      });

      it("limits recent activity the same way", () => {
        expect(readRecentActivity(ledger, 15)).toEqual(refRecentActivity(data, 15));
      });
    });
  }
});

describe("ordering edge cases", () => {
  it("keeps a transaction before a payment recorded in the same instant", () => {
    const data: VyoraData = {
      version: 1,
      parties: [{ id: "p1", name: "Ramesh", createdAt: stamp(0) }],
      transactions: [
        {
          id: "t1",
          partyId: "p1",
          amount: 100,
          kind: "given",
          date: "2026-07-01",
          createdAt: stamp(5),
        },
      ],
      payments: [
        {
          id: "y1",
          partyId: "p1",
          amount: 40,
          kind: "received",
          date: "2026-07-01",
          createdAt: stamp(5),
        },
      ],
    };
    const ledger = buildLedger(data);
    expect(ledger.timeline.newestFirst.map((i) => i.id)).toEqual(
      refAllActivity(data).map((i) => i.id)
    );
    expect(readStatement(ledger, "p1").map((r) => r.runningNet)).toEqual([100, 60]);
  });

  it("still orders correctly when a restored backup arrives out of order", () => {
    const ordered = generateData(9, 8, 60);
    const shuffled: VyoraData = {
      ...ordered,
      transactions: [...ordered.transactions].reverse(),
      payments: [...ordered.payments].reverse(),
    };
    const ledger = buildLedger(shuffled);
    expect(ledger.timeline.newestFirst).toEqual(refAllActivity(shuffled));
  });
});

describe("search field isolation", () => {
  it("does not match a query that straddles the name/phone boundary", () => {
    const data: VyoraData = {
      version: 1,
      parties: [{ id: "p1", name: "Ram", phone: "98765", createdAt: stamp(0) }],
      transactions: [],
      payments: [],
    };
    const ledger = buildLedger(data);
    expect(readSearch(ledger, "ram").length).toBe(1);
    expect(readSearch(ledger, "98765").length).toBe(1);
    // Neither field contains "m 9"; the pre-v2 code would not match it either.
    expect(readSearch(ledger, "m 9").length).toBe(0);
    expect(readSearch(ledger, "m 9")).toEqual(refSearchParties(data, "m 9"));
  });
});

describe("due index", () => {
  it("groups transactions by due date and tracks each party's earliest", () => {
    const data: VyoraData = {
      version: 1,
      parties: [{ id: "p1", name: "Ramesh", createdAt: stamp(0) }],
      transactions: [
        {
          id: "t1",
          partyId: "p1",
          amount: 100,
          kind: "given",
          date: "2026-07-01",
          dueDate: "2026-08-15",
          createdAt: stamp(1),
        },
        {
          id: "t2",
          partyId: "p1",
          amount: 200,
          kind: "given",
          date: "2026-07-02",
          dueDate: "2026-07-20",
          createdAt: stamp(2),
        },
        {
          id: "t3",
          partyId: "p1",
          amount: 50,
          kind: "given",
          date: "2026-07-03",
          createdAt: stamp(3),
        },
      ],
      payments: [],
    };
    const ledger = buildLedger(data);
    expect(ledger.due.dueDatesAscending).toEqual(["2026-07-20", "2026-08-15"]);
    expect(ledger.due.transactionsByDueDate.get("2026-08-15")?.map((t) => t.id)).toEqual(["t1"]);
    expect(ledger.due.earliestDueDateByParty.get("p1")).toBe("2026-07-20");
    // A transaction with no due date must not appear anywhere in the index.
    expect(ledger.due.transactionsByDueDate.size).toBe(2);
  });
});

// ─── The incremental path must be indistinguishable from a rebuild ───────────

describe("incremental append equals a full rebuild", () => {
  it("stays identical across a long mixed sequence of appends", () => {
    const rng = makeRng(4242);
    let ledger = buildLedger(generateData(7, 12, 60));
    for (let step = 0; step < 250; step++) {
      const { next, change } = makeAppend(ledger.data, step, rng);
      const folded = appendToLedger(ledger, next, change);
      expect(folded).toEqual(buildLedger(next));
      ledger = folded;
    }
  });

  it("starts correctly from a completely empty ledger", () => {
    const rng = makeRng(11);
    let ledger = buildLedger(EMPTY);
    for (let step = 0; step < 40; step++) {
      const { next, change } = makeAppend(ledger.data, step, rng);
      const folded = appendToLedger(ledger, next, change);
      expect(folded).toEqual(buildLedger(next));
      ledger = folded;
    }
  });
});

describe("incremental guards fall back to a rebuild instead of drifting", () => {
  const base = buildLedger(generateData(5, 6, 30));
  const knownPartyId = base.data.parties[0].id;

  function expectRebuild(next: VyoraData, change: AppendStep["change"]) {
    expect(appendToLedger(base, next, change)).toEqual(buildLedger(next));
  }

  it("rebuilds when the change carries no entry", () => {
    expectRebuild(base.data, {});
  });

  it("rebuilds when the appended entry is older than the newest one", () => {
    const transaction: Transaction = {
      id: "old",
      partyId: knownPartyId,
      amount: 100,
      kind: "given",
      date: "2026-07-01",
      createdAt: stamp(-5000),
    };
    const next: VyoraData = {
      ...base.data,
      transactions: [...base.data.transactions, transaction],
    };
    expectRebuild(next, { transaction });
  });

  it("rebuilds when the entry counts do not match the declared change", () => {
    const transaction: Transaction = {
      id: "skew",
      partyId: knownPartyId,
      amount: 100,
      kind: "given",
      date: "2026-07-01",
      createdAt: stamp(200_000),
    };
    // Two rows appended but only one declared.
    const next: VyoraData = {
      ...base.data,
      transactions: [...base.data.transactions, transaction, { ...transaction, id: "skew2" }],
    };
    expectRebuild(next, { transaction });
  });

  it("rebuilds when a new party collides with an existing normalised name", () => {
    const existing = base.data.parties[0];
    const party: Party = {
      id: "dup",
      name: existing.name.toUpperCase(),
      createdAt: stamp(200_001),
    };
    const transaction: Transaction = {
      id: "dupTxn",
      partyId: party.id,
      amount: 10,
      kind: "given",
      date: "2026-07-01",
      createdAt: stamp(200_001),
    };
    const next: VyoraData = {
      ...base.data,
      parties: [...base.data.parties, party],
      transactions: [...base.data.transactions, transaction],
    };
    expectRebuild(next, { party, transaction });
    // ...and the name still resolves to the ORIGINAL party, not the newcomer.
    expect(readPartyByName(buildLedger(next), existing.name)).toBe(existing);
  });

  it("rebuilds when the entry belongs to an unknown party", () => {
    const transaction: Transaction = {
      id: "orphan",
      partyId: "ghost",
      amount: 100,
      kind: "given",
      date: "2026-07-01",
      createdAt: stamp(200_002),
    };
    const next: VyoraData = {
      ...base.data,
      transactions: [...base.data.transactions, transaction],
    };
    expectRebuild(next, { transaction });
  });

  it("rebuilds when a new party is not the one the entry belongs to", () => {
    const party: Party = { id: "bystander", name: "Bystander", createdAt: stamp(200_003) };
    const transaction: Transaction = {
      id: "otherTxn",
      partyId: knownPartyId,
      amount: 100,
      kind: "given",
      date: "2026-07-01",
      createdAt: stamp(200_003),
    };
    const next: VyoraData = {
      ...base.data,
      parties: [...base.data.parties, party],
      transactions: [...base.data.transactions, transaction],
    };
    expectRebuild(next, { party, transaction });
  });
});

// ─── Memoization ─────────────────────────────────────────────────────────────

describe("memoization", () => {
  it("returns the same ledger instance for the same data object", () => {
    const data = generateData(21, 5, 20);
    expect(ledgerFor(data)).toBe(ledgerFor(data));
  });

  it("derives a new ledger for a new data version", () => {
    const data = generateData(22, 5, 20);
    const changed: VyoraData = { ...data };
    expect(ledgerFor(changed)).not.toBe(ledgerFor(data));
  });

  it("adopts an incrementally built ledger so it is never derived twice", () => {
    const rng = makeRng(3);
    const ledger = buildLedger(generateData(23, 5, 20));
    const { next, change } = makeAppend(ledger.data, 0, rng);
    const folded = cacheLedger(appendToLedger(ledger, next, change));
    expect(ledgerFor(next)).toBe(folded);
  });
});

// ─── Immutability ────────────────────────────────────────────────────────────

describe("immutability", () => {
  it("leaves the previous ledger untouched when appending", () => {
    const rng = makeRng(77);
    const ledger = buildLedger(generateData(24, 6, 30));
    const before = {
      entries: ledger.timeline.newestFirst.length,
      ranked: ledger.balances.ranked.map((b) => b.net),
      receivable: ledger.statistics.receivable,
      parties: ledger.parties.byId.size,
    };
    const { next, change } = makeAppend(ledger.data, 0, rng);
    appendToLedger(ledger, next, change);
    expect(ledger.timeline.newestFirst.length).toBe(before.entries);
    expect(ledger.balances.ranked.map((b) => b.net)).toEqual(before.ranked);
    expect(ledger.statistics.receivable).toBe(before.receivable);
    expect(ledger.parties.byId.size).toBe(before.parties);
  });
});

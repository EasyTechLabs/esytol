/**
 * Vyora — Golden Ledger regression suite (QA-001).
 *
 * The canonical ledger, asserted end to end: integrity of every derived number,
 * the edge cases the fixture deliberately contains, and the negative attempts
 * that must never produce an event.
 *
 * Where the pre-v2 reference implementation is used it is used at PORTFOLIO
 * level only. `refPartyStatement` is O(N×P) per contact, so sweeping all 500
 * against 15,000 entries is ~3.7 billion operations — the equivalence sweep
 * stays on the small generated fixtures in `ledger.test.ts`, and the golden
 * ledger checks one contact deeply plus every portfolio total.
 */

import { describe, it, expect } from "vitest";
import { applyEvent, reduceEvents, revertLastEvent } from "@/lib/vyora/events";
import {
  buildLedger,
  readDashboardTotals,
  readPartyNet,
  readSearch,
  readStatement,
} from "@/lib/vyora/ledger";
import { executeCommand, type CommandContext } from "@/lib/vyora/commands";
import {
  refAllBalances,
  refDashboardTotals,
  refPartyNet,
  refPartyStatement,
  refSearchParties,
} from "./legacy-selectors";
import {
  GOLDEN_CONTACTS,
  GOLDEN_IMPORTED_CONTACTS,
  GOLDEN_REJECTED,
  GOLDEN_TODAY,
  GOLDEN_TRANSACTIONS,
  goldenEvents,
  goldenImportSnapshot,
  goldenLedger,
  goldenProjection,
  goldenSample,
} from "./golden-ledger";

function goldenContext(): CommandContext {
  return { ledger: goldenLedger(), events: goldenEvents() };
}

// ─── Shape ───────────────────────────────────────────────────────────────────

describe("the golden ledger is the ledger it claims to be", () => {
  const data = goldenProjection();

  it("holds the declared scale", () => {
    // 500 created + 20 imported − 1 deleted contact
    expect(data.parties.length).toBe(GOLDEN_CONTACTS + GOLDEN_IMPORTED_CONTACTS - 1);
    expect(data.transactions.length).toBeGreaterThan(GOLDEN_TRANSACTIONS - 500);
    expect(data.payments.length).toBeGreaterThan(3_000);
  });

  it("is byte-for-byte reproducible", () => {
    expect(reduceEvents(goldenEvents())).toEqual(reduceEvents(goldenEvents()));
  });

  it("contains suppliers as well as customers", () => {
    expect(data.transactions.some((t) => t.kind === "taken")).toBe(true);
    expect(data.payments.some((p) => p.kind === "paid")).toBe(true);
    const ledger = goldenLedger();
    expect(ledger.statistics.receivable).toBeGreaterThan(0);
    expect(ledger.statistics.payable).toBeGreaterThan(0);
  });

  it("contains long-overdue credit", () => {
    const overdue = data.transactions.filter((t) => t.dueDate && t.dueDate < GOLDEN_TODAY);
    expect(overdue.length).toBeGreaterThan(1_000);
    expect(goldenLedger().due.dueDatesAscending.length).toBeGreaterThan(100);
  });

  it("contains partial payments that leave a balance open", () => {
    const ledger = goldenLedger();
    const open = ledger.balances.ranked.filter((b) => b.net !== 0);
    expect(open.length).toBeGreaterThan(400);
  });

  it("contains deleted entries and restored ones", () => {
    const deletions = goldenEvents().filter((e) => e.type === "EntryDeleted");
    expect(deletions.length).toBeGreaterThan(150);
    const live = new Set(data.transactions.map((t) => t.id));
    // Some deleted rows came back; some stayed gone.
    const restoredBack = deletions.filter((e) => e.type === "EntryDeleted" && live.has(e.entryId));
    expect(restoredBack.length).toBeGreaterThan(0);
    expect(restoredBack.length).toBeLessThan(deletions.length);
  });

  it("drops a removed contact together with its entries", () => {
    const removed = goldenEvents().find((e) => e.type === "ContactDeleted");
    expect(removed?.type).toBe("ContactDeleted");
    if (removed?.type !== "ContactDeleted") return;
    expect(data.parties.some((p) => p.id === removed.partyId)).toBe(false);
    expect(data.transactions.some((t) => t.partyId === removed.partyId)).toBe(false);
    expect(data.payments.some((p) => p.partyId === removed.partyId)).toBe(false);
  });

  it("exercises the out-of-order fallback, because a restore re-emits an old row", () => {
    const createdAts = data.transactions.map((t) => t.createdAt);
    const ascending = createdAts.every((v, i) => i === 0 || createdAts[i - 1] <= v);
    expect(ascending).toBe(false); // the restores put an older row at the end
    // ...and the timeline is still correctly ordered despite it.
    const timeline = goldenLedger().timeline.newestFirst.map((i) => i.createdAt);
    expect(timeline.every((v, i) => i === 0 || timeline[i - 1] >= v)).toBe(true);
  });
});

// ─── Integrity ───────────────────────────────────────────────────────────────

describe("integrity: every derived number still adds up at scale", () => {
  const data = goldenProjection();
  const ledger = goldenLedger();

  it("nets each contact exactly as the pre-v2 implementation did", () => {
    // A sample, not a sweep — refPartyNet is O(N) per contact.
    for (const party of data.parties.slice(0, 40)) {
      expect(readPartyNet(ledger, party.id)).toBe(refPartyNet(data, party.id));
    }
  });

  it("ranks the whole portfolio identically", () => {
    expect(ledger.balances.ranked).toEqual(refAllBalances(data));
  });

  it("totals receivable, payable and net identically", () => {
    expect(readDashboardTotals(ledger, GOLDEN_TODAY)).toEqual(
      refDashboardTotals(data, GOLDEN_TODAY)
    );
  });

  it("keeps receivable − payable equal to net", () => {
    const { receivable, payable, net } = ledger.statistics;
    expect(receivable - payable).toBe(net);
  });

  it("makes the portfolio total the sum of its parts", () => {
    let sum = 0;
    for (const { net } of ledger.balances.ranked) sum += net;
    expect(sum).toBe(ledger.statistics.net);
  });

  it("reproduces one contact's full statement exactly", () => {
    const { contact } = goldenSample();
    expect(readStatement(ledger, contact.id)).toEqual(refPartyStatement(data, contact.id));
  });

  it("ends every statement on the contact's current balance", () => {
    for (const party of data.parties.slice(0, 50)) {
      const rows = readStatement(ledger, party.id);
      if (rows.length === 0) continue;
      expect(rows[rows.length - 1].runningNet).toBe(readPartyNet(ledger, party.id));
    }
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe("search at scale", () => {
  const data = goldenProjection();
  const ledger = goldenLedger();

  it("returns what the pre-v2 search returned", () => {
    for (const query of ["", "contact 1", "ramesh", "98", "Imported", "zzz"]) {
      expect(readSearch(ledger, query)).toEqual(refSearchParties(data, query));
    }
  });

  it("finds the deliberate duplicate names", () => {
    expect(readSearch(ledger, "ramesh").length).toBeGreaterThan(1);
  });

  it("still isolates the name and phone fields", () => {
    expect(readSearch(ledger, "1 98")).toEqual(refSearchParties(data, "1 98"));
  });
});

// ─── Negative attempts ───────────────────────────────────────────────────────

describe("negative attempts are rejected and emit nothing", () => {
  const context = goldenContext();

  for (const { why, command } of GOLDEN_REJECTED) {
    it(`rejects ${why}`, () => {
      const result = executeCommand(context, command);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBeTruthy();
      expect((result as { events?: unknown }).events).toBeUndefined();
    });
  }

  it("leaves the ledger untouched after every rejection", () => {
    const before = goldenLedger().statistics.net;
    for (const { command } of GOLDEN_REJECTED) executeCommand(context, command);
    expect(goldenLedger().statistics.net).toBe(before);
  });
});

// ─── Duplicate imports ───────────────────────────────────────────────────────

describe("duplicate imports", () => {
  it("importing the same file twice leaves the same ledger", () => {
    const snapshot = goldenImportSnapshot();
    const once = applyEvent(goldenProjection(), {
      id: "e1",
      at: "2026-08-01T00:00:00.000Z",
      type: "ImportCompleted",
      snapshot,
    });
    const twice = applyEvent(once, {
      id: "e2",
      at: "2026-08-01T00:00:01.000Z",
      type: "ImportCompleted",
      snapshot,
    });
    expect(twice).toEqual(once);
  });

  it("does not double any contact or entry", () => {
    const snapshot = goldenImportSnapshot();
    const imported = applyEvent(goldenProjection(), {
      id: "e1",
      at: "2026-08-01T00:00:00.000Z",
      type: "ImportCompleted",
      snapshot,
    });
    const ids = imported.parties.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(imported.parties.length).toBe(snapshot.parties.length);
  });
});

// ─── Undo and restore ────────────────────────────────────────────────────────

describe("undo and restore", () => {
  it("undo drops the last event and restores the previous projection exactly", () => {
    const events = goldenEvents();
    const before = reduceEvents(events.slice(0, -1));
    expect(reduceEvents(revertLastEvent(events))).toEqual(before);
  });

  it("restores a deleted entry as the original row, and the balance returns", () => {
    const context = goldenContext();
    const { transaction } = goldenSample();
    const netBefore = readPartyNet(context.ledger, transaction.partyId);

    const deleted = executeCommand(context, { type: "DeleteEntry", entryId: transaction.id });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    const afterDelete = {
      ledger: buildLedger(deleted.events.reduce(applyEvent, context.ledger.data)),
      events: [...context.events, ...deleted.events],
    };
    expect(readPartyNet(afterDelete.ledger, transaction.partyId)).not.toBe(netBefore);

    const restored = executeCommand(afterDelete, { type: "RestoreEntry", entryId: transaction.id });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    const afterRestore = buildLedger(restored.events.reduce(applyEvent, afterDelete.ledger.data));
    expect(readPartyNet(afterRestore, transaction.partyId)).toBe(netBefore);
    expect(afterRestore.transactions.transactionById.get(transaction.id)).toEqual(transaction);
  });
});

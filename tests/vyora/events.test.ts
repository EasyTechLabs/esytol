/**
 * Vyora — Event Log tests (ARCH-002).
 *
 * The log is now the source of truth on the merchant's device, so three things
 * must hold or the product is untrustworthy:
 *
 *  1. **Every event type folds correctly** — including the six that have no
 *     producer in the app yet. A reducer case nothing exercises is exactly where
 *     a bug hides until the milestone that starts emitting it.
 *  2. **Replay is deterministic** — the same log always folds to the same state,
 *     and folding one event at a time equals folding the whole log.
 *  3. **Migration is lossless** — a device holding v1 state must end up with a
 *     projection identical to what it had, entry order included.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { VyoraData, Party } from "@/lib/vyora/types";
import {
  applyEvent,
  compactEvents,
  createBackupCreated,
  createContactCreated,
  createContactDeleted,
  createContactUpdated,
  createCreditRecorded,
  createDueDateChanged,
  createEntryDeleted,
  createImportCompleted,
  createPaymentRecorded,
  createRestoreCompleted,
  emptyData,
  eventsForParty,
  reduceEvents,
  revertLastEvent,
  type LedgerEvent,
} from "@/lib/vyora/events";
import {
  LEGACY_KEY,
  LOG_KEY,
  clearLog,
  loadData,
  loadLog,
  migrateLegacyData,
  saveLog,
} from "@/lib/vyora/store";
import { buildLedger, readPartyNet } from "@/lib/vyora/ledger";
import { generateData } from "./legacy-selectors";

/** A small ledger built purely from events, used across the reducer tests. */
function seedLog() {
  const ramesh = createContactCreated({ name: "Ramesh", phone: "98765" });
  const suresh = createContactCreated({ name: "Suresh" });
  const credit = createCreditRecorded({
    partyId: ramesh.party.id,
    amount: 1000,
    kind: "given",
    date: "2026-07-10",
    dueDate: "2026-07-25",
  });
  const payment = createPaymentRecorded({
    partyId: ramesh.party.id,
    amount: 200,
    kind: "received",
    date: "2026-07-21",
  });
  const events: LedgerEvent[] = [ramesh, suresh, credit, payment];
  return { events, ramesh, suresh, credit, payment };
}

// ─── Every event type folds correctly ────────────────────────────────────────

describe("reducer covers every event type", () => {
  it("ContactCreated adds a contact, trimmed", () => {
    const event = createContactCreated({ name: "  Ramesh  ", phone: " 98765 " });
    const data = applyEvent(emptyData(), event);
    expect(data.parties).toHaveLength(1);
    expect(data.parties[0].name).toBe("Ramesh");
    expect(data.parties[0].phone).toBe("98765");
  });

  it("ContactUpdated changes only the fields it carries", () => {
    const { events, ramesh } = seedLog();
    const renamed = createContactUpdated(ramesh.party.id, { name: "Ramesh Kaka" });
    const data = applyEvent(reduceEvents(events), renamed);
    const party = data.parties.find((p) => p.id === ramesh.party.id) as Party;
    expect(party.name).toBe("Ramesh Kaka");
    expect(party.phone).toBe("98765"); // untouched
    expect(party.createdAt).toBe(ramesh.party.createdAt); // identity preserved
  });

  it("ContactDeleted removes the contact AND its entries", () => {
    const { events, ramesh, suresh } = seedLog();
    const data = applyEvent(reduceEvents(events), createContactDeleted(ramesh.party.id));
    expect(data.parties.map((p) => p.id)).toEqual([suresh.party.id]);
    expect(data.transactions).toHaveLength(0);
    expect(data.payments).toHaveLength(0);
    // No orphaned value can linger in the indexes either.
    expect(readPartyNet(buildLedger(data), ramesh.party.id)).toBe(0);
  });

  it("CreditRecorded and PaymentRecorded drive the balance", () => {
    const { events, ramesh } = seedLog();
    const ledger = buildLedger(reduceEvents(events));
    expect(readPartyNet(ledger, ramesh.party.id)).toBe(800); // 1000 given − 200 received
  });

  it("DueDateChanged sets and clears a due date", () => {
    const { events, credit } = seedLog();
    const base = reduceEvents(events);
    const moved = applyEvent(base, createDueDateChanged(credit.transaction.id, "2026-08-01"));
    expect(moved.transactions[0].dueDate).toBe("2026-08-01");
    const cleared = applyEvent(moved, createDueDateChanged(credit.transaction.id));
    expect(cleared.transactions[0].dueDate).toBeUndefined();
    expect(buildLedger(cleared).due.transactionsByDueDate.size).toBe(0);
  });

  it("EntryDeleted removes a transaction or a payment by id", () => {
    const { events, credit, payment } = seedLog();
    const base = reduceEvents(events);
    const noCredit = applyEvent(base, createEntryDeleted(credit.transaction.id));
    const noPayment = applyEvent(base, createEntryDeleted(payment.payment.id));
    expect(noCredit.transactions).toHaveLength(0);
    expect(noCredit.payments).toHaveLength(1); // only the named entry goes
    expect(noPayment.payments).toHaveLength(0);
  });

  it("BackupCreated is audit-only and changes nothing", () => {
    const { events } = seedLog();
    const before = reduceEvents(events);
    const after = applyEvent(before, createBackupCreated(2));
    expect(after).toEqual(before);
  });

  it("RestoreCompleted and ImportCompleted replace the projection", () => {
    const { events } = seedLog();
    const snapshot = generateData(31, 4, 12);
    const restored = applyEvent(reduceEvents(events), createRestoreCompleted(snapshot));
    expect(restored.parties).toEqual(snapshot.parties);
    expect(restored.transactions).toEqual(snapshot.transactions);
    const imported = applyEvent(reduceEvents(events), createImportCompleted(snapshot));
    expect(imported.parties).toEqual(snapshot.parties);
  });

  it("survives a malformed snapshot rather than throwing into a screen", () => {
    const broken = { version: 2 } as VyoraData;
    const data = applyEvent(emptyData(), createRestoreCompleted(broken));
    expect(data.parties).toEqual([]);
    expect(data.transactions).toEqual([]);
    expect(data.payments).toEqual([]);
  });

  it("ignores an event type it does not recognise", () => {
    const { events } = seedLog();
    const before = reduceEvents(events);
    const fromTheFuture = { id: "e", at: "2026-07-01", type: "SomethingNewer" };
    expect(applyEvent(before, fromTheFuture as unknown as LedgerEvent)).toEqual(before);
  });
});

// ─── Replay determinism ──────────────────────────────────────────────────────

describe("replay is deterministic", () => {
  it("folds to the same projection every time", () => {
    const { events } = seedLog();
    expect(reduceEvents(events)).toEqual(reduceEvents(events));
  });

  it("folding one event at a time equals folding the whole log", () => {
    const { events } = seedLog();
    const stepwise = events.reduce(applyEvent, emptyData());
    expect(stepwise).toEqual(reduceEvents(events));
  });

  it("keeps entry arrays in log order, which the index engine relies on", () => {
    // The O(N) timeline merge assumes each entry array is createdAt-ascending.
    // A 120-entry log is what makes that assertion worth anything.
    const data = reduceEvents(migrateLegacyData(generateData(44, 8, 120)));
    for (const rows of [data.transactions, data.payments]) {
      const createdAts = rows.map((r) => r.createdAt);
      expect(createdAts).toEqual([...createdAts].sort());
    }
  });
});

// ─── Undo ────────────────────────────────────────────────────────────────────

describe("undo", () => {
  it("dropping the last event restores the exact previous projection", () => {
    const { events, ramesh } = seedLog();
    const before = reduceEvents(events);
    const extra = createCreditRecorded({ partyId: ramesh.party.id, amount: 500, kind: "given" });
    const grown = [...events, extra];
    expect(reduceEvents(grown)).not.toEqual(before);
    expect(reduceEvents(revertLastEvent(grown))).toEqual(before);
  });

  it("is a no-op on an empty log", () => {
    expect(revertLastEvent([])).toEqual([]);
  });
});

// ─── Compaction ──────────────────────────────────────────────────────────────

describe("compaction", () => {
  it("produces a shorter log that folds to the identical projection", () => {
    const { events, credit } = seedLog();
    const withChurn: LedgerEvent[] = [
      ...events,
      createEntryDeleted(credit.transaction.id),
      createBackupCreated(1),
    ];
    const compacted = compactEvents(withChurn);
    expect(reduceEvents(compacted)).toEqual(reduceEvents(withChurn));
    expect(compacted.length).toBeLessThan(withChurn.length);
    // The tombstone and the audit note are gone — that is the trade it makes.
    expect(compacted.some((e) => e.type === "EntryDeleted")).toBe(false);
    expect(compacted.some((e) => e.type === "BackupCreated")).toBe(false);
  });
});

// ─── Audit trail ─────────────────────────────────────────────────────────────

describe("audit trail", () => {
  it("returns every event that touched one contact", () => {
    const { events, ramesh, suresh } = seedLog();
    const trail = eventsForParty(events, ramesh.party.id);
    expect(trail.map((e) => e.type)).toEqual([
      "ContactCreated",
      "CreditRecorded",
      "PaymentRecorded",
    ]);
    expect(eventsForParty(events, suresh.party.id).map((e) => e.type)).toEqual(["ContactCreated"]);
  });
});

// ─── Migration from the v1 state blob ────────────────────────────────────────

describe("migration from v1 state", () => {
  const legacy = generateData(41, 12, 120);

  it("folds back to exactly the state it came from, order included", () => {
    const projection = reduceEvents(migrateLegacyData(legacy));
    expect(projection.parties).toEqual(legacy.parties);
    expect(projection.transactions).toEqual(legacy.transactions);
    expect(projection.payments).toEqual(legacy.payments);
  });

  it("produces an identical index set, so no merchant sees a number move", () => {
    const fromEvents = buildLedger(reduceEvents(migrateLegacyData(legacy)));
    const fromLegacy = buildLedger(legacy);
    expect(fromEvents.balances.ranked).toEqual(fromLegacy.balances.ranked);
    expect(fromEvents.timeline.newestFirst).toEqual(fromLegacy.timeline.newestFirst);
    expect(fromEvents.statistics.receivable).toBe(fromLegacy.statistics.receivable);
    expect(fromEvents.statistics.payable).toBe(fromLegacy.statistics.payable);
  });

  it("timestamps each event with the entity's own createdAt, not the upgrade time", () => {
    const events = migrateLegacyData(legacy);
    expect(events[0].at).toBe(legacy.parties[0].createdAt);
  });
});

// ─── Persistence ─────────────────────────────────────────────────────────────

describe("persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a log", () => {
    const { events } = seedLog();
    expect(saveLog(events)).toBe(true);
    expect(loadLog()).toEqual(events);
  });

  it("reads an empty log when nothing is stored", () => {
    expect(loadLog()).toEqual([]);
  });

  it("reads an empty log from a corrupt payload rather than throwing", () => {
    window.localStorage.setItem(LOG_KEY, "{not json");
    expect(loadLog()).toEqual([]);
  });

  it("migrates a v1 blob on first read and persists the result", () => {
    const legacy = generateData(42, 5, 30);
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    const events = loadLog();
    expect(events.length).toBe(
      legacy.parties.length + legacy.transactions.length + legacy.payments.length
    );
    // The conversion happened once and was written to the v2 key...
    expect(window.localStorage.getItem(LOG_KEY)).not.toBeNull();
    // ...and the v1 blob is left untouched as a fallback.
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
    expect(loadData().parties).toEqual(legacy.parties);
  });

  it("does not resurrect v1 data after the merchant erases everything", () => {
    const legacy = generateData(43, 3, 10);
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    loadLog(); // migrate
    clearLog();
    expect(loadLog()).toEqual([]);
    expect(loadData().parties).toEqual([]);
  });
});

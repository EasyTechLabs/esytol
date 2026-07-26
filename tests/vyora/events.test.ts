/**
 * Vyora — Ledger Event Log (ARCH-002). Proves the active ledger state is DERIVABLE
 * from the append-only event log: a CRUD event stream reduces to the expected state,
 * checkpoints (import/restore/compaction) reset + continue, and a checkpoint derives
 * the full 120/2,200 demo shop byte-for-byte.
 */

import { describe, it, expect } from "vitest";
import { emptyData, seedDemoData } from "@/lib/vyora/store";
import { appendEvent, reduceEvents, compactEvents, type LedgerEvent } from "@/lib/vyora/events";
import type { VyoraData, Party, Transaction, Payment } from "@/lib/vyora/types";
import type { LedgerEventSpec } from "@/lib/vyora/events";

const AT = "2026-07-30T00:00:00.000Z";
const P = (id: string, name: string, phone?: string): Party => ({ id, name, phone, createdAt: AT });
const T = (id: string, partyId: string, amount: number): Transaction => ({
  id,
  partyId,
  amount,
  kind: "given",
  date: "2026-07-01",
  createdAt: AT,
});
const PM = (id: string, partyId: string, amount: number): Payment => ({
  id,
  partyId,
  amount,
  kind: "received",
  date: "2026-07-02",
  createdAt: AT,
});
let seq = 0;
const ev = (d: VyoraData, spec: LedgerEventSpec) => appendEvent(d, spec, `e${seq++}`, AT);

describe("event log — state derives from events", () => {
  it("reduces a CRUD event stream to the expected active ledger", () => {
    let d = emptyData();
    d = ev(d, { type: "ContactCreated", party: P("a", "Alice") });
    d = ev(d, { type: "ContactCreated", party: P("b", "Bob") });
    d = ev(d, { type: "CreditRecorded", transaction: T("t1", "a", 500) });
    d = ev(d, { type: "PaymentRecorded", payment: PM("y1", "a", 200) });
    d = ev(d, { type: "ContactUpdated", partyId: "b", patch: { name: "Bobby", phone: "999" } });
    d = ev(d, { type: "EntryDeleted", entryId: "t1" });
    d = ev(d, { type: "CreditRecorded", transaction: T("t2", "b", 300) });

    const s = reduceEvents(d.events!);
    expect(s.parties.map((p) => p.name)).toEqual(["Alice", "Bobby"]);
    expect(s.parties.find((p) => p.id === "b")!.phone).toBe("999");
    expect(s.transactions.map((t) => t.id)).toEqual(["t2"]); // t1 deleted
    expect(s.payments.map((p) => p.id)).toEqual(["y1"]);
  });

  it("ContactDeleted removes the contact and all its entries", () => {
    let d = emptyData();
    d = ev(d, { type: "ContactCreated", party: P("a", "A") });
    d = ev(d, { type: "CreditRecorded", transaction: T("t1", "a", 100) });
    d = ev(d, { type: "PaymentRecorded", payment: PM("y1", "a", 50) });
    d = ev(d, { type: "ContactDeleted", partyId: "a" });
    const s = reduceEvents(d.events!);
    expect(s.parties).toEqual([]);
    expect(s.transactions).toEqual([]);
    expect(s.payments).toEqual([]);
  });

  it("DueDateChanged patches the credit's due date", () => {
    let d = emptyData();
    d = ev(d, { type: "ContactCreated", party: P("a", "A") });
    d = ev(d, { type: "CreditRecorded", transaction: T("t1", "a", 100) });
    d = ev(d, { type: "DueDateChanged", transactionId: "t1", dueDate: "2026-08-01" });
    expect(reduceEvents(d.events!).transactions[0]!.dueDate).toBe("2026-08-01");
  });

  it("a checkpoint (import) resets state; later deltas apply on top", () => {
    const snapshot = { parties: [P("x", "X")], transactions: [T("tx", "x", 900)], payments: [] };
    const events: LedgerEvent[] = [
      { type: "ContactCreated", party: P("old", "Old"), id: "e1", at: AT }, // discarded by checkpoint
      { type: "ImportCompleted", snapshot, id: "e2", at: AT },
      { type: "PaymentRecorded", payment: PM("y", "x", 100), id: "e3", at: AT },
    ];
    const s = reduceEvents(events);
    expect(s.parties.map((p) => p.id)).toEqual(["x"]);
    expect(s.transactions.map((t) => t.id)).toEqual(["tx"]);
    expect(s.payments.map((p) => p.id)).toEqual(["y"]);
  });

  it("BackupCreated is audit-only (no state change)", () => {
    let d = emptyData();
    d = ev(d, { type: "ContactCreated", party: P("a", "A") });
    d = ev(d, { type: "BackupCreated" });
    expect(reduceEvents(d.events!).parties.map((p) => p.id)).toEqual(["a"]);
  });

  it("a checkpoint derives the full 120/2,200 demo shop byte-for-byte", () => {
    const demo = seedDemoData(emptyData(), "2026-07-26");
    const compacted = compactEvents(demo, "cp", AT);
    expect(compacted.events).toHaveLength(1); // compaction bounds the log
    const s = reduceEvents(compacted.events!);
    expect(s.parties).toEqual(demo.parties);
    expect(s.transactions).toEqual(demo.transactions);
    expect(s.payments).toEqual(demo.payments);
  });
});

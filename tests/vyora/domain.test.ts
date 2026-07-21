/**
 * Vyora Alpha — domain tests (v0.2). The balance math is the product's trust; it
 * must be exactly right and never drift. Also covers the trust/recoverability
 * features: robust identity, non-destructive migration, and import validation.
 */

import { describe, it, expect } from "vitest";
import type { VyoraData } from "@/lib/vyora/types";
import {
  partyNet,
  dashboardTotals,
  allBalances,
  searchParties,
  partyStatement,
  allActivity,
} from "@/lib/vyora/selectors";
import {
  emptyData,
  addTransaction,
  addPayment,
  deleteEntry,
  editParty,
  resolvePartyRef,
  migrate,
  exportToFile,
  parseImportFile,
  VERSION,
} from "@/lib/vyora/store";

// ─── Deterministic fixture ───────────────────────────────────────────────────
const T = (n: number) => `2026-07-21T10:0${n}:00.000Z`;
const data: VyoraData = {
  version: VERSION,
  meta: { lastBackupAt: null, exportCount: 0, importCount: 0 },
  parties: [
    { id: "p1", name: "Ramesh", createdAt: T(0) },
    { id: "p2", name: "Suresh", phone: "98765", createdAt: T(1) },
    { id: "p3", name: "Cement Co", createdAt: T(2) },
  ],
  transactions: [
    { id: "t1", partyId: "p1", amount: 1000, kind: "given", date: "2026-07-10", createdAt: T(3) },
    { id: "t2", partyId: "p1", amount: 300, kind: "taken", date: "2026-07-11", createdAt: T(4) },
    { id: "t3", partyId: "p2", amount: 500, kind: "given", date: "2026-07-12", createdAt: T(5) },
    { id: "t4", partyId: "p3", amount: 2000, kind: "taken", date: "2026-07-13", createdAt: T(6) },
  ],
  payments: [
    { id: "y1", partyId: "p1", amount: 200, kind: "received", date: "2026-07-21", createdAt: T(7) },
    { id: "y2", partyId: "p3", amount: 500, kind: "paid", date: "2026-07-21", createdAt: T(8) },
  ],
};

describe("party balances (signed net, + = they owe me)", () => {
  it("nets given − taken − received across a party", () => {
    expect(partyNet(data, "p1")).toBe(500);
  });
  it("a supplier (taken + paid) is a payable, reduced by a payment made", () => {
    expect(partyNet(data, "p3")).toBe(-1500);
  });
  it("sorts all balances by absolute exposure, biggest first", () => {
    expect(allBalances(data).map((b) => b.party.id)).toEqual(["p3", "p1", "p2"]);
  });
});

describe("dashboard totals", () => {
  it("splits receivable and payable and nets them", () => {
    const t = dashboardTotals(data, "2026-07-21");
    expect(t.receivable).toBe(1000);
    expect(t.payable).toBe(1500);
    expect(t.net).toBe(-500);
  });
  it("counts only today's payments for collections/payments", () => {
    const t = dashboardTotals(data, "2026-07-21");
    expect(t.todaysCollections).toBe(200);
    expect(t.todaysPayments).toBe(500);
  });
});

describe("statement + activity ordering", () => {
  it("statement is oldest-first with a correct running balance", () => {
    expect(partyStatement(data, "p1").map((r) => r.runningNet)).toEqual([1000, 700, 500]);
  });
  it("activity is newest-first", () => {
    expect(allActivity(data)[0].id).toBe("y2");
  });
});

describe("search", () => {
  it("empty query returns all, sorted by exposure", () => {
    expect(searchParties(data, "").length).toBe(3);
  });
  it("matches name and phone, case-insensitively", () => {
    expect(searchParties(data, "ram").map((b) => b.party.id)).toEqual(["p1"]);
    expect(searchParties(data, "98765").map((b) => b.party.id)).toEqual(["p2"]);
  });
});

describe("mutations", () => {
  it("addTransaction records amount + direction, defaults the date", () => {
    const { data: d, transaction } = addTransaction(emptyData(), {
      partyId: "px",
      amount: 1850,
      kind: "given",
    });
    expect(transaction.amount).toBe(1850);
    expect(transaction.kind).toBe("given");
    expect(transaction.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.transactions).toHaveLength(1);
  });
  it("addPayment stores an absolute amount", () => {
    const { payment } = addPayment(emptyData(), { partyId: "px", amount: -500, kind: "received" });
    expect(payment.amount).toBe(500);
  });
  it("deleteEntry removes an entry so the balance re-derives correctly", () => {
    const without = deleteEntry(data, "y1");
    expect(partyNet(without, "p1")).toBe(700);
  });
});

describe("robust identity (Task 1)", () => {
  it("editing a party's name keeps its id and all history intact", () => {
    const renamed = editParty(data, "p1", { name: "Ramesh Kaka", phone: "111" });
    const p = renamed.parties.find((x) => x.id === "p1")!;
    expect(p.name).toBe("Ramesh Kaka");
    expect(p.phone).toBe("111");
    expect(partyNet(renamed, "p1")).toBe(500); // balance unchanged — history keyed by id, not name
  });
  it("an existing PartyRef binds by id (no new party); a new ref creates one", () => {
    const existing = resolvePartyRef(data, { kind: "existing", id: "p1" });
    expect(existing.partyId).toBe("p1");
    expect(existing.data.parties).toHaveLength(3); // none created

    const created = resolvePartyRef(data, { kind: "new", name: "Vijay" });
    expect(created.data.parties).toHaveLength(4);
    expect(created.data.parties.find((p) => p.id === created.partyId)?.name).toBe("Vijay");
  });
});

describe("migration is non-destructive (v1 → v2)", () => {
  it("upgrades a v1 payload, preserving every entry and adding meta", () => {
    const v1 = {
      version: 1,
      parties: data.parties,
      transactions: data.transactions,
      payments: data.payments,
    };
    const m = migrate(v1)!;
    expect(m.version).toBe(VERSION);
    expect(m.parties).toHaveLength(3);
    expect(m.transactions).toHaveLength(4);
    expect(m.meta).toEqual({ lastBackupAt: null, exportCount: 0, importCount: 0 });
    expect(partyNet(m, "p1")).toBe(500); // data intact after migration
  });
  it("rejects non-datasets (returns null, never throws)", () => {
    expect(migrate({})).toBeNull();
    expect(migrate("nonsense")).toBeNull();
    expect(migrate(null)).toBeNull();
  });
});

describe("export / import (Task 2)", () => {
  it("exports a versioned, timestamped envelope and bumps the export counter", () => {
    const { data: after, text, filename } = exportToFile(data);
    expect(after.meta.exportCount).toBe(1);
    expect(filename).toMatch(/^vyora-backup-\d{8}\.json$/);
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe("vyora");
    expect(parsed.schemaVersion).toBe(VERSION);
    expect(typeof parsed.exportedAt).toBe("string");
  });
  it("round-trips: a valid export imports cleanly with correct counts", () => {
    const { text } = exportToFile(data);
    const res = parseImportFile(text, emptyData());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.summary).toEqual({ parties: 3, transactions: 4, payments: 2 });
      expect(res.data.meta.importCount).toBe(1);
      expect(res.data.meta.lastBackupAt).toBeNull();
    }
  });
  it("detects corrupt / wrong / newer files without throwing", () => {
    expect(parseImportFile("{not json", emptyData()).ok).toBe(false);
    expect(parseImportFile(JSON.stringify({ app: "other" }), emptyData()).ok).toBe(false);
    expect(
      parseImportFile(JSON.stringify({ app: "vyora", schemaVersion: 999, data: {} }), emptyData())
        .ok
    ).toBe(false);
  });
});

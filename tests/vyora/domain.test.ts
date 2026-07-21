/**
 * Vyora Alpha — domain tests. The balance math is the product's trust; it must
 * be exactly right and never drift. Pure selectors tested on fixed fixtures;
 * mutations tested for shape/direction.
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
  findPartyByName,
} from "@/lib/vyora/selectors";
import {
  emptyData,
  addParty,
  addTransaction,
  addPayment,
  getOrCreateParty,
  deleteEntry,
} from "@/lib/vyora/store";

// ─── Deterministic fixture ───────────────────────────────────────────────────
const T = (n: number) => `2026-07-21T10:0${n}:00.000Z`; // ascending createdAt
const data: VyoraData = {
  version: 1,
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
    { id: "y1", partyId: "p1", amount: 200, kind: "received", date: "2026-07-21", createdAt: T(7) }, // today
    { id: "y2", partyId: "p3", amount: 500, kind: "paid", date: "2026-07-21", createdAt: T(8) }, // today
  ],
};

describe("party balances (signed net, + = they owe me)", () => {
  it("nets given − taken − received across a party", () => {
    // Ramesh: +1000 −300 −200 = 500 (receivable)
    expect(partyNet(data, "p1")).toBe(500);
  });
  it("a supplier (taken + paid) is a payable, then reduced by a payment made", () => {
    // Cement Co: −2000 (taken) +500 (paid) = −1500 (I owe 1500)
    expect(partyNet(data, "p3")).toBe(-1500);
  });
  it("sorts all balances by absolute exposure, biggest first", () => {
    expect(allBalances(data).map((b) => b.party.id)).toEqual(["p3", "p1", "p2"]);
  });
});

describe("dashboard totals", () => {
  it("splits receivable and payable and nets them", () => {
    const t = dashboardTotals(data, "2026-07-21");
    expect(t.receivable).toBe(1000); // Ramesh 500 + Suresh 500
    expect(t.payable).toBe(1500); // Cement Co
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
    const rows = partyStatement(data, "p1");
    expect(rows.map((r) => r.runningNet)).toEqual([1000, 700, 500]); // given, taken, received
  });
  it("activity is newest-first", () => {
    expect(allActivity(data)[0].id).toBe("y2"); // latest createdAt
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
  it("addTransaction records the amount + direction and defaults the date to today", () => {
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
    expect(partyNet(data, "p1")).toBe(500);
    const without = deleteEntry(data, "y1"); // remove the ₹200 received
    expect(partyNet(without, "p1")).toBe(700); // 1000 − 300
    expect(without.payments.find((p) => p.id === "y1")).toBeUndefined();
  });
  it("getOrCreateParty reuses by name (case-insensitive), else creates", () => {
    const base = addParty(emptyData(), { name: "Ramesh" }).data;
    const reuse = getOrCreateParty(base, "  ramesh ");
    expect(reuse.data.parties).toHaveLength(1); // reused, not duplicated
    const created = getOrCreateParty(base, "Vijay");
    expect(created.data.parties).toHaveLength(2);
    expect(findPartyByName(created.data, "vijay")?.name).toBe("Vijay");
  });
});

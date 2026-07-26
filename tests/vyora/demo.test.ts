/**
 * Vyora — Demo Mode (V1-004): "Load Demo Shop" generates a realistic ~120-customer,
 * ~2,200-transaction shop (mixed overdue, payments, suppliers, cash flow),
 * deterministic + idempotent, and Reset removes exactly it — never real data.
 */

import { describe, it, expect } from "vitest";
import {
  emptyData,
  addParty,
  seedDemoData,
  clearDemoData,
  DEMO_CUSTOMERS,
  DEMO_TRANSACTIONS,
} from "@/lib/vyora/store";
import { overdueList } from "@/lib/vyora/aging";
import { partyNet } from "@/lib/vyora/selectors";

const TODAY = "2026-07-26";

describe("demo shop", () => {
  it("loads 120 customers and 2,200 transactions, all demo-prefixed", () => {
    const d = seedDemoData(emptyData(), TODAY);
    expect(d.parties).toHaveLength(DEMO_CUSTOMERS);
    expect(d.transactions).toHaveLength(DEMO_TRANSACTIONS);
    expect(d.payments.length).toBeGreaterThan(0);
    expect(d.parties.every((p) => p.id.startsWith("demo_"))).toBe(true);
    expect(d.transactions.every((t) => t.id.startsWith("demo_"))).toBe(true);
    expect(d.payments.every((p) => p.id.startsWith("demo_"))).toBe(true);
  });

  it("has mixed overdue, suppliers and two-way cash flow", () => {
    const d = seedDemoData(emptyData(), TODAY);
    expect(overdueList(d, TODAY).length).toBeGreaterThan(0); // mixed overdue
    expect(d.transactions.some((t) => t.kind === "taken")).toBe(true); // suppliers (I buy on credit)
    expect(d.payments.some((p) => p.kind === "received")).toBe(true); // customers pay me
    expect(d.payments.some((p) => p.kind === "paid")).toBe(true); // I pay suppliers
    expect(d.parties.some((p) => partyNet(d, p.id) < 0)).toBe(true); // I owe a supplier
    expect(d.parties.some((p) => partyNet(d, p.id) > 0)).toBe(true); // a customer owes me
  });

  it("is deterministic and idempotent (re-load adds no duplicates)", () => {
    const once = seedDemoData(emptyData(), TODAY);
    const twice = seedDemoData(once, TODAY);
    expect(twice.parties).toHaveLength(DEMO_CUSTOMERS);
    expect(twice.transactions).toHaveLength(DEMO_TRANSACTIONS);
    expect(twice.payments.length).toBe(once.payments.length);
  });

  it("clears only demo records, leaving real data intact", () => {
    let d = seedDemoData(emptyData(), TODAY);
    d = addParty(d, { name: "Real Person" }).data;
    const cleared = clearDemoData(d);
    expect(cleared.parties).toHaveLength(1);
    expect(cleared.parties[0]!.name).toBe("Real Person");
    expect(cleared.transactions).toHaveLength(0);
    expect(cleared.payments).toHaveLength(0);
  });
});

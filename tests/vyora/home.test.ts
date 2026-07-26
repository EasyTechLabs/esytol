/**
 * Vyora — Merchant Home domain (V1-001): today's cash totals (shared with Daily
 * Closing) and the deterministic business-health band. Pure, single-source.
 */

import { describe, it, expect } from "vitest";
import { emptyData, addParty, addTransaction, addPayment } from "@/lib/vyora/store";
import { todayTotals } from "@/lib/vyora/selectors";
import { businessHealth } from "@/lib/vyora/aging";

const TODAY = "2026-07-26";

describe("todayTotals", () => {
  it("sums only today's credit / collection / payment and nets cash", () => {
    let d = emptyData();
    const a = addParty(d, { name: "Ravi" });
    d = a.data;
    const pid = a.party.id;
    d = addTransaction(d, { partyId: pid, amount: 1000, kind: "given", date: TODAY }).data;
    d = addPayment(d, { partyId: pid, amount: 400, kind: "received", date: TODAY }).data;
    d = addPayment(d, { partyId: pid, amount: 100, kind: "paid", date: TODAY }).data;
    d = addTransaction(d, { partyId: pid, amount: 500, kind: "given", date: "2026-07-25" }).data; // other day
    const t = todayTotals(d, TODAY);
    expect(t.credit).toBe(1000);
    expect(t.collection).toBe(400);
    expect(t.payment).toBe(100);
    expect(t.netCash).toBe(300); // 400 − 100
  });
});

describe("businessHealth", () => {
  it("is Excellent when nothing is overdue and recovery is strong", () => {
    const h = businessHealth({
      outstanding: 1000,
      overdueTotal: 0,
      totalGiven: 5000,
      totalReceived: 4000,
      collectedToday: 500,
    });
    expect(h.level).toBe("excellent");
  });

  it("is Critical when most of the book is overdue and little has come back", () => {
    const bad = businessHealth({
      outstanding: 1000,
      overdueTotal: 950,
      totalGiven: 5000,
      totalReceived: 300,
      collectedToday: 0,
    });
    const good = businessHealth({
      outstanding: 1000,
      overdueTotal: 0,
      totalGiven: 5000,
      totalReceived: 4000,
      collectedToday: 500,
    });
    expect(bad.level).toBe("critical");
    expect(bad.score).toBeLessThan(good.score);
  });

  it("treats an empty book as Excellent (nothing wrong yet)", () => {
    expect(
      businessHealth({
        outstanding: 0,
        overdueTotal: 0,
        totalGiven: 0,
        totalReceived: 0,
        collectedToday: 0,
      }).level
    ).toBe("excellent");
  });

  it("derives recovery ratio and overdue% correctly", () => {
    const h = businessHealth({
      outstanding: 1000,
      overdueTotal: 250,
      totalGiven: 800,
      totalReceived: 600,
      collectedToday: 0,
    });
    expect(h.recoveryRatio).toBeCloseTo(0.75);
    expect(h.overduePct).toBeCloseTo(0.25);
  });
});

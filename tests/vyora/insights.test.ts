/**
 * Vyora — Merchant Insights (V1-005). Pure weekly cash math (given/received/
 * recovered/lost), portfolio averages, and customer leagues.
 */

import { describe, it, expect } from "vitest";
import { emptyData } from "@/lib/vyora/store";
import { merchantInsights } from "@/lib/vyora/insights";
import type { VyoraData, Party, Transaction, Payment } from "@/lib/vyora/types";

const TODAY = "2026-07-30"; // a Thursday → this week is Mon 2026-07-27 … 2026-07-30
const party = (id: string, name: string): Party => ({
  id,
  name,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const g = (
  id: string,
  pid: string,
  amount: number,
  date: string,
  dueDate?: string
): Transaction => ({
  id,
  partyId: pid,
  amount,
  kind: "given",
  date,
  dueDate,
  createdAt: `${date}T00:00:00.000Z`,
});
const r = (id: string, pid: string, amount: number, date: string): Payment => ({
  id,
  partyId: pid,
  amount,
  kind: "received",
  date,
  createdAt: `${date}T00:00:00.000Z`,
});
const make = (parties: Party[], transactions: Transaction[], payments: Payment[]): VyoraData => ({
  ...emptyData(),
  parties,
  transactions,
  payments,
});

describe("merchantInsights — this week & averages", () => {
  const d = make(
    [party("p", "Ravi")],
    [
      g("t1", "p", 1000, "2026-05-01", "2026-05-20"), // overdue, settled this week
      g("t3", "p", 300, "2026-06-01", "2026-07-28"), // slips overdue this week, unpaid
      g("t2", "p", 500, "2026-07-30", "2026-08-15"), // given this week
    ],
    [r("y1", "p", 1000, "2026-07-30")] // received this week, settles t1
  );
  const ins = merchantInsights(d, TODAY);

  it("computes this-week given / received / recovered / lost", () => {
    expect(ins.week.given).toBe(500);
    expect(ins.week.received).toBe(1000);
    expect(ins.week.recovered).toBe(1000); // overdue credit cleared this week
    expect(ins.week.lost).toBe(300); // fell overdue this week, unpaid
  });

  it("computes averages and recovery %", () => {
    expect(ins.avgRecoveryDays).toBe(90); // t1: 2026-05-01 → 2026-07-30
    expect(ins.avgCreditDays).toBe(31); // avg of 19, 57, 16
    expect(ins.recoveryPct).toBe(56); // 1000 / 1800
  });
});

describe("merchantInsights — customer leagues", () => {
  const parties = [party("A", "Alice"), party("B", "Bob"), party("C", "Carol"), party("D", "Dave")];
  const txns: Transaction[] = [
    g("ta", "A", 1000, "2026-07-20"),
    g("tb", "B", 1000, "2026-07-20"),
    g("tc1", "C", 200, "2026-07-20"),
    g("tc2", "C", 200, "2026-07-21"),
    g("tc3", "C", 200, "2026-07-22"),
    g("tc4", "C", 200, "2026-07-23"),
    g("tc5", "C", 200, "2026-07-24"),
    g("td", "D", 1000, "2026-04-01"),
  ];
  const pays: Payment[] = [
    r("ya", "A", 900, "2026-07-25"), // 90%
    r("yb", "B", 200, "2026-07-25"), // 20%
    r("yc1", "C", 250, "2026-07-25"),
    r("yc2", "C", 250, "2026-07-25"), // 50%, most entries
    r("yd", "D", 700, "2026-04-05"), // 70%, but dormant
  ];
  const ins = merchantInsights(make(parties, txns, pays), TODAY);

  it("ranks best / worst / most-active / dormant", () => {
    expect(ins.bestPaying[0]!.name).toBe("Alice"); // 90% repaid
    expect(ins.worstPaying[0]!.name).toBe("Bob"); // 20% repaid, 800 outstanding
    expect(ins.mostActive[0]!.name).toBe("Carol"); // 7 entries
    expect(ins.dormant.map((x) => x.name)).toEqual(["Dave"]); // only one quiet 30+ days
    expect(ins.dormant[0]!.daysSince).toBeGreaterThan(30);
  });
});

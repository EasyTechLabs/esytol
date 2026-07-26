/**
 * Vyora — Ledger Engine v2 equivalence (ARCH-001). Proves the O(N) engine produces
 * byte-identical results to the existing (O(P×N)) selectors it replaces, across a
 * realistic demo shop (120 contacts / 2,200 txns) AND hand-built edge cases. If this
 * passes, rewiring screens to the engine cannot change any merchant-visible number.
 */

import { describe, it, expect } from "vitest";
import { emptyData, seedDemoData } from "@/lib/vyora/store";
import { buildLedgerEngine } from "@/lib/vyora/engine";
import { partyNet, todayTotals, allActivity } from "@/lib/vyora/selectors";
import { agingForParty, collectList, rankOverdue, allocateFifo } from "@/lib/vyora/aging";
import { customerProfile } from "@/lib/vyora/customer";
import { merchantInsights } from "@/lib/vyora/insights";
import type { VyoraData, Party, Transaction, Payment } from "@/lib/vyora/types";

const TODAY = "2026-07-30";

function agingView(a: ReturnType<typeof agingForParty>) {
  return {
    openReceivable: a.openReceivable,
    overdueAmount: a.overdueAmount,
    daysOverdue: a.daysOverdue,
    oldestOpenDays: a.oldestOpenDays,
    buckets: a.buckets,
  };
}

// Reference due-today/tomorrow the old (per-party FIFO) way.
function dueRef(data: VyoraData, today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
  let dueToday = 0;
  let dueTomorrow = 0;
  let dueTodayCount = 0;
  let dueTomorrowCount = 0;
  for (const party of data.parties) {
    const given = data.transactions.filter((t) => t.partyId === party.id && t.kind === "given");
    let pool = 0;
    for (const p of data.payments)
      if (p.partyId === party.id && p.kind === "received") pool += p.amount;
    let dt = 0;
    let dm = 0;
    for (const lot of allocateFifo(given, pool)) {
      if (lot.openAmount <= 0 || !lot.dueDate) continue;
      if (lot.dueDate === today) dt += lot.openAmount;
      else if (lot.dueDate === tomorrow) dm += lot.openAmount;
    }
    dueToday += dt;
    dueTomorrow += dm;
    if (dt > 0) dueTodayCount += 1;
    if (dm > 0) dueTomorrowCount += 1;
  }
  return { dueToday, dueTomorrow, dueTodayCount, dueTomorrowCount };
}

function assertEngineMatches(data: VyoraData, today: string) {
  const eng = buildLedgerEngine(data, today);

  // Balances (== partyNet) + aging (== agingForParty aggregates), for every party.
  for (const p of data.parties) {
    expect(eng.getNet(p.id)).toBe(partyNet(data, p.id));
    expect(agingView(eng.getAging(p.id))).toEqual(agingView(agingForParty(data, p.id, today)));
    expect(eng.getProfile(p.id)).toEqual(customerProfile(data, p.id, today));
  }

  // Recovery (== collectList + rankOverdue).
  const cl = collectList(data, today);
  expect(eng.recovery.overdue).toEqual(rankOverdue(data, cl.overdue));
  expect(eng.recovery.open).toEqual(cl.open);

  // Recovery totals (== reference sums).
  let outstanding = 0;
  let overdueTotal = 0;
  let totalGiven = 0;
  let totalReceived = 0;
  for (const p of data.parties) {
    const a = agingForParty(data, p.id, today);
    outstanding += a.openReceivable;
    if (a.overdueAmount > 0 && a.daysOverdue !== null) overdueTotal += a.overdueAmount;
  }
  for (const t of data.transactions) if (t.kind === "given") totalGiven += t.amount;
  for (const p of data.payments) if (p.kind === "received") totalReceived += p.amount;
  expect(eng.recovery.outstanding).toBe(Math.round(outstanding));
  expect(eng.recovery.overdueTotal).toBe(Math.round(overdueTotal));
  expect(eng.recovery.totalGiven).toBe(Math.round(totalGiven));
  expect(eng.recovery.totalReceived).toBe(Math.round(totalReceived));
  const due = dueRef(data, today);
  expect(eng.recovery.dueToday).toBe(Math.round(due.dueToday));
  expect(eng.recovery.dueTomorrow).toBe(Math.round(due.dueTomorrow));
  expect(eng.recovery.dueTodayCount).toBe(due.dueTodayCount);
  expect(eng.recovery.dueTomorrowCount).toBe(due.dueTomorrowCount);

  // Stats + timeline (== existing selectors).
  expect(eng.statistics.insights).toEqual(merchantInsights(data, today));
  expect(eng.statistics.today).toEqual(todayTotals(data, today));
  expect(eng.timeline).toEqual(allActivity(data));
}

describe("LedgerEngine — equivalence with existing selectors", () => {
  it("matches on a realistic 120-contact / 2,200-txn demo shop", () => {
    assertEngineMatches(seedDemoData(emptyData(), TODAY), TODAY);
  });

  it("matches on an empty ledger", () => {
    assertEngineMatches(emptyData(), TODAY);
  });

  it("matches on mixed edge cases (given/taken/received/paid, overdue, settled, due today)", () => {
    const parties: Party[] = [
      { id: "a", name: "Alice", phone: "9990001111", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", name: "Bob Supplier", createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "c", name: "Carol", createdAt: "2026-03-01T00:00:00.000Z" },
    ];
    const txns: Transaction[] = [
      {
        id: "t1",
        partyId: "a",
        amount: 5000,
        kind: "given",
        date: "2026-06-01",
        dueDate: "2026-06-20",
        createdAt: "2026-06-01T00:00:00.000Z",
      }, // overdue
      {
        id: "t2",
        partyId: "a",
        amount: 1200,
        kind: "given",
        date: "2026-07-25",
        dueDate: "2026-07-30",
        createdAt: "2026-07-25T00:00:00.000Z",
      }, // due today
      {
        id: "t3",
        partyId: "b",
        amount: 8000,
        kind: "taken",
        date: "2026-07-10",
        createdAt: "2026-07-10T00:00:00.000Z",
      }, // I owe supplier
      {
        id: "t4",
        partyId: "c",
        amount: 2000,
        kind: "given",
        date: "2026-07-01",
        dueDate: "2026-06-25",
        createdAt: "2026-07-01T00:00:00.000Z",
      }, // settled
    ];
    const pays: Payment[] = [
      {
        id: "p1",
        partyId: "a",
        amount: 1000,
        kind: "received",
        mode: "upi",
        date: "2026-07-20",
        createdAt: "2026-07-20T00:00:00.000Z",
      },
      {
        id: "p2",
        partyId: "b",
        amount: 3000,
        kind: "paid",
        date: "2026-07-15",
        createdAt: "2026-07-15T00:00:00.000Z",
      },
      {
        id: "p3",
        partyId: "c",
        amount: 2000,
        kind: "received",
        date: "2026-07-12",
        createdAt: "2026-07-12T00:00:00.000Z",
      },
    ];
    assertEngineMatches({ ...emptyData(), parties, transactions: txns, payments: pays }, TODAY);
  });
});

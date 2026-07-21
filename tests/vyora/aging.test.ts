/**
 * Vyora — aging engine tests (Epic A · Mission A1). The recovery numbers must be
 * exactly right and, above all, HONEST: no fabricated "overdue", receivable-side
 * only, deterministic given an injected `today`.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { VyoraData, Transaction, Payment } from "@/lib/vyora/types";
import {
  daysBetween,
  allocateFifo,
  agingForParty,
  overdueList,
  portfolioAging,
  recoverySummary,
  collectList,
} from "@/lib/vyora/aging";

const TODAY = "2026-07-21";
const at = (d: string) => `${d}T10:00:00.000Z`;

function tx(
  id: string,
  partyId: string,
  amount: number,
  kind: Transaction["kind"],
  date: string,
  dueDate?: string
): Transaction {
  return { id, partyId, amount, kind, date, dueDate, createdAt: at(date) };
}
function pay(
  id: string,
  partyId: string,
  amount: number,
  kind: Payment["kind"],
  date: string
): Payment {
  return { id, partyId, amount, kind, date, createdAt: at(date) };
}
function data(
  parties: VyoraData["parties"],
  transactions: Transaction[],
  payments: Payment[] = []
): VyoraData {
  return {
    version: 2,
    meta: { lastBackupAt: null, exportCount: 0, importCount: 0 },
    parties,
    transactions,
    payments,
  };
}
const P = (id: string) => ({ id, name: id, createdAt: at("2026-01-01") });

// ─── daysBetween ─────────────────────────────────────────────────────────────
describe("daysBetween", () => {
  it("counts whole days, signed", () => {
    expect(daysBetween("2026-07-10", "2026-07-21")).toBe(11);
    expect(daysBetween("2026-05-01", "2026-07-21")).toBe(81);
    expect(daysBetween("2026-08-01", "2026-07-21")).toBe(-11); // future due date
    expect(daysBetween("2026-07-21", "2026-07-21")).toBe(0);
  });
});

// ─── FIFO allocation ─────────────────────────────────────────────────────────
describe("allocateFifo", () => {
  const c1 = tx("c1", "p", 5000, "given", "2026-05-01");
  const c2 = tx("c2", "p", 3000, "given", "2026-06-01");

  it("applies payments oldest-first, leaving residual on the newer credit", () => {
    const lots = allocateFifo([c2, c1], 6000); // pass out of order to prove sorting
    expect(lots.map((l) => l.transactionId)).toEqual(["c1", "c2"]);
    expect(lots[0].openAmount).toBe(0); // c1 fully covered (5000)
    expect(lots[1].openAmount).toBe(2000); // c2 left with 3000 − 1000
  });

  it("over-payment closes everything (never goes negative)", () => {
    const lots = allocateFifo([c1, c2], 10_000);
    expect(lots.every((l) => l.openAmount === 0)).toBe(true);
  });

  it("no payment leaves both fully open", () => {
    const lots = allocateFifo([c1, c2], 0);
    expect(lots.map((l) => l.openAmount)).toEqual([5000, 3000]);
  });

  it("uses dueDate as the ordering basis when present", () => {
    const early = tx("e", "p", 100, "given", "2026-06-10", "2026-06-20");
    const late = tx("l", "p", 100, "given", "2026-06-01", "2026-07-30");
    const lots = allocateFifo([late, early], 100);
    expect(lots[0].transactionId).toBe("e"); // earlier DUE date wins, not entry date
    expect(lots[0].openAmount).toBe(0);
  });
});

// ─── agingForParty ───────────────────────────────────────────────────────────
describe("agingForParty", () => {
  it("flags a passed due date as overdue, with correct daysOverdue", () => {
    const d = data([P("p")], [tx("t", "p", 5000, "given", "2026-04-20", "2026-05-01")]);
    const a = agingForParty(d, "p", TODAY);
    expect(a.overdueAmount).toBe(5000);
    expect(a.daysOverdue).toBe(81); // days past the 1 May due date
    expect(a.buckets["60+"]).toBe(5000);
  });

  it("never fabricates overdue for an undated debt — it ages 'open' from entry date", () => {
    const d = data([P("p")], [tx("t", "p", 1000, "given", "2026-05-20")]);
    const a = agingForParty(d, "p", TODAY);
    expect(a.overdueAmount).toBe(0);
    expect(a.daysOverdue).toBeNull();
    expect(a.openReceivable).toBe(1000);
    expect(a.oldestOpenDays).toBe(62); // aged from the entry date, not "overdue"
    expect(a.buckets["60+"]).toBe(1000);
  });

  it("a future due date is open but not overdue", () => {
    const d = data([P("p")], [tx("t", "p", 4000, "given", "2026-07-15", "2026-08-01")]);
    const a = agingForParty(d, "p", TODAY);
    expect(a.overdueAmount).toBe(0);
    expect(a.openReceivable).toBe(4000);
  });

  it("due date exactly today is not yet overdue", () => {
    const d = data([P("p")], [tx("t", "p", 900, "given", "2026-07-01", TODAY)]);
    expect(agingForParty(d, "p", TODAY).overdueAmount).toBe(0);
  });

  it("bucket boundaries: 30 → 30-60, 60 → 60+", () => {
    const d = data(
      [P("p")],
      [
        tx("b30", "p", 100, "given", "2026-06-01", "2026-06-21"), // exactly 30 days
        tx("b60", "p", 200, "given", "2026-05-01", "2026-05-22"), // exactly 60 days
      ]
    );
    const a = agingForParty(d, "p", TODAY);
    expect(a.buckets["30-60"]).toBe(100);
    expect(a.buckets["60+"]).toBe(200);
    expect(a.buckets["0-30"]).toBe(0);
  });

  it("a fully-paid contact has nothing open or overdue", () => {
    const d = data(
      [P("p")],
      [tx("t", "p", 5000, "given", "2026-04-20", "2026-05-01")],
      [pay("r", "p", 5000, "received", "2026-06-01")]
    );
    const a = agingForParty(d, "p", TODAY);
    expect(a.openReceivable).toBe(0);
    expect(a.overdueAmount).toBe(0);
    expect(a.lots).toHaveLength(0);
  });

  it("partial payment reduces the OLDEST overdue lot first", () => {
    const d = data(
      [P("p")],
      [
        tx("old", "p", 3000, "given", "2026-04-20", "2026-05-01"),
        tx("new", "p", 3000, "given", "2026-06-20", "2026-07-01"),
      ],
      [pay("r", "p", 3000, "received", "2026-07-05")]
    );
    const a = agingForParty(d, "p", TODAY);
    expect(a.openReceivable).toBe(3000); // only the newer lot remains
    const openLot = a.lots.find((l) => l.openAmount > 0);
    expect(openLot?.transactionId).toBe("new");
  });

  it("is receivable-side only: a payable contact (taken/paid) is never aged", () => {
    const d = data(
      [P("p")],
      [tx("t", "p", 8000, "taken", "2026-04-01", "2026-04-15")], // merchant OWES them
      [pay("paid", "p", 2000, "paid", "2026-05-01")]
    );
    const a = agingForParty(d, "p", TODAY);
    expect(a.openReceivable).toBe(0);
    expect(a.overdueAmount).toBe(0);
    expect(a.lots).toHaveLength(0);
  });

  it("a both-directions contact ages only the receivable portion", () => {
    const d = data(
      [P("p")],
      [
        tx("g", "p", 5000, "given", "2026-04-20", "2026-05-01"), // receivable, overdue
        tx("t", "p", 9000, "taken", "2026-04-01", "2026-04-10"), // payable, ignored by aging
      ]
    );
    const a = agingForParty(d, "p", TODAY);
    expect(a.overdueAmount).toBe(5000);
    expect(a.openReceivable).toBe(5000);
  });
});

// ─── overdueList (Who to chase today) ────────────────────────────────────────
describe("overdueList", () => {
  it("ranks by overdueAmount × daysOverdue (desc), excludes payable & not-yet-due", () => {
    const d = data(
      [P("A"), P("B"), P("C"), P("D"), P("E")],
      [
        tx("a", "A", 5000, "given", "2026-04-20", "2026-05-01"), // 5000 × 81 = biggest
        tx("b", "B", 3000, "given", "2026-06-01", "2026-06-11"), // 3000 × 40
        tx("c", "C", 2000, "given", "2026-07-05", "2026-07-10"), // 2000 × 11 = smallest
        tx("d", "D", 9000, "taken", "2026-04-01", "2026-04-10"), // payable → excluded
        tx("e", "E", 8000, "given", "2026-07-15", "2026-08-15"), // future due → excluded
      ]
    );
    const rows = overdueList(d, TODAY);
    expect(rows.map((r) => r.partyId)).toEqual(["A", "B", "C"]);
    expect(rows[0].overdueAmount).toBe(5000);
  });

  it("tie-break on equal leverage prefers the more overdue (older) contact", () => {
    const d = data(
      [P("X"), P("Y")],
      [
        tx("x", "X", 2000, "given", "2026-06-01", "2026-06-21"), // 2000 × 30 = 60000
        tx("y", "Y", 3000, "given", "2026-06-11", "2026-07-01"), // 3000 × 20 = 60000
      ]
    );
    const rows = overdueList(d, TODAY);
    expect(rows.map((r) => r.partyId)).toEqual(["X", "Y"]); // X is older (30 > 20)
  });

  it("empty when nobody is overdue", () => {
    const d = data([P("p")], [tx("t", "p", 1000, "given", "2026-07-15", "2026-08-01")]);
    expect(overdueList(d, TODAY)).toEqual([]);
  });
});

// ─── portfolioAging ──────────────────────────────────────────────────────────
describe("portfolioAging", () => {
  it("sums buckets and counts overdue contacts", () => {
    const d = data(
      [P("A"), P("B"), P("C")],
      [
        tx("a", "A", 5000, "given", "2026-04-20", "2026-05-01"), // 60+, overdue
        tx("b", "B", 3000, "given", "2026-06-01", "2026-06-11"), // 30-60, overdue
        tx("c", "C", 1000, "given", "2026-07-18"), // undated, 0-30, NOT overdue
      ]
    );
    const pf = portfolioAging(d, TODAY);
    expect(pf.overdueTotal).toBe(8000);
    expect(pf.openReceivableTotal).toBe(9000);
    expect(pf.overdueContactCount).toBe(2);
    expect(pf.buckets["60+"]).toBe(5000);
    expect(pf.buckets["30-60"]).toBe(3000);
    expect(pf.buckets["0-30"]).toBe(1000);
  });
});

// ─── recoverySummary (dashboard card) ────────────────────────────────────────
describe("recoverySummary", () => {
  it("summarises outstanding, overdue, count, and the highest-priority contact", () => {
    const d = data(
      [P("A"), P("B"), P("C")],
      [
        tx("a", "A", 5000, "given", "2026-04-20", "2026-05-01"), // overdue, biggest × oldest
        tx("b", "B", 3000, "given", "2026-06-01", "2026-06-11"), // overdue
        tx("c", "C", 1000, "given", "2026-07-18"), // undated → open, NOT overdue
      ]
    );
    const s = recoverySummary(d, TODAY);
    expect(s.outstanding).toBe(9000); // all open receivable
    expect(s.overdueTotal).toBe(8000); // only the two overdue
    expect(s.overdueContactCount).toBe(2);
    expect(s.highestPriority?.partyId).toBe("A"); // 5000 × 81 leads
  });

  it("reports no overdue (highestPriority null) when nothing is late", () => {
    const d = data([P("p")], [tx("t", "p", 1000, "given", "2026-07-15", "2026-08-01")]);
    const s = recoverySummary(d, TODAY);
    expect(s.overdueContactCount).toBe(0);
    expect(s.overdueTotal).toBe(0);
    expect(s.highestPriority).toBeNull();
    expect(s.outstanding).toBe(1000); // still outstanding, just not overdue
  });
});

// ─── collectList (Collect screen) ────────────────────────────────────────────
describe("collectList", () => {
  it("splits overdue vs open honestly, receivable-only, each sorted", () => {
    const d = data(
      [P("A"), P("B"), P("C"), P("D"), P("E")],
      [
        tx("a", "A", 5000, "given", "2026-04-20", "2026-05-01"), // overdue (5000 × 81)
        tx("b", "B", 3000, "given", "2026-06-01", "2026-06-11"), // overdue (3000 × 40)
        tx("c", "C", 1000, "given", "2026-05-20"), // undated → OPEN (62d), never overdue
        tx("d", "D", 2000, "given", "2026-07-15", "2026-08-01"), // future due → OPEN (not due)
        tx("e", "E", 8000, "taken", "2026-04-01", "2026-04-10"), // payable → neither list
      ]
    );
    const { overdue, open } = collectList(d, TODAY);
    expect(overdue.map((r) => r.partyId)).toEqual(["A", "B"]); // amount × days
    expect(open.map((r) => r.partyId)).toEqual(["C", "D"]); // oldest-open first (C 62d > D future)
    // honesty: C is OPEN, not overdue
    const c = open.find((r) => r.partyId === "C");
    expect(c?.openReceivable).toBe(1000);
    expect(c?.oldestOpenDays).toBe(62);
    // E (payable) is in neither list
    expect([...overdue, ...open].some((r) => r.partyId === "E")).toBe(false);
  });

  it("empty overdue but populated open when nobody is late", () => {
    const d = data([P("p")], [tx("t", "p", 1000, "given", "2026-07-15", "2026-08-01")]);
    const { overdue, open } = collectList(d, TODAY);
    expect(overdue).toHaveLength(0);
    expect(open.map((r) => r.partyId)).toEqual(["p"]);
  });
});

// ─── determinism & honesty guards ────────────────────────────────────────────
describe("determinism", () => {
  const d = data(
    [P("A"), P("B")],
    [
      tx("a", "A", 5000, "given", "2026-04-20", "2026-05-01"),
      tx("b", "B", 3000, "given", "2026-06-01", "2026-06-11"),
    ]
  );

  it("returns identical results across repeated calls", () => {
    expect(overdueList(d, TODAY)).toEqual(overdueList(d, TODAY));
    expect(portfolioAging(d, TODAY)).toEqual(portfolioAging(d, TODAY));
  });

  it("uses no wall-clock — `today` is always injected", () => {
    const src = readFileSync("lib/vyora/aging.ts", "utf8");
    expect(src.includes("new Date(")).toBe(false);
    expect(src.includes("Date.now(")).toBe(false);
  });
});

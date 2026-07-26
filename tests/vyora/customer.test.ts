/**
 * Vyora — Customer 360 profile (V1-002): lifetime totals, FIFO average payment
 * time, longest delay, status, and relationship stats. Pure; "unknown stays null".
 */

import { describe, it, expect } from "vitest";
import { emptyData } from "@/lib/vyora/store";
import { customerProfile } from "@/lib/vyora/customer";
import type { VyoraData, Party, Transaction, Payment } from "@/lib/vyora/types";

const party = (id: string, name: string, phone?: string): Party => ({
  id,
  name,
  phone,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const txn = (id: string, amount: number, date: string, dueDate?: string): Transaction => ({
  id,
  partyId: "p",
  amount,
  kind: "given",
  date,
  dueDate,
  createdAt: `${date}T00:00:00.000Z`,
});
const pay = (id: string, amount: number, date: string): Payment => ({
  id,
  partyId: "p",
  amount,
  kind: "received",
  date,
  createdAt: `${date}T00:00:00.000Z`,
});
const make = (over: Partial<VyoraData>): VyoraData => ({
  ...emptyData(),
  parties: [party("p", "R")],
  ...over,
});

const AT = "2026-07-20";

describe("customerProfile", () => {
  it("computes lifetime totals, largest entries, last activity and customer-since", () => {
    const d = make({
      transactions: [txn("t1", 1000, "2026-07-01", "2026-07-15"), txn("t2", 300, "2026-07-05")],
      payments: [pay("y1", 800, "2026-07-10")],
    });
    const p = customerProfile(d, "p", AT)!;
    expect(p.lifetimeCredit).toBe(1300);
    expect(p.lifetimePayment).toBe(800);
    expect(p.largestPurchase).toBe(1000);
    expect(p.largestPayment).toBe(800);
    expect(p.lastActivity).toBe("2026-07-10");
    expect(p.customerSince).toBe("2026-01-01");
    expect(p.outstanding).toBe(500); // 1300 given − 800 received
  });

  it("averages FIFO payment time and is null until something is settled", () => {
    const settled = customerProfile(
      make({
        transactions: [txn("t1", 1000, "2026-07-01")],
        payments: [pay("y1", 1000, "2026-07-11")],
      }),
      "p",
      AT
    )!;
    expect(settled.avgPaymentDays).toBe(10);

    const unpaid = customerProfile(
      make({ transactions: [txn("t1", 1000, "2026-07-01", "2026-07-05")], payments: [] }),
      "p",
      AT
    )!;
    expect(unpaid.avgPaymentDays).toBeNull();
  });

  it("tracks the longest delay (late settlement or current overdue)", () => {
    const late = customerProfile(
      make({
        transactions: [txn("t1", 1000, "2026-07-01", "2026-07-05")],
        payments: [pay("y1", 1000, "2026-07-12")],
      }),
      "p",
      AT
    )!;
    expect(late.status).toBe("settled");
    expect(late.longestDelayDays).toBe(7); // paid 7 days after due
    expect(late.avgPaymentDays).toBe(11);

    const overdue = customerProfile(
      make({ transactions: [txn("t1", 1000, "2026-07-01", "2026-07-05")], payments: [] }),
      "p",
      AT
    )!;
    expect(overdue.status).toBe("overdue");
    expect(overdue.longestDelayDays).toBe(15); // 07-05 → 07-20
  });

  it("bands status: settled / overdue / good", () => {
    expect(customerProfile(make({}), "p", AT)!.status).toBe("settled"); // no entries → net 0
    expect(
      customerProfile(
        make({ transactions: [txn("t1", 500, "2026-07-01", "2026-12-31")] }),
        "p",
        AT
      )!.status
    ).toBe("good"); // owes, due far away
  });

  it("returns null for an unknown contact", () => {
    expect(customerProfile(make({}), "ghost", AT)).toBeNull();
  });
});

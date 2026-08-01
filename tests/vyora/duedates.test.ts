/**
 * Vyora — due date experience tests (V2-003).
 *
 * Two promises:
 *
 *  1. **A tap produces the right real date**, shown in words a merchant can
 *     picture — and the arithmetic survives month ends and leap days.
 *  2. **Nothing estimated is ever called overdue.** Only a real due date that
 *     has passed earns that word; an undated credit is old, not late.
 */

import { describe, it, expect } from "vitest";
import {
  CREDIT_PERIODS,
  DEFAULT_CREDIT_PERIOD,
  addDays,
  dueSummary,
  isOverdue,
  periodLabel,
  previewDueDate,
  remainingLabel,
} from "@/lib/vyora/duedates";
import { DEFAULT_SETTINGS, creditDaysFor, normalizeSettings } from "@/lib/vyora/settings";
import { buildRecoveryList } from "@/lib/vyora/recovery";
import { GOLDEN_TODAY, goldenEvents, goldenLedger } from "./golden-ledger";

describe("one tap gives the right date", () => {
  it("offers the periods a merchant actually uses", () => {
    expect(CREDIT_PERIODS).toEqual([0, 7, 15, 30, 45]);
    expect(DEFAULT_CREDIT_PERIOD).toBe(30);
    expect(periodLabel(0)).toBe("Today");
    expect(periodLabel(30)).toBe("30 days");
  });

  it("adds days correctly, including across a month end", () => {
    expect(addDays("2026-08-01", 0)).toBe("2026-08-01");
    expect(addDays("2026-08-01", 17)).toBe("2026-08-18");
    expect(addDays("2026-08-20", 15)).toBe("2026-09-04");
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-28", 2)).toBe("2028-03-01");
  });

  it("shows the date in words, with the weekday", () => {
    const preview = previewDueDate("2026-08-18");
    expect(preview?.short).toBe("18 Aug");
    expect(preview?.weekday).toBe("Tuesday");
  });

  it("returns nothing for a date it cannot read", () => {
    expect(previewDueDate("not-a-date")).toBeNull();
  });
});

describe("remaining days never overstate lateness", () => {
  const today = "2026-08-01";

  it("counts down to the due date", () => {
    expect(remainingLabel(addDays(today, 5), today)).toBe("Due in 5 days");
    expect(remainingLabel(addDays(today, 1), today)).toBe("Due tomorrow");
    expect(remainingLabel(today, today)).toBe("Due today");
  });

  it("counts up only after it has genuinely passed", () => {
    expect(remainingLabel(addDays(today, -1), today)).toBe("Overdue by 1 day");
    expect(remainingLabel(addDays(today, -12), today)).toBe("Overdue by 12 days");
  });

  it("does not call a due-today credit overdue", () => {
    expect(isOverdue(today, today)).toBe(false);
    expect(isOverdue(addDays(today, 1), today)).toBe(false);
    expect(isOverdue(addDays(today, -1), today)).toBe(true);
  });
});

describe("the merchant's preference is remembered", () => {
  it("falls back to the last period the merchant chose", () => {
    const settings = { ...DEFAULT_SETTINGS, lastCreditDays: 15 };
    expect(creditDaysFor(settings)).toBe(15);
    expect(creditDaysFor(settings, "unknown-contact")).toBe(15);
  });

  it("prefers a contact's own habit over the global default", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      lastCreditDays: 15,
      contactCreditDays: { p1: 45 },
    };
    expect(creditDaysFor(settings, "p1")).toBe(45);
    expect(creditDaysFor(settings, "p2")).toBe(15);
  });

  it("honours a contact who pays same-day", () => {
    const settings = { ...DEFAULT_SETTINGS, contactCreditDays: { p1: 0 } };
    expect(creditDaysFor(settings, "p1")).toBe(0);
  });

  it("refuses nonsense read off the device", () => {
    const loaded = normalizeSettings({
      lastCreditDays: -5,
      contactCreditDays: { good: 30, bad: "soon", negative: -1, huge: 9999 },
    });
    expect(loaded.lastCreditDays).toBe(30);
    expect(loaded.contactCreditDays).toEqual({ good: 30 });
  });
});

describe("dashboard due totals read the existing index", () => {
  const ledger = goldenLedger();

  it("splits today, this week and overdue without double counting", () => {
    const summary = dueSummary(ledger, GOLDEN_TODAY);
    expect(summary.overdueCount).toBeGreaterThan(0);
    // "Today" is part of "this week", so the week figure includes it.
    expect(summary.weekCount).toBeGreaterThanOrEqual(summary.todayCount);
    expect(summary.weekAmount).toBeGreaterThanOrEqual(summary.todayAmount);
  });

  it("counts only credit the merchant gave, never a supplier's due date", () => {
    let givenDue = 0;
    for (const t of ledger.data.transactions) {
      if (t.kind === "given" && t.dueDate && t.dueDate < GOLDEN_TODAY) givenDue += t.amount;
    }
    expect(dueSummary(ledger, GOLDEN_TODAY).overdueAmount).toBe(givenDue);
  });

  it("reports nothing on a ledger with no due dates at all", () => {
    const bare = {
      ...ledger,
      due: {
        transactionsByDueDate: new Map(),
        dueDatesAscending: [],
        earliestDueDateByParty: new Map(),
      },
    };
    expect(dueSummary(bare, GOLDEN_TODAY)).toEqual({
      todayAmount: 0,
      todayCount: 0,
      weekAmount: 0,
      weekCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
    });
  });
});

describe("recovery prefers real due dates over estimated aging", () => {
  const list = buildRecoveryList(goldenLedger(), goldenEvents(), GOLDEN_TODAY);

  it("only marks a contact overdue when a real due date has passed", () => {
    for (const item of list) {
      if (item.daysOverdue > 0) {
        expect(item.oldestDueDate).toBeTruthy();
        expect((item.oldestDueDate as string) < GOLDEN_TODAY).toBe(true);
      }
    }
  });

  it("still ages an undated credit, but never calls it overdue", () => {
    const undated = list.filter((i) => !i.oldestDueDate);
    expect(undated.length).toBeGreaterThan(0);
    for (const item of undated) {
      expect(item.daysOverdue).toBe(0);
      expect(item.bucket).toBe("current");
      expect(item.daysOutstanding).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses the real overdue age for ranking when it exists", () => {
    const overdue = list.filter((i) => i.daysOverdue > 0);
    expect(overdue.length).toBeGreaterThan(0);
    for (const item of overdue.slice(0, 20)) {
      expect(item.agingDays).toBe(item.daysOverdue);
    }
  });
});

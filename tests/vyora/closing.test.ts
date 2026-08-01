/**
 * Vyora — Daily Closing tests (V2-004).
 *
 * Three things the merchant relies on:
 *
 *  1. **The day's figures agree with the ledger.** Closing must never be a
 *     second, drifting set of numbers — every figure is cross-checked against
 *     the selectors it came from.
 *  2. **Closing a day changes nothing.** It is a signature, not a transaction:
 *     no balance moves, no entry is touched.
 *  3. **A signed-off day stays signed off.** Recording a back-dated entry later
 *     must not silently rewrite a report the merchant already reviewed.
 */

import { describe, it, expect } from "vitest";
import { applyEvent, reduceEvents } from "@/lib/vyora/events";
import { buildLedger, readDashboardTotals } from "@/lib/vyora/ledger";
import { executeCommand, validateCommand, type CommandContext } from "@/lib/vyora/commands";
import { buildDailyClosing, closingHistory } from "@/lib/vyora/closing";
import { dueSummary, addDays } from "@/lib/vyora/duedates";
import { DEFAULT_SETTINGS } from "@/lib/vyora/settings";
import { GOLDEN_TODAY, goldenEvents, goldenLedger, goldenProjection } from "./golden-ledger";

const LEDGER = goldenLedger();
const EVENTS = goldenEvents();
const CONTEXT: CommandContext = { ledger: LEDGER, events: EVENTS };

/** A date the golden ledger actually traded on. */
const BUSY_DAY = goldenProjection().payments[0].date;

function closingFor(date: string) {
  return buildDailyClosing(LEDGER, EVENTS, DEFAULT_SETTINGS, date);
}

describe("the day's figures agree with the ledger", () => {
  const closing = closingFor(BUSY_DAY);

  it("takes collections and payments straight from the statistics index", () => {
    const totals = readDashboardTotals(LEDGER, BUSY_DAY);
    expect(closing.summary.collected).toBe(totals.todaysCollections);
    expect(closing.summary.paidOut).toBe(totals.todaysPayments);
  });

  it("computes net cash as collected minus paid out", () => {
    expect(closing.summary.netCash).toBe(closing.summary.collected - closing.summary.paidOut);
  });

  it("computes the outstanding change as credit given minus collected", () => {
    expect(closing.summary.outstandingChange).toBe(
      closing.summary.creditGiven - closing.summary.collected
    );
  });

  it("sums credit given today from the ledger's own rows", () => {
    let expected = 0;
    for (const t of goldenProjection().transactions) {
      if (t.date === BUSY_DAY && t.kind === "given") expected += t.amount;
    }
    expect(closing.summary.creditGiven).toBe(expected);
  });

  it("lists exactly today's activity, newest first", () => {
    expect(closing.activity.length).toBeGreaterThan(0);
    for (const item of closing.activity) expect(item.date).toBe(BUSY_DAY);
    const stamps = closing.activity.map((i) => i.createdAt);
    expect(stamps.every((v, i) => i === 0 || stamps[i - 1] >= v)).toBe(true);
  });

  it("reuses dueSummary rather than recomputing the week", () => {
    expect(closing.week).toEqual(dueSummary(LEDGER, BUSY_DAY));
  });

  it("reports a quiet day as genuinely empty", () => {
    const quiet = closingFor("2019-01-01");
    expect(quiet.summary.collected).toBe(0);
    expect(quiet.summary.creditGiven).toBe(0);
    expect(quiet.summary.netCash).toBe(0);
    expect(quiet.activity).toEqual([]);
    expect(quiet.wins).toEqual([]);
  });
});

describe("tomorrow's collections", () => {
  it("only lists people who are due tomorrow AND still owe money", () => {
    const closing = closingFor(GOLDEN_TODAY);
    const tomorrow = addDays(GOLDEN_TODAY, 1);
    const dueIds = new Set(
      (LEDGER.due.transactionsByDueDate.get(tomorrow) ?? [])
        .filter((t) => t.kind === "given")
        .map((t) => t.partyId)
    );
    for (const item of closing.tomorrow) {
      expect(dueIds.has(item.party.id)).toBe(true);
      expect(item.outstanding).toBeGreaterThan(0);
    }
  });

  it("keeps the recovery workspace's own priority order", () => {
    const closing = closingFor(GOLDEN_TODAY);
    for (let i = 1; i < closing.tomorrow.length; i++) {
      expect(closing.tomorrow[i - 1].priority).toBeGreaterThanOrEqual(closing.tomorrow[i].priority);
    }
  });
});

describe("wins are deterministic and never flattering", () => {
  it("claims nothing on a day with no money in", () => {
    expect(closingFor("2019-01-01").wins).toEqual([]);
  });

  it("shows collected only when something was collected", () => {
    const closing = closingFor(BUSY_DAY);
    const collected = closing.wins.find((w) => w.label === "Collected");
    if (closing.summary.collected > 0) expect(collected).toBeDefined();
    else expect(collected).toBeUndefined();
  });

  it("caps the recovery rate at 100%", () => {
    const rate = closingFor(BUSY_DAY).wins.find((w) => w.label === "Recovery rate");
    if (rate) expect(Number(rate.value.replace("%", ""))).toBeLessThanOrEqual(100);
  });

  it("produces the same wins on every build", () => {
    expect(closingFor(BUSY_DAY).wins).toEqual(closingFor(BUSY_DAY).wins);
  });
});

describe("closing a day is a signature, not a transaction", () => {
  const closing = closingFor(BUSY_DAY);

  it("emits one DayClosed event and moves no balance", () => {
    const result = executeCommand(CONTEXT, {
      type: "CloseDay",
      date: BUSY_DAY,
      summary: closing.summary,
      notes: "  counted the till  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.type)).toEqual(["DayClosed"]);

    const after = buildLedger(result.events.reduce(applyEvent, LEDGER.data));
    expect(after.statistics.net).toBe(LEDGER.statistics.net);
    expect(after.statistics.entryCount).toBe(LEDGER.statistics.entryCount);
    expect(after.data.transactions.length).toBe(LEDGER.data.transactions.length);
  });

  it("trims the note it stores", () => {
    const result = executeCommand(CONTEXT, {
      type: "CloseDay",
      date: BUSY_DAY,
      summary: closing.summary,
      notes: "  counted the till  ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.events[0];
    expect(event.type === "DayClosed" && event.notes).toBe("counted the till");
  });

  it("refuses a malformed date", () => {
    expect(
      validateCommand(CONTEXT, {
        type: "CloseDay",
        date: "01-08-2026",
        summary: closing.summary,
        notes: "",
      })?.code
    ).toBe("DATE_INVALID");
  });

  it("marks the day as closed once it has been signed off", () => {
    expect(closingFor(BUSY_DAY).closed).toBe(false);
    const result = executeCommand(CONTEXT, {
      type: "CloseDay",
      date: BUSY_DAY,
      summary: closing.summary,
      notes: "",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const events = [...EVENTS, ...result.events];
    const after = buildDailyClosing(
      buildLedger(reduceEvents(events)),
      events,
      DEFAULT_SETTINGS,
      BUSY_DAY
    );
    expect(after.closed).toBe(true);
  });
});

describe("closing history", () => {
  function closeOn(date: string, netCash: number) {
    const result = executeCommand(CONTEXT, {
      type: "CloseDay",
      date,
      summary: { ...closingFor(date).summary, netCash },
      notes: `note for ${date}`,
    });
    if (!result.ok) throw new Error("close failed");
    return result.events;
  }

  it("returns closed days newest first", () => {
    const events = [...EVENTS, ...closeOn("2026-07-28", 10), ...closeOn("2026-07-30", 20)];
    const history = closingHistory(events);
    expect(history.map((d) => d.date)).toEqual(["2026-07-30", "2026-07-28"]);
    expect(history[0].summary.netCash).toBe(20);
  });

  it("keeps the latest sign-off when a day is closed twice", () => {
    const events = [...EVENTS, ...closeOn("2026-07-28", 10), ...closeOn("2026-07-28", 99)];
    const history = closingHistory(events);
    expect(history).toHaveLength(1);
    expect(history[0].summary.netCash).toBe(99);
  });

  it("caps the list at the requested window", () => {
    const events = [...EVENTS];
    for (let i = 1; i <= 40; i++) {
      events.push(...closeOn(`2026-06-${String(i).padStart(2, "0")}`, i));
    }
    expect(closingHistory(events, 30)).toHaveLength(30);
  });

  it("reports the figures the merchant signed off, not recomputed ones", () => {
    // A day is closed, THEN a back-dated entry arrives. History must not move.
    const closed = closeOn("2026-07-28", 1234);
    const events = [...EVENTS, ...closed];
    expect(closingHistory(events)[0].summary.netCash).toBe(1234);
    const lateEntry = EVENTS.filter((e) => e.type === "CreditRecorded").slice(0, 1);
    const withLateEntry = [...events, ...lateEntry];
    expect(closingHistory(withLateEntry)[0].summary.netCash).toBe(1234);
  });

  it("is empty before anything is closed", () => {
    expect(closingHistory(EVENTS)).toEqual([]);
  });
});

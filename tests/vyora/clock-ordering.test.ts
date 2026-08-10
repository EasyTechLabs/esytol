/**
 * The timeline folds entries in the order the merchant recorded them.
 *
 * A regression suite for a real defect. `createdAt` resolves to the millisecond
 * and minting an event is pure JavaScript with no I/O, so two entries recorded
 * back to back land inside one — measured at **294 collisions in 300** before
 * this fix. `mergeAscending` then gives the tie to the *transaction* side, which
 * is right when the credit really was first and wrong when it was not:
 *
 *     payment ₹500 then credit ₹2,000, same millisecond
 *     folded as  credit → payment      running  2000, 1500
 *     recorded as payment → credit     running  -500, 1500
 *
 * This is the mirror of the mobile defect rather than the same one. Mobile broke
 * ties on the entry id, where `pay_` sorts before `txn_`, so it misplaced a
 * payment ahead of a credit; the web misplaces a credit ahead of a payment. Same
 * cause — a tiebreak carrying no recording order — opposite symptom.
 *
 * Every test drives a stopped wall clock on purpose, so the collision the real
 * clock only sometimes produces is certain.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createContactCreated,
  createCreditRecorded,
  createPaymentRecorded,
  reduceEvents,
  type LedgerEvent,
} from "@/lib/vyora/events";
import { buildLedger, readStatement } from "@/lib/vyora/ledger";
import { makeIsoClock } from "@/lib/vyora/clock";
import { CLOCK_KEY, loadClockFloor, saveClockFloor } from "@/lib/vyora/store";
import { remoteLedgerSource } from "@/lib/vyora/ledger-source";

const FROZEN = "2026-08-10T10:00:00.000Z";
const STUCK = Date.parse(FROZEN);

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

function freeze(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FROZEN));
}

function statement(events: LedgerEvent[], partyId: string) {
  return readStatement(buildLedger(reduceEvents(events)), partyId);
}

describe("a ledger recorded inside a single millisecond", () => {
  it("folds a payment before the credit that followed it", () => {
    // The defect. Before the fix this read 2000 then 1500 — a running balance
    // that never happened, because the payment came first.
    freeze();
    const contact = createContactCreated({ name: "Rollback Shop" });
    const pid = contact.party.id;
    const payment = createPaymentRecorded({
      partyId: pid,
      amount: 500,
      kind: "received",
      date: "2026-08-10",
    });
    const credit = createCreditRecorded({
      partyId: pid,
      amount: 2000,
      kind: "given",
      date: "2026-08-10",
    });

    const rows = statement([contact, payment, credit], pid);

    expect(rows.map((r) => r.id.slice(0, 4))).toEqual(["pay_", "txn_"]);
    expect(rows.map((r) => r.runningNet)).toEqual([-500, 1500]);
  });

  it("still folds a credit before the payment that followed it", () => {
    // The case that was already correct, pinned so the fix cannot invert it.
    freeze();
    const contact = createContactCreated({ name: "Ramesh Traders" });
    const pid = contact.party.id;
    const credit = createCreditRecorded({
      partyId: pid,
      amount: 2000,
      kind: "given",
      date: "2026-08-10",
    });
    const payment = createPaymentRecorded({
      partyId: pid,
      amount: 500,
      kind: "received",
      date: "2026-08-10",
    });

    const rows = statement([contact, credit, payment], pid);

    expect(rows.map((r) => r.id.slice(0, 4))).toEqual(["txn_", "pay_"]);
    expect(rows.map((r) => r.runningNet)).toEqual([2000, 1500]);
  });

  it("gives every entry a distinct createdAt, so no tiebreak is reached", () => {
    freeze();
    const contact = createContactCreated({ name: "Distinct" });
    const pid = contact.party.id;
    const events: LedgerEvent[] = [
      contact,
      createCreditRecorded({ partyId: pid, amount: 100, kind: "given", date: "2026-08-10" }),
      createPaymentRecorded({ partyId: pid, amount: 40, kind: "received", date: "2026-08-10" }),
      createCreditRecorded({ partyId: pid, amount: 60, kind: "given", date: "2026-08-10" }),
    ];

    const stamps = statement(events, pid).map((r) => r.createdAt);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it("keeps the running balance sequence, not merely the closing total", () => {
    freeze();
    const contact = createContactCreated({ name: "Sequence" });
    const pid = contact.party.id;
    const events: LedgerEvent[] = [
      contact,
      createPaymentRecorded({ partyId: pid, amount: 200, kind: "received", date: "2026-08-10" }),
      createCreditRecorded({ partyId: pid, amount: 900, kind: "given", date: "2026-08-10" }),
      createPaymentRecorded({ partyId: pid, amount: 150, kind: "received", date: "2026-08-10" }),
      createCreditRecorded({ partyId: pid, amount: 50, kind: "given", date: "2026-08-10" }),
    ];

    const rows = statement(events, pid);
    expect(rows.map((r) => r.amount)).toEqual([200, 900, 150, 50]);
    // Every intermediate figure matters — a merchant reads the column, not just
    // the last number. The closing total is 600 whatever the order.
    expect(rows.map((r) => r.runningNet)).toEqual([-200, 700, 550, 600]);
  });
});

describe("the device clock never repeats an instant", () => {
  it("advances even when the wall clock does not move", () => {
    const now = makeIsoClock(() => STUCK);
    const stamps = [now(), now(), now(), now(), now()];
    expect(new Set(stamps).size).toBe(5);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it("repays what it borrowed once real time catches up", () => {
    let wall = STUCK;
    const now = makeIsoClock(() => wall);
    now();
    now();
    now();
    wall = STUCK + 500;
    expect(now()).toBe(new Date(STUCK + 500).toISOString());
  });

  it("keeps counting forward when the device clock moves backwards", () => {
    let wall = STUCK;
    const now = makeIsoClock(() => wall);
    const before = now();

    wall = STUCK - 3_600_000; // an hour backwards, mid-session
    const after = now();

    expect(after > before).toBe(true);
  });
});

describe("the floor survives a reload", () => {
  it("resumes past the last instant the previous page issued", () => {
    const wall = STUCK;

    const first = makeIsoClock(() => wall);
    first();
    first();
    first();
    expect(saveClockFloor(first.lastMs())).toBe(true);

    // A reload: a brand-new clock, nothing carried in memory.
    const second = makeIsoClock(() => wall);
    second.seed(loadClockFloor());

    expect(Date.parse(second())).toBeGreaterThan(first.lastMs());
  });

  it("holds when the device clock moved backwards while the page was closed", () => {
    let wall = STUCK;
    const first = makeIsoClock(() => wall);
    first();
    first();
    saveClockFloor(first.lastMs());

    wall = STUCK - 3_600_000;

    const second = makeIsoClock(() => wall);
    second.seed(loadClockFloor());

    expect(Date.parse(second())).toBeGreaterThan(first.lastMs());
  });

  it("never lets the stored floor move backwards", () => {
    saveClockFloor(STUCK + 1000);
    saveClockFloor(STUCK); // a stale write must not lower it
    expect(loadClockFloor()).toBe(STUCK + 1000);
  });
});

describe("a device that has entries but no stored floor", () => {
  it("falls back to the highest instant in its own log", () => {
    // The upgrade path: a ledger recorded before this key existed.
    const events: LedgerEvent[] = [
      {
        id: "evt_1",
        at: new Date(STUCK - 5_000).toISOString(),
        type: "ContactDeleted",
        partyId: "pty_x",
      },
      { id: "evt_2", at: new Date(STUCK).toISOString(), type: "ContactDeleted", partyId: "pty_y" },
    ] as unknown as LedgerEvent[];

    expect(window.localStorage.getItem(CLOCK_KEY)).toBeNull();
    expect(loadClockFloor(events)).toBe(STUCK);
  });

  it("prefers an imported backup's own instants over this device's clock", () => {
    // An imported file carries the exporting device's `createdAt` values inside
    // the snapshot, but the ImportCompleted event itself is stamped here. The
    // floor follows event `at`, never entry `createdAt` — a backup from a
    // device whose clock was a year fast must not drag this one into that year.
    const aYearAhead = new Date(STUCK + 365 * 24 * 3600_000).toISOString();
    const events: LedgerEvent[] = [
      {
        id: "evt_import",
        at: new Date(STUCK).toISOString(),
        type: "ImportCompleted",
        snapshot: {
          version: 2,
          parties: [{ id: "pty_a", name: "Imported", createdAt: aYearAhead }],
          transactions: [],
          payments: [],
        },
      },
    ] as unknown as LedgerEvent[];

    expect(loadClockFloor(events)).toBe(STUCK);
  });

  it("reports no floor at all for a device with no history", () => {
    expect(loadClockFloor([])).toBe(-1);
  });
});

describe("the remote write path", () => {
  /**
   * Entries POSTed to the development API are ordered server-side by
   * `(created_at, entry_id)` — the *mobile* tiebreak, where `pay_` sorts before
   * `txn_`. Two entries sent with the same instant therefore come back with the
   * payment folded first whatever order they were recorded in. This path mints
   * its own `createdAt`, so it needs the same clock as the local log.
   */
  it("never sends two entries with the same createdAt", async () => {
    freeze();
    const sent: Array<Record<string, unknown>> = [];
    const fetchStub = vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return { ok: true, status: 201, json: async () => ({}) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchStub);

    try {
      const source = remoteLedgerSource("/api/test");
      await source.recordCredit("pty_1", { amount: 2000, kind: "given", date: "2026-08-10" });
      await source.recordPayment("pty_1", { amount: 500, kind: "received", date: "2026-08-10" });

      expect(sent).toHaveLength(2);
      const stamps = sent.map((body) => String(body.createdAt));
      expect(new Set(stamps).size).toBe(2);
      // And in recording order, so the server's fold matches the merchant's.
      expect(stamps[0] < stamps[1]).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

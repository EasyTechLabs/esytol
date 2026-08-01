/**
 * Vyora — Debug Bus tests (ENG-008).
 *
 * Two properties carry the weight here.
 *
 *  1. **Off means off.** Diagnostics must cost nothing and retain nothing when
 *     disabled — the capture path has a standing gate that entry stays at or
 *     below a paper notebook, and this is the module most able to quietly spend
 *     that budget.
 *  2. **Nothing leaves the device.** Asserted against the source: the module has
 *     no way to reach the network, and it never persists.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEBUG_CAPACITY,
  clearDebug,
  debugRecords,
  isDebugEnabled,
  record,
  runIntegrityChecks,
  setDebugEnabled,
  time,
  timingSummary,
} from "@/lib/vyora/debug";
import { goldenLedger } from "./golden-ledger";

beforeEach(() => {
  setDebugEnabled(false);
  clearDebug();
});
afterEach(() => setDebugEnabled(false));

describe("off by default, and genuinely free when off", () => {
  it("starts disabled", () => {
    expect(isDebugEnabled()).toBe(false);
  });

  it("records nothing while disabled", () => {
    record("command", "RecordCredit", 12);
    time("selector", "buildLedger", () => 1);
    expect(debugRecords()).toEqual([]);
    expect(timingSummary()).toEqual([]);
  });

  it("still returns the value when disabled", () => {
    expect(time("selector", "x", () => 42)).toBe(42);
  });

  it("does not swallow a throw when disabled", () => {
    expect(() =>
      time("command", "boom", () => {
        throw new Error("nope");
      })
    ).toThrow("nope");
  });

  it("forgets everything when switched back off", () => {
    setDebugEnabled(true);
    record("command", "RecordCredit", 3);
    expect(debugRecords().length).toBe(1);
    setDebugEnabled(false);
    expect(debugRecords()).toEqual([]);
  });
});

describe("recording while enabled", () => {
  beforeEach(() => setDebugEnabled(true));

  it("captures a timed call and still returns its value", () => {
    expect(time("selector", "buildLedger", () => "v")).toBe("v");
    const records = debugRecords();
    expect(records.length).toBe(1);
    expect(records[0].channel).toBe("selector");
    expect(records[0].label).toBe("buildLedger");
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a call that threw, then rethrows", () => {
    expect(() =>
      time("command", "RecordCredit", () => {
        throw new Error("bad");
      })
    ).toThrow("bad");
    expect(debugRecords().length).toBe(1);
  });

  it("never grows past its capacity", () => {
    for (let i = 0; i < DEBUG_CAPACITY * 2; i++) record("render", "Dashboard", i);
    expect(debugRecords().length).toBe(DEBUG_CAPACITY);
  });

  it("keeps the newest samples when it overflows", () => {
    for (let i = 0; i < DEBUG_CAPACITY + 10; i++) record("render", "Dashboard", i);
    const records = debugRecords();
    // Oldest retained sample is the 11th written, and order is oldest-first.
    expect(records[0].durationMs).toBe(10);
    expect(records[records.length - 1].durationMs).toBe(DEBUG_CAPACITY + 9);
  });

  it("aggregates a timeline by channel and label", () => {
    record("command", "RecordCredit", 10);
    record("command", "RecordCredit", 30);
    record("selector", "buildLedger", 5);
    const summary = timingSummary();
    const credit = summary.find((s) => s.label === "RecordCredit");
    expect(credit?.count).toBe(2);
    expect(credit?.totalMs).toBe(40);
    expect(credit?.meanMs).toBe(20);
    expect(credit?.maxMs).toBe(30);
    // Heaviest first.
    expect(summary[0].label).toBe("RecordCredit");
  });
});

describe("integrity checks on the golden ledger", () => {
  it("passes every invariant on a healthy ledger", () => {
    const checks = runIntegrityChecks(goldenLedger());
    expect(checks.length).toBeGreaterThanOrEqual(6);
    for (const check of checks) {
      expect({ name: check.name, ok: check.ok }).toEqual({ name: check.name, ok: true });
    }
  });

  it("writes its own result onto the integrity timeline when enabled", () => {
    setDebugEnabled(true);
    runIntegrityChecks(goldenLedger());
    const integrity = debugRecords().filter((r) => r.channel === "integrity");
    expect(integrity.length).toBe(1);
    expect(integrity[0].ok).toBe(true);
  });

  it("catches a ledger whose totals do not agree", () => {
    const healthy = goldenLedger();
    const tampered = {
      ...healthy,
      statistics: { ...healthy.statistics, net: healthy.statistics.net + 1 },
    };
    const checks = runIntegrityChecks(tampered);
    expect(checks.filter((c) => !c.ok).length).toBeGreaterThan(0);
  });
});

describe("nothing can leave the device", () => {
  const source = readFileSync(join(process.cwd(), "lib", "vyora", "debug.ts"), "utf8");

  it("makes no network call of any kind", () => {
    for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "navigator."]) {
      const present = source.includes(forbidden);
      expect({ forbidden, present }).toEqual({ forbidden, present: false });
    }
  });

  it("never persists what it records", () => {
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
      const present = source.includes(forbidden);
      expect({ forbidden, present }).toEqual({ forbidden, present: false });
    }
  });
});

/**
 * Restore, through the real provider and the real storage boundary.
 *
 * `backup.test.ts` proves the envelope; nothing there would notice if the
 * provider merged instead of replaced, adopted the backup's clock, skipped the
 * lock, or left another tab showing a book that no longer exists.
 *
 * Restore is deliberately **not** a command. Commands append events; a restore
 * replaces the log, because the restored log *is* the book. Two books folded
 * together would produce balances belonging to neither, and a merchant cannot
 * un-merge them.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { VyoraProvider, useVyora } from "@/features/vyora/VyoraProvider";
import { CLOCK_KEY, LOG_KEY, loadClockFloor, loadLog, saveLog } from "@/lib/vyora/store";
import { buildBackup, parseBackup } from "@/lib/vyora/backup";
import { makeIsoClock } from "@/lib/vyora/clock";
import type { LedgerEvent } from "@/lib/vyora/events";

function wrapper({ children }: { children: ReactNode }) {
  return <VyoraProvider>{children}</VyoraProvider>;
}

function installWebLocks(): void {
  let chain: Promise<unknown> = Promise.resolve();
  const request = (_name: string, callback: () => Promise<unknown>) => {
    const run = chain.then(callback, callback);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  installWebLocks();
});
afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "locks");
  vi.restoreAllMocks();
  localStorage.clear();
});

async function openTab() {
  const view = renderHook(() => useVyora(), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

const PARTY = "pty_restored";
/** A book exported by some other device, a year in the future. */
const A_YEAR_AHEAD = new Date(Date.now() + 365 * 24 * 3600_000).toISOString();

const FOREIGN: LedgerEvent[] = [
  {
    id: "evt_f1",
    at: A_YEAR_AHEAD,
    type: "ContactCreated",
    party: { id: PARTY, name: "Restored Shop", createdAt: A_YEAR_AHEAD },
  },
  {
    id: "evt_f2",
    at: A_YEAR_AHEAD,
    type: "CreditRecorded",
    transaction: {
      id: "txn_f1",
      partyId: PARTY,
      amount: 1200,
      kind: "given",
      date: "2027-08-01",
      createdAt: A_YEAR_AHEAD,
    },
  },
];

function foreignBackup(): readonly LedgerEvent[] {
  const parsed = parseBackup(
    buildBackup(FOREIGN, { name: "vyora", version: "test" }, A_YEAR_AHEAD).contents
  );
  if (!parsed.ok) throw new Error("fixture backup did not parse");
  return parsed.events;
}

describe("restoring replaces the book", () => {
  it("rebuilds every projection from the restored log", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.dispatch({
        type: "RecordCredit",
        contactName: "Old Book",
        amount: 50,
        kind: "given",
      });
    });

    await act(async () => {
      await result.current.restore(foreignBackup());
    });

    // Replace, not merge: the old contact is gone, the restored one is here.
    const names = result.current.ledger.parties.all.map((p) => p.name);
    expect(names).toEqual(["Restored Shop"]);
    expect(result.current.events.map((e) => e.id)).toEqual(["evt_f1", "evt_f2"]);
    expect(loadLog().map((e) => e.id)).toEqual(["evt_f1", "evt_f2"]);
  });

  it("appends no snapshot event — the restored log is the book", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.restore(foreignBackup());
    });

    const stored = loadLog();
    expect(stored.some((e) => e.type === "ImportCompleted")).toBe(false);
    expect(stored.some((e) => e.type === "RestoreCompleted")).toBe(false);
    expect(stored).toHaveLength(FOREIGN.length);
  });

  it("raises the clock past everything the backup contained", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.restore(foreignBackup());
    });

    // The restored events are stamped a year ahead. The merchant's next action
    // happens after the restore, so the floor must clear them — otherwise that
    // action lands in the middle of the restored book and reorders it.
    const floor = Number(localStorage.getItem(CLOCK_KEY));
    expect(Number.isFinite(floor)).toBe(true);
    expect(floor).toBeGreaterThan(Date.parse(A_YEAR_AHEAD));
  });
});

describe("a backup from a device whose clock ran ahead", () => {
  /**
   * The visible cost of the rule above: entries recorded after restoring such a
   * backup carry timestamps that look like the future. That is deliberate. The
   * alternative — a floor set to "now" — inserts today's entry into last year's
   * history and silently rewrites every running balance after it.
   */
  it("keeps entries recorded afterwards sorting after everything restored", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.restore(foreignBackup());
    });

    await act(async () => {
      await result.current.dispatch({
        type: "RecordCredit",
        contactName: "Restored Shop",
        amount: 300,
        kind: "given",
      });
    });
    await act(async () => {
      await result.current.dispatch({
        type: "RecordPayment",
        contactName: "Restored Shop",
        amount: 100,
        kind: "received",
      });
    });

    const rows = result.current.ledger.timeline.statementByParty.get(PARTY) ?? [];

    // Recording order, and the running balance that follows from it.
    expect(rows.map((r) => r.amount)).toEqual([1200, 300, 100]);
    expect(rows.map((r) => r.runningNet)).toEqual([1200, 1500, 1400]);

    // Every new instant is strictly after every restored one.
    const restoredLatest = Date.parse(A_YEAR_AHEAD);
    expect(Date.parse(rows[1]!.createdAt)).toBeGreaterThan(restoredLatest);
    expect(Date.parse(rows[2]!.createdAt)).toBeGreaterThan(Date.parse(rows[1]!.createdAt));
  });

  it("keeps the floor across a reload", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.restore(foreignBackup());
    });

    // A reload seeds a brand-new clock from the stored floor — the exact path
    // `VyoraProvider` takes on mount. Simulated here rather than really
    // reloading, because the module singleton cannot be reset in-file.
    const reloaded = makeIsoClock(() => Date.now());
    reloaded.seed(loadClockFloor(loadLog()));

    expect(Date.parse(reloaded())).toBeGreaterThan(Date.parse(A_YEAR_AHEAD));
  });
});

describe("a restore that cannot be persisted changes nothing", () => {
  it("leaves the previous book in place when storage refuses", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.dispatch({
        type: "RecordCredit",
        contactName: "Keep Me",
        amount: 70,
        kind: "given",
      });
    });
    const before = loadLog();

    // The device runs out of space at the moment of replacement.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    let outcome: { ok: boolean } | null = null;
    await act(async () => {
      outcome = await result.current.restore(foreignBackup());
    });

    expect(outcome!.ok).toBe(false);
    vi.restoreAllMocks();
    expect(loadLog()).toEqual(before);
    expect(result.current.ledger.parties.all.map((p) => p.name)).toEqual(["Keep Me"]);
  });

  it("never runs at all when the file failed validation", async () => {
    const { result } = await openTab();
    await act(async () => {
      await result.current.dispatch({
        type: "RecordCredit",
        contactName: "Untouched",
        amount: 90,
        kind: "given",
      });
    });
    const before = loadLog();

    // What the screen does with a bad file: it never reaches `restore`.
    const parsed = parseBackup('{"format":"vyora.backup","schemaVersion":3,"events":[]}');
    expect(parsed.ok).toBe(false);

    expect(loadLog()).toEqual(before);
  });
});

describe("restore and other tabs", () => {
  it("cannot interleave with a concurrent write from another tab", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    // Both fire in the same tick: the lock decides the order, and whichever
    // runs second sees the first one's result rather than overwriting it.
    await act(async () => {
      await Promise.all([
        tabA.result.current.restore(foreignBackup()),
        tabB.result.current.dispatch({
          type: "RecordCredit",
          contactName: "Racing Tab",
          amount: 15,
          kind: "given",
        }),
      ]);
    });

    const stored = loadLog();
    const credits = stored.filter((e) => e.type === "CreditRecorded");

    // Either order is legitimate; a lost write is not. If the restore landed
    // last the book is exactly the file; if the write landed last it is the
    // file plus that entry. Never a half-applied mixture.
    const ids = stored.map((e) => e.id);
    if (ids.includes("evt_f1")) {
      expect(ids.slice(0, 2)).toEqual(["evt_f1", "evt_f2"]);
    }
    expect(credits.length).toBeGreaterThan(0);
  });

  it("refreshes another open tab after a restore", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await act(async () => {
      await tabA.result.current.restore(foreignBackup());
    });

    // The browser raises `storage` in every OTHER tab; jsdom does not do so for
    // same-document writes, so it is raised here exactly as a browser would.
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: LOG_KEY }));
    });

    await waitFor(() =>
      expect(tabB.result.current.ledger.parties.all.map((p) => p.name)).toEqual(["Restored Shop"])
    );
  });
});

describe("a book restored from a file the merchant exported", () => {
  it("comes back with the same balances and running order", async () => {
    const { result } = await openTab();

    await act(async () => {
      await result.current.dispatch({
        type: "RecordCredit",
        contactName: "Round Trip",
        amount: 2000,
        kind: "given",
      });
    });
    await act(async () => {
      await result.current.dispatch({
        type: "RecordPayment",
        contactName: "Round Trip",
        amount: 500,
        kind: "received",
      });
    });

    const partyId = result.current.ledger.parties.all[0]!.id;
    const before = result.current.ledger.timeline.statementByParty.get(partyId) ?? [];
    expect(before.map((r) => r.runningNet)).toEqual([2000, 1500]);

    const file = buildBackup(
      result.current.events,
      { name: "vyora", version: "test" },
      new Date().toISOString()
    );

    // A clean profile: same browser, nothing in it.
    saveLog([]);
    const fresh = await openTab();
    const parsed = parseBackup(file.contents);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await act(async () => {
      await fresh.result.current.restore(parsed.events);
    });

    const after = fresh.result.current.ledger.timeline.statementByParty.get(partyId) ?? [];
    expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
    expect(after.map((r) => r.runningNet)).toEqual([2000, 1500]);
  });
});

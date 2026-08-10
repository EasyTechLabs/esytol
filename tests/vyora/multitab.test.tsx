/**
 * Two Vyora tabs on one device.
 *
 * `saveLog` writes the whole log from one tab's memory, so before this milestone
 * the second tab to save overwrote everything the first had recorded since they
 * both loaded. Measured here at the real boundary: two tabs recording ₹100 and
 * ₹200 left `[200]`, and a credit in one tab with a payment in the other lost
 * the credit outright — after a success toast had already been shown for it.
 *
 * These drive two real `VyoraProvider` instances over one `localStorage`, which
 * is the production shape: same origin, same key, independent in-memory state.
 *
 * **On the Web Locks stub.** jsdom has no `navigator.locks`, so the concurrent
 * tests install a faithful one — a promise chain that runs callbacks one at a
 * time under a named lock. That is the contract the production code depends on,
 * and stubbing it is what lets the *critical section* be tested rather than the
 * browser. The final block removes it again to test the fallback, which is the
 * behaviour real browsers without Web Locks will get.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { VyoraProvider, useVyora } from "@/features/vyora/VyoraProvider";
import { LOG_KEY, loadLog } from "@/lib/vyora/store";
import type { LedgerEvent } from "@/lib/vyora/events";

function wrapper({ children }: { children: ReactNode }) {
  return <VyoraProvider>{children}</VyoraProvider>;
}

/** A same-origin mutex with the shape `navigator.locks` guarantees. */
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

function removeWebLocks(): void {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "locks");
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  removeWebLocks();
  localStorage.clear();
});

async function openTab() {
  const view = renderHook(() => useVyora(), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

const creditsIn = (events: readonly LedgerEvent[]) =>
  events.filter((e) => e.type === "CreditRecorded").map((e) => e.transaction.amount);

const paymentsIn = (events: readonly LedgerEvent[]) =>
  events.filter((e) => e.type === "PaymentRecorded").map((e) => e.payment.amount);

describe("two tabs, on a browser with Web Locks", () => {
  beforeEach(() => {
    installWebLocks();
  });

  it("keeps both credits", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await act(async () => {
      await tabA.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Tab A Shop",
        amount: 100,
        kind: "given",
      });
    });
    await act(async () => {
      await tabB.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Tab B Shop",
        amount: 200,
        kind: "given",
      });
    });

    expect(creditsIn(loadLog()).sort((x, y) => x - y)).toEqual([100, 200]);
  });

  it("keeps a credit and a payment written from different tabs, with correct totals", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await act(async () => {
      await tabA.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Shared Shop",
        amount: 2000,
        kind: "given",
      });
    });
    await act(async () => {
      await tabB.result.current.dispatch({
        type: "RecordPayment",
        contactName: "Shared Shop",
        amount: 500,
        kind: "received",
      });
    });

    const stored = loadLog();
    expect(creditsIn(stored)).toEqual([2000]);
    expect(paymentsIn(stored)).toEqual([500]);

    // The writing tab's own projection is the folded truth, in recording order.
    const party = tabB.result.current.ledger.parties.all.find((p) => p.name === "Shared Shop");
    const rows = tabB.result.current.ledger.timeline.statementByParty.get(party!.id) ?? [];
    expect(rows.map((r) => r.runningNet)).toEqual([2000, 1500]);
  });

  it("issues writes one at a time even when both tabs fire together", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    // No awaiting in between: both enter the lock in the same tick.
    await act(async () => {
      await Promise.all([
        tabA.result.current.dispatch({
          type: "RecordCredit",
          contactName: "Race A",
          amount: 11,
          kind: "given",
        }),
        tabB.result.current.dispatch({
          type: "RecordCredit",
          contactName: "Race B",
          amount: 22,
          kind: "given",
        }),
      ]);
    });

    expect(creditsIn(loadLog()).sort((x, y) => x - y)).toEqual([11, 22]);
  });

  it("does not let an import erase an entry another tab just recorded", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await act(async () => {
      await tabA.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Before Restore",
        amount: 999,
        kind: "given",
      });
    });

    const backup = JSON.stringify({
      app: "vyora",
      fileVersion: 2,
      data: { parties: [], transactions: [], payments: [] },
    });
    await act(async () => {
      await tabB.result.current.dispatch({ type: "ImportLedger", payload: backup });
    });

    // The log is append-only: restoring replaces the *projection*, but the entry
    // that was recorded is still in history and can still be read back.
    const stored = loadLog();
    expect(creditsIn(stored)).toEqual([999]);
    expect(stored.some((e) => e.type === "ImportCompleted")).toBe(true);
    expect(stored.findIndex((e) => e.type === "ImportCompleted")).toBeGreaterThan(
      stored.findIndex((e) => e.type === "CreditRecorded")
    );
  });

  it("refreshes a tab when another one writes", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await act(async () => {
      await tabA.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Written In A",
        amount: 640,
        kind: "given",
      });
    });

    // The browser fires `storage` in every OTHER tab. jsdom does not do this for
    // same-document writes, so it is raised here exactly as a browser would.
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: LOG_KEY }));
    });

    await waitFor(() =>
      expect(tabB.result.current.ledger.parties.all.map((p) => p.name)).toContain("Written In A")
    );
  });
});

describe("two tabs, on a browser without Web Locks", () => {
  /**
   * The claim is taken at the first *write*, never merely by having the app
   * open. A session that only reads — or one driving the remote party source,
   * which never touches the device log — must write nothing to storage, and
   * `ledger-payment.test.tsx` holds that line by spying on `setItem`.
   */
  it("refuses the second tab's write rather than letting it overwrite", async () => {
    const tabA = await openTab();
    const tabB = await openTab();

    await act(async () => {
      await tabA.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Writable Tab",
        amount: 300,
        kind: "given",
      });
    });

    const refused = await act(async () =>
      tabB.result.current.dispatch({
        type: "RecordCredit",
        contactName: "Read Only Tab",
        amount: 400,
        kind: "given",
      })
    );

    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("READ_ONLY_TAB");

    // And it now says so, rather than silently failing every later attempt.
    expect(tabB.result.current.writable).toBe(false);

    // The writable tab's entry is intact, and the refused one was never minted.
    expect(creditsIn(loadLog())).toEqual([300]);
  });

  it("opens read-only when another tab already holds the claim", async () => {
    const tabA = await openTab();
    await act(async () => {
      await tabA.result.current.dispatch({
        type: "RecordCredit",
        contactName: "First Tab",
        amount: 300,
        kind: "given",
      });
    });

    // The common case: the merchant opens Vyora again while already working.
    const tabB = await openTab();
    await waitFor(() => expect(tabB.result.current.writable).toBe(false));
    expect(tabA.result.current.writable).toBe(true);
  });
});

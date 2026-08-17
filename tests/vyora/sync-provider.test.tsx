/**
 * The running app, on IndexedDB (WEB-SYNC-003).
 *
 * WEB-SYNC-002 built the store, the engine and the migration, and every
 * importer of them was a test. The application went on writing the whole log to
 * one key on every append. These are the tests that would have caught that: not
 * "the engine works" — `sync-engine.test.ts` proves that — but **the provider
 * the merchant is actually using goes through it.**
 *
 * So every case here renders the real `VyoraProvider`, dispatches real commands
 * and then asks the *database* what happened, rather than asking the provider
 * what it thinks happened.
 *
 * `fake-indexeddb` is a full implementation of the spec, so transactions are
 * atomic, the unique index really refuses a duplicate id, and fold order is
 * whatever the keys actually sort to. The one thing standing in for reality is
 * `fetch`, and it stands in as a *server*, not as a stub of the engine.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { VyoraProvider, useVyora } from "@/features/vyora/VyoraProvider";
import { LOG_KEY, loadLog, saveLog } from "@/lib/vyora/store";
import { ACTIVE_SHOP_KEY } from "@/lib/vyora/active-shop";
import { MIGRATION_KEY, migrationState } from "@/lib/vyora/sync/migration";
import { countEvents, countPending, openDatabase, readLog, readMeta } from "@/lib/vyora/sync/store";
import { resetInFlight } from "@/lib/vyora/sync/engine";
import { buildDailyClosing } from "@/lib/vyora/closing";
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

/** A shop's log on a server that keeps the API's rules. Push before pull. */
function server() {
  const books = new Map<
    string,
    {
      eventId: string;
      type: string;
      aggregateId: string | null;
      payload: Record<string, unknown>;
      occurredAt: string;
      recordedAt: string;
    }[]
  >();
  /** The shop named by the header, which the API resolves from membership. */
  const bookFor = (headers: HeadersInit | undefined) => {
    const shop = new Headers(headers).get("x-vyora-shop") ?? "unknown";
    const held = books.get(shop);
    if (held) return held;
    const fresh: {
      eventId: string;
      type: string;
      aggregateId: string | null;
      payload: Record<string, unknown>;
      occurredAt: string;
      recordedAt: string;
    }[] = [];
    books.set(shop, fresh);
    return fresh;
  };
  let clock = 0;
  const state = { offline: false, unauthorized: false, pushes: 0, sentDeviceId: false };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (state.offline) throw new TypeError("Failed to fetch");
    if (state.unauthorized) {
      return new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "no" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const log = bookFor(init?.headers);

    if (url.startsWith("/api/vyora-sync/push")) {
      state.pushes += 1;
      const body = JSON.parse(String(init?.body)) as {
        deviceId?: unknown;
        events: {
          eventId: string;
          type: string;
          aggregateId: string | null;
          payload: Record<string, unknown>;
          occurredAt: string;
        }[];
      };
      // The browser must never send one. The server attributes (ADR-0016).
      if (body.deviceId !== undefined) state.sentDeviceId = true;

      const accepted: { eventId: string; recordedAt: string }[] = [];
      const duplicate: { eventId: string; recordedAt: string }[] = [];
      for (const event of body.events) {
        const held = log.find((row) => row.eventId === event.eventId);
        if (held) {
          duplicate.push({ eventId: held.eventId, recordedAt: held.recordedAt });
          continue;
        }
        clock += 1;
        const recordedAt = new Date(Date.UTC(2026, 7, 20, 0, 0, 0, clock)).toISOString();
        log.push({ ...event, recordedAt });
        accepted.push({ eventId: event.eventId, recordedAt });
      }
      return new Response(
        JSON.stringify({ accepted, duplicate, rejected: [], cursor: "c", serverTime: "t" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    const cursor = new URL(url, "http://x").searchParams.get("cursor");
    const ordered = [...log].sort((a, b) =>
      a.recordedAt === b.recordedAt
        ? a.eventId.localeCompare(b.eventId)
        : a.recordedAt.localeCompare(b.recordedAt)
    );
    const after = cursor ? ordered.filter((row) => row.recordedAt > cursor) : ordered;
    const nextCursor = after.length > 0 ? after[after.length - 1]!.recordedAt : cursor;
    return new Response(
      JSON.stringify({ events: after, nextCursor, hasMore: false, serverTime: "t" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  return { books, state, fetchImpl, logFor: (shop: string) => books.get(shop) ?? [] };
}

let api: ReturnType<typeof server>;

beforeEach(() => {
  localStorage.clear();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetInFlight();
  installWebLocks();
  api = server();
  vi.stubGlobal("fetch", api.fetchImpl);
});

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "locks");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

async function openTab() {
  const view = renderHook(() => useVyora(), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

/** Sign in to a shop, the way `ShopSetup` does after the server confirms. */
function signedIn(merchantId = "shop-a"): void {
  localStorage.setItem(ACTIVE_SHOP_KEY, merchantId);
}

const AT = "2026-08-20T09:00:00.000Z";

function seedLog(): LedgerEvent[] {
  return [
    {
      id: "evt_seed1",
      at: AT,
      type: "ContactCreated",
      party: { id: "pty_seed", name: "Old Book", createdAt: AT },
    },
    {
      id: "evt_seed2",
      at: AT,
      type: "CreditRecorded",
      transaction: {
        id: "txn_seed",
        partyId: "pty_seed",
        amount: 500,
        kind: "given",
        date: "2026-08-20",
        createdAt: AT,
      },
    },
  ];
}

/** An export file the import command will accept: empty, and well-formed. */
function emptyBackupFile(): string {
  return JSON.stringify({
    app: "vyora",
    fileVersion: 2,
    exportedAt: AT,
    data: { parties: [], transactions: [], payments: [] },
  });
}

/** Sign off the day the ledger currently shows. */
async function closeDay(view: Awaited<ReturnType<typeof openTab>>) {
  const summary = buildDailyClosing(
    view.result.current.ledger,
    view.result.current.events,
    view.result.current.settings,
    "2026-08-20"
  ).summary;
  await view.result.current.dispatch({
    type: "CloseDay",
    date: "2026-08-20",
    summary,
    notes: "",
  });
}

async function recordCredit(
  view: Awaited<ReturnType<typeof openTab>>,
  name: string,
  amount: number
) {
  await act(async () => {
    await view.result.current.dispatch({
      type: "RecordCredit",
      contactName: name,
      amount,
      kind: "given",
      date: "2026-08-20",
    });
  });
}

// ── The book actually moved ──────────────────────────────────────────────────

describe("the provider keeps the book in IndexedDB", () => {
  it("records a credit as a record in the database, not a rewritten key", async () => {
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    const db = await openDatabase();
    const stored = await readLog(db);
    expect(stored.map((e) => e.type)).toEqual(["ContactCreated", "CreditRecorded"]);

    // The old key is not where the entry went.
    expect(loadLog()).toHaveLength(0);
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });

  it("queues what it records, because unsent is a state an event is in", async () => {
    signedIn();
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    const db = await openDatabase();
    // Both events reached the server, so nothing is left pending.
    await waitFor(async () => expect(await countPending(db)).toBe(0));
    expect(api.logFor("shop-a").map((r) => r.type)).toEqual(["ContactCreated", "CreditRecorded"]);
  });

  it("never sends a deviceId — the server attributes (ADR-0016)", async () => {
    signedIn();
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    await waitFor(() => expect(api.state.pushes).toBeGreaterThan(0));
    expect(api.state.sentDeviceId).toBe(false);
  });

  it("survives a reload — a second provider reads the same book", async () => {
    const first = await openTab();
    await recordCredit(first, "Ramesh", 1200);
    first.unmount();

    const second = await openTab();
    expect(second.result.current.ledger.parties.all.map((p) => p.name)).toEqual(["Ramesh"]);
    expect(second.result.current.data.transactions).toHaveLength(1);
  });

  it("never rewrites the whole log to record one entry", async () => {
    const view = await openTab();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    for (let i = 0; i < 25; i++) await recordCredit(view, `Customer ${i}`, 100 + i);

    // The point of the move. `saveLog` re-serialises E events per append, which
    // is O(E²) over a session — the shape ENG-010 removed from the fold, and
    // which must not come back in the write path. On IndexedDB the log key is
    // never written at all.
    const wroteLog = setItem.mock.calls.filter(([key]) => key === LOG_KEY);
    expect(wroteLog).toHaveLength(0);

    const db = await openDatabase();
    expect(await countEvents(db)).toBe(50);
    setItem.mockRestore();
  });
});

// ── Migration, at the one place it runs ──────────────────────────────────────

describe("migration runs at startup, once", () => {
  it("moves an existing book across and leaves the original where it was", async () => {
    saveLog(seedLog());

    const view = await openTab();
    expect(view.result.current.ledger.parties.all.map((p) => p.name)).toEqual(["Old Book"]);

    const db = await openDatabase();
    expect(await countEvents(db)).toBe(2);
    // Never deleted before — nor after — the copy is proven.
    expect(localStorage.getItem(LOG_KEY)).not.toBeNull();
    expect(loadLog()).toHaveLength(2);
  });

  it("marks itself done, and a second launch does not copy again", async () => {
    saveLog(seedLog());
    const first = await openTab();
    first.unmount();

    const db = await openDatabase();
    expect((await migrationState(db))?.completed).toBe(true);

    // Something recorded after migrating must not be lost by a second run, and
    // the seeded events must not arrive twice.
    const second = await openTab();
    await recordCredit(second, "New Contact", 300);
    second.unmount();

    const third = await openTab();
    expect(await countEvents(db)).toBe(4);
    expect(third.result.current.ledger.parties.all.map((p) => p.name).sort()).toEqual([
      "New Contact",
      "Old Book",
    ]);
  });

  it("a browser with nothing to migrate is still migrated", async () => {
    const view = await openTab();
    const db = await openDatabase();
    expect((await migrationState(db))?.completed).toBe(true);
    expect(view.result.current.events).toHaveLength(0);
  });

  it("does not migrate on every render", async () => {
    saveLog(seedLog());
    const view = await openTab();

    const db = await openDatabase();
    const first = await migrationState(db);

    view.rerender();
    view.rerender();
    await act(async () => {
      await Promise.resolve();
    });

    expect((await migrationState(db))?.migratedAt).toBe(first?.migratedAt);
    expect(await countEvents(db)).toBe(2);
  });
});

// ── Offline is a state, not an error ─────────────────────────────────────────

describe("a merchant with no connection", () => {
  it("records a full day, and every entry is still there after a restart", async () => {
    signedIn();
    api.state.offline = true;

    const first = await openTab();
    await recordCredit(first, "Ramesh", 1200);
    await act(async () => {
      await first.result.current.dispatch({
        type: "RecordPayment",
        contactName: "Ramesh",
        amount: 200,
        kind: "received",
        date: "2026-08-20",
      });
    });
    await act(async () => {
      await closeDay(first);
    });

    expect(first.result.current.ledger.parties.all).toHaveLength(1);
    first.unmount();

    // The browser is closed and reopened, still with no connection.
    const second = await openTab();
    const db = await openDatabase();
    expect(await countPending(db)).toBe(4);
    expect(second.result.current.data.transactions).toHaveLength(1);
    expect(second.result.current.data.payments).toHaveLength(1);

    // Nothing reached the server, and nothing was lost waiting.
    expect(api.logFor("shop-a")).toHaveLength(0);
  });

  it("sends everything once the connection comes back, with no duplicates", async () => {
    signedIn();
    api.state.offline = true;

    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    api.state.offline = false;
    await act(async () => {
      await view.result.current.syncNow();
    });

    const db = await openDatabase();
    expect(await countPending(db)).toBe(0);
    expect(
      api
        .logFor("shop-a")
        .map((r) => r.eventId)
        .sort()
    ).toEqual((await readLog(db)).map((e) => e.id).sort());

    // A second sync sends nothing new and duplicates nothing.
    await act(async () => {
      await view.result.current.syncNow();
    });
    expect(await countEvents(db)).toBe(2);
    expect(api.logFor("shop-a")).toHaveLength(2);
  });

  it("keeps queued work when the server fails, rather than dropping it", async () => {
    signedIn();
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    const db = await openDatabase();
    await waitFor(async () => expect(await countPending(db)).toBe(0));

    api.state.offline = true;
    await act(async () => {
      await view.result.current.dispatch({
        type: "RecordPayment",
        contactName: "Ramesh",
        amount: 200,
        kind: "received",
        date: "2026-08-20",
      });
    });

    // The payment is local, durable and unsent. The credit stays sent.
    expect(await countPending(db)).toBe(1);
    expect(view.result.current.data.payments).toHaveLength(1);
  });
});

// ── What the merchant is told ────────────────────────────────────────────────

describe("the status the merchant sees", () => {
  it("says nothing at all until there is a shop to sync with", async () => {
    const view = await openTab();
    expect(view.result.current.sync.state).toBe("idle");
    expect(view.result.current.sync.pending).toBe(0);
  });

  it("reaches synced after a successful cycle", async () => {
    signedIn();
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    await waitFor(() => expect(view.result.current.sync.state).toBe("synced"));
    expect(view.result.current.sync.message).toBeNull();
  });

  it("reads as offline, not as a failure, when the connection is gone", async () => {
    signedIn();
    api.state.offline = true;
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    await waitFor(() => expect(view.result.current.sync.state).toBe("offline"));
    expect(view.result.current.sync.pending).toBeGreaterThan(0);
  });

  it("asks for a sign-in when the session has expired, and stops", async () => {
    signedIn();
    api.state.unauthorized = true;
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    await waitFor(() => expect(view.result.current.sync.state).toBe("auth-required"));
    expect(api.logFor("shop-a")).toHaveLength(0);
  });
});

// ── Isolation ────────────────────────────────────────────────────────────────

describe("one browser, one shop's book", () => {
  it("erases the book when the person signs out", async () => {
    signedIn();
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    await act(async () => {
      await view.result.current.signOutLocally();
    });

    const db = await openDatabase();
    expect(await countEvents(db)).toBe(0);
    expect(localStorage.getItem(ACTIVE_SHOP_KEY)).toBeNull();
    expect(view.result.current.ledger.parties.all).toHaveLength(0);
  });

  it("erases the previous shop's book when a different shop is entered", async () => {
    signedIn("shop-a");
    const view = await openTab();
    await recordCredit(view, "Shop A Customer", 1200);

    await act(async () => {
      await view.result.current.enterShop("shop-b");
    });

    const db = await openDatabase();
    expect(await readMeta(db, "cursor")).toBeNull();
    expect(view.result.current.ledger.parties.all).toHaveLength(0);
    expect(localStorage.getItem(ACTIVE_SHOP_KEY)).toBe("shop-b");
  });

  it("keeps the book when the same shop is entered again", async () => {
    signedIn("shop-a");
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);

    await act(async () => {
      await view.result.current.enterShop("shop-a");
    });

    expect(view.result.current.ledger.parties.all.map((p) => p.name)).toEqual(["Ramesh"]);
  });

  it("does not let an erased book return by way of the migration", async () => {
    // The book that will be migrated, then erased.
    saveLog(seedLog());
    const first = await openTab();
    expect(first.result.current.events).toHaveLength(2);

    await act(async () => {
      await first.result.current.reset();
    });
    first.unmount();

    // Reopening must not re-import the original — "erase everything" undone by
    // a reload is the failure this guards.
    const second = await openTab();
    const db = await openDatabase();
    expect(await countEvents(db)).toBe(0);
    expect(second.result.current.events).toHaveLength(0);
    expect(await readMeta(db, MIGRATION_KEY)).not.toBeNull();
  });
});

// ── Everything the log can carry ─────────────────────────────────────────────

describe("the whole vocabulary reaches the server", () => {
  it("carries deletions, reminders and closings — which REST does not expose", async () => {
    signedIn();
    const view = await openTab();

    await recordCredit(view, "Ramesh", 1200);
    const partyId = view.result.current.ledger.parties.all[0]!.id;
    const entryId = view.result.current.data.transactions[0]!.id;

    await act(async () => {
      await view.result.current.dispatch({
        type: "RecordReminder",
        contactId: partyId,
        tone: "normal",
      });
    });
    await act(async () => {
      await view.result.current.dispatch({ type: "DeleteEntry", entryId });
    });
    await act(async () => {
      await closeDay(view);
    });
    await act(async () => {
      await view.result.current.syncNow();
    });

    expect(api.logFor("shop-a").map((r) => r.type)).toEqual([
      "ContactCreated",
      "CreditRecorded",
      "ContactReminded",
      "EntryDeleted",
      "DayClosed",
    ]);
  });

  it("does not offer a snapshot to the server, and drains it locally", async () => {
    signedIn();
    const view = await openTab();
    await recordCredit(view, "Ramesh", 1200);
    await waitFor(() => expect(api.logFor("shop-a")).toHaveLength(2));

    // An import is a snapshot. Sync refuses them in both directions, so it must
    // not sit in the queue forever being retried.
    await act(async () => {
      await view.result.current.dispatch({
        type: "ImportLedger",
        payload: emptyBackupFile(),
      });
    });
    await act(async () => {
      await view.result.current.syncNow();
    });

    const db = await openDatabase();
    expect(await countPending(db)).toBe(0);
    expect(api.logFor("shop-a").some((r) => r.type === "ImportCompleted")).toBe(false);
  });

  it("tolerates a type this build cannot author, arriving from the server", async () => {
    signedIn();
    const view = await openTab();

    // `BillSettled` is server-generated (ADR-0014) and not in the web
    // vocabulary. Receiving one must not break the fold.
    api.logFor("shop-a").push({
      eventId: "evt_bill",
      type: "BillSettled",
      aggregateId: null,
      payload: {
        quoteId: "q",
        version: 1,
        partyId: "pty_x",
        amount: 700,
        method: "cash",
        jointlyConfirmed: true,
      },
      occurredAt: AT,
      recordedAt: "2026-08-20T00:00:00.001Z",
    });

    await act(async () => {
      await view.result.current.syncNow();
    });

    expect(view.result.current.ledger.parties.all).toHaveLength(0);
    expect(view.result.current.sync.state).toBe("synced");
  });
});

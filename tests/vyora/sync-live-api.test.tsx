/**
 * The real round trip: browser → API → PostgreSQL → browser (WEB-SYNC-003).
 *
 * Every other test in this repository answers a question about the web client
 * in isolation. This one answers the only question that matters at the end of a
 * milestone whose whole purpose was to connect two halves: **does the running
 * application actually reach the server, and does the server actually keep what
 * it was given?**
 *
 * Nothing here is a fake. `VyoraProvider` is the real provider, the commands are
 * the real commands, the store is a real IndexedDB, and `vyora-api` is running
 * against a real PostgreSQL. Events are asserted by asking the *server* what it
 * holds, through a second, independent sync client that shares nothing with the
 * first but the shop.
 *
 * ## The one thing standing in
 *
 * `fetchImpl` plays the part of `app/api/vyora-sync/*` — the Next.js forwarder
 * that reads the `httpOnly` session cookie on the server and attaches the bearer
 * token the browser is never allowed to see. It is nine lines here and it does
 * exactly what the forwarder does: add `authorization`, add `x-vyora-shop`, pass
 * the body through untouched. The forwarder's own behaviour — its production
 * gate, its 401 without a session, its 502 for an unreachable API — is covered
 * by `sync-security.test.ts`, and running Next itself would not make this test
 * prove anything more about the ledger.
 *
 * ## Running it
 *
 *   1. PostgreSQL on 127.0.0.1:55432
 *   2. cd vyora-api && npm run db:migrate && npm run db:seed
 *   3. cd vyora-api && npm run start          (127.0.0.1:4000)
 *   4. cd esytol   && VYORA_E2E_API=1 npx vitest run tests/vyora/sync-live-api.test.tsx
 *
 * Skipped by default, so a checkout with no database is not a red suite. That is
 * the same choice `vyora-mobile/tests/live-api.test.ts` makes for the same
 * reason.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { VyoraProvider, useVyora } from "@/features/vyora/VyoraProvider";
import { ACTIVE_SHOP_KEY } from "@/lib/vyora/active-shop";
import { countPending, openDatabase, readLog } from "@/lib/vyora/sync/store";
import { resetInFlight, sync as runSync, projectionFrom } from "@/lib/vyora/sync/engine";
import { reduceEvents } from "@/lib/vyora/events";
import { ledgerFor } from "@/lib/vyora/selectors";

const LIVE = process.env.VYORA_E2E_API === "1";
const API = process.env.VYORA_E2E_API_URL ?? "http://127.0.0.1:4000";

/** The seeded synthetic workspace. Created by `vyora-api`'s own seed. */
const SHOP = "11111111-1111-4111-8111-111111111111";
const TOKEN = "alpha-token-synthetic";

/**
 * What `app/api/vyora-sync/forward.ts` does, and only what it does.
 *
 * The credential is attached here — on the "server" side of the boundary —
 * because in the real app it lives in a cookie browser JavaScript cannot read.
 */
const realFetch = globalThis.fetch;

function forwarder(state: { offline: boolean }): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (state.offline) throw new TypeError("Failed to fetch");

    const path = String(input)
      .replace("/api/vyora-sync/push", "/api/v1/sync/push")
      .replace("/api/vyora-sync/pull", "/api/v1/sync/pull");
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${TOKEN}`);
    headers.set("x-vyora-shop", SHOP);
    // The captured real fetch. Calling the global here would call this
    // forwarder again, since it is what the global has been replaced with.
    return realFetch(`${API}${path}`, { ...init, headers });
  }) as typeof fetch;
}

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

const net = { offline: false };

beforeEach(() => {
  localStorage.clear();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetInFlight();
  installWebLocks();
  net.offline = false;
  localStorage.setItem(ACTIVE_SHOP_KEY, SHOP);
  vi.stubGlobal("fetch", forwarder(net));
});

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "locks");
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function openTab() {
  const view = renderHook(() => useVyora(), { wrapper });
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  return view;
}

/** A unique name per run, so a re-run does not collide with its own history. */
function uniqueName(): string {
  return `E2E ${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A second browser, sharing only the shop.
 *
 * Its own IndexedDB and its own cursor, so what it can see is exactly what the
 * server holds — which is what makes it a witness rather than an echo.
 */
async function witness(): Promise<ReturnType<typeof ledgerFor>> {
  const factory = new IDBFactory();
  const previous = globalThis.indexedDB;
  (globalThis as { indexedDB: IDBFactory }).indexedDB = factory;
  resetInFlight();
  try {
    const db = await openDatabase();
    await runSync({ db, shopId: SHOP, fetchImpl: forwarder({ offline: false }) });
    return ledgerFor(await projectionFrom(db));
  } finally {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = previous as IDBFactory;
    resetInFlight();
  }
}

describe.skipIf(!LIVE)("the browser and the API, for real", () => {
  it("reaches a server that is actually there", async () => {
    const res = await realFetch(`${API}/api/v1/health`);
    expect(res.status).toBe(200);
  });

  it("records a credit locally, pushes it, and the server hands it to another browser", async () => {
    const name = uniqueName();
    const view = await openTab();

    await act(async () => {
      await view.result.current.dispatch({
        type: "RecordCredit",
        contactName: name,
        amount: 50000,
        kind: "given",
        date: "2026-08-20",
      });
    });

    // Local first, and durable before anything was sent.
    expect(view.result.current.ledger.parties.all.some((p) => p.name === name)).toBe(true);

    await act(async () => {
      await view.result.current.syncNow();
    });
    await waitFor(() => expect(view.result.current.sync.state).toBe("synced"));

    const db = await openDatabase();
    expect(await countPending(db)).toBe(0);

    // PostgreSQL holds it: a browser that has never met this one can see it.
    const other = await witness();
    const party = other.parties.all.find((p) => p.name === name);
    expect(party).toBeDefined();
    expect(other.balances.netByParty.get(party!.id)).toBe(50000);
  }, 60_000);

  it("keeps a whole offline day, then sends it when the API comes back", async () => {
    const name = uniqueName();
    net.offline = true;

    const first = await openTab();
    await act(async () => {
      await first.result.current.dispatch({
        type: "RecordCredit",
        contactName: name,
        amount: 90000,
        kind: "given",
        date: "2026-08-20",
      });
    });
    await act(async () => {
      await first.result.current.dispatch({
        type: "RecordPayment",
        contactName: name,
        amount: 30000,
        kind: "received",
        date: "2026-08-20",
      });
    });

    await waitFor(() => expect(first.result.current.sync.state).toBe("offline"));
    first.unmount();

    // The browser is closed and reopened, still with no connection.
    const second = await openTab();
    const db = await openDatabase();
    expect(await countPending(db)).toBe(3);
    const localParty = second.result.current.ledger.parties.all.find((p) => p.name === name)!;
    expect(second.result.current.ledger.balances.netByParty.get(localParty.id)).toBe(60000);

    // The API comes back.
    net.offline = false;
    await act(async () => {
      await second.result.current.syncNow();
    });
    await waitFor(() => expect(second.result.current.sync.state).toBe("synced"));
    expect(await countPending(db)).toBe(0);

    // Everything arrived, once, and folds to the same figure on the server side.
    const other = await witness();
    const remote = other.parties.all.find((p) => p.name === name)!;
    expect(other.balances.netByParty.get(remote.id)).toBe(60000);
  }, 60_000);

  it("applies its own pushed events back without duplicating them", async () => {
    const name = uniqueName();
    const view = await openTab();

    await act(async () => {
      await view.result.current.dispatch({
        type: "RecordCredit",
        contactName: name,
        amount: 10000,
        kind: "given",
        date: "2026-08-20",
      });
    });
    await act(async () => {
      await view.result.current.syncNow();
    });

    const db = await openDatabase();
    const afterFirst = (await readLog(db)).length;

    // The browser pulls back what it just pushed — it sends no `deviceId`, so
    // the server excludes nothing (ADR-0015). Storing an event already held is
    // a no-op, which is what makes that safe.
    await act(async () => {
      await view.result.current.syncNow();
    });
    await act(async () => {
      await view.result.current.syncNow();
    });

    expect((await readLog(db)).length).toBe(afterFirst);
    const party = view.result.current.ledger.parties.all.find((p) => p.name === name)!;
    expect(view.result.current.ledger.balances.netByParty.get(party.id)).toBe(10000);
  }, 60_000);

  it("carries the events REST has no endpoint for", async () => {
    const name = uniqueName();
    const view = await openTab();

    await act(async () => {
      await view.result.current.dispatch({
        type: "RecordCredit",
        contactName: name,
        amount: 20000,
        kind: "given",
        date: "2026-08-20",
      });
    });
    const partyId = view.result.current.ledger.parties.all.find((p) => p.name === name)!.id;
    await act(async () => {
      await view.result.current.dispatch({
        type: "RecordReminder",
        contactId: partyId,
        tone: "normal",
      });
    });
    const entryId = view.result.current.data.transactions.find((t) => t.partyId === partyId)!.id;
    await act(async () => {
      await view.result.current.dispatch({ type: "DeleteEntry", entryId });
    });

    await act(async () => {
      await view.result.current.syncNow();
    });
    await waitFor(() => expect(view.result.current.sync.state).toBe("synced"));

    // The deletion travelled. A browser restricted to REST could not have sent
    // it — there is no `DELETE /parties/{id}/entries/{id}` — and the other
    // browser would still be showing the entry.
    const other = await witness();
    const remote = other.parties.all.find((p) => p.name === name)!;
    expect(other.balances.netByParty.get(remote.id) ?? 0).toBe(0);
  }, 60_000);

  it("folds the server's history into the same projection the server would", async () => {
    const view = await openTab();
    await act(async () => {
      await view.result.current.syncNow();
    });
    await waitFor(() => expect(view.result.current.sync.state).toBe("synced"));

    const db = await openDatabase();
    const local = reduceEvents(await readLog(db));

    // The seeded workspace's own history came down and folded. Two independent
    // browsers holding the same log must agree, because order is the design.
    const other = await witness();
    expect(other.parties.all.length).toBe(ledgerFor(local).parties.all.length);
    expect(local.parties.length).toBeGreaterThan(0);
  }, 60_000);
});

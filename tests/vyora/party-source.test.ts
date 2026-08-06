/**
 * The Party read adapters.
 *
 * The point of these tests is the invariant that matters most: **a remote
 * failure must not lose or mutate local data.** A merchant's book showing
 * nothing is indistinguishable from a merchant's book being lost, so the local
 * ledger has to survive every way the remote path can go wrong.
 */

import { describe, expect, it, vi, afterEach } from "vitest";
import { ledgerFor } from "@/lib/vyora/selectors";
import { reduceEvents } from "@/lib/vyora/events";
import type { LedgerEvent } from "@/lib/vyora/events";
import { readSearch } from "@/lib/vyora/ledger";
import { localPartySource } from "@/lib/vyora/party-source";
import { remotePartySource, PartyApiError } from "@/lib/vyora/party-source-remote";
import type { VyoraData } from "@/lib/vyora/types";

function evt(partial: Partial<LedgerEvent> & { type: string }): LedgerEvent {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    at: "2026-07-01T09:00:00.000Z",
    ...partial,
  } as LedgerEvent;
}

function buildLedger() {
  const events: LedgerEvent[] = [
    evt({
      type: "ContactCreated",
      party: {
        id: "pty_local1",
        name: "Local Ramesh",
        phone: "9000000001",
        createdAt: "2026-07-01T09:00:00.000Z",
      },
    }),
    evt({
      type: "ContactCreated",
      party: { id: "pty_local2", name: "Local Sita", createdAt: "2026-07-01T09:05:00.000Z" },
    }),
    evt({
      type: "CreditRecorded",
      transaction: {
        id: "txn_1",
        partyId: "pty_local1",
        amount: 1500,
        kind: "given",
        date: "2026-07-01",
        createdAt: "2026-07-01T09:10:00.000Z",
      },
    }),
  ];
  return { events, ledger: ledgerFor(reduceEvents(events)) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local party source (the default)", () => {
  it("returns exactly what the existing ledger read returns", async () => {
    const { ledger } = buildLedger();
    const viaSource = await localPartySource(ledger).list("");
    const viaLedger = readSearch(ledger, "");
    expect(viaSource).toEqual(viaLedger);
  });

  it("searches and reads one party with its derived net", async () => {
    const { ledger } = buildLedger();
    const source = localPartySource(ledger);

    expect((await source.list("ramesh")).map((b) => b.party.id)).toEqual(["pty_local1"]);

    const one = await source.get("pty_local1");
    expect(one?.party.name).toBe("Local Ramesh");
    expect(one?.net).toBe(1500);
  });

  it("returns null for a party it does not have", async () => {
    const { ledger } = buildLedger();
    expect(await localPartySource(ledger).get("pty_nope")).toBeNull();
  });

  it("reports its kind, so a screen can tell where rows came from", () => {
    const { ledger } = buildLedger();
    expect(localPartySource(ledger).kind).toBe("local");
  });
});

describe("remote party source", () => {
  it("maps API rows onto the shape screens already render", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "pty_api1",
                  name: "API Party",
                  phone: "9111111111",
                  note: null,
                  createdAt: "2026-07-02T09:00:00.000Z",
                  balance: { net: -500 },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
      )
    );

    const rows = await remotePartySource().list("");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.party.id).toBe("pty_api1");
    expect(rows[0]!.party.phone).toBe("9111111111");
    expect(rows[0]!.net).toBe(-500);
    // A supplier position round-trips, which is the whole reason role is not stored.
    expect(rows[0]!.net).toBeLessThan(0);
  });

  it("reads through the app's own proxy, never the API directly", async () => {
    // Typed parameters so `mock.calls` carries the argument tuple.
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remotePartySource().list("ram");

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url.startsWith("/api/vyora-dev/parties")).toBe(true);
    expect(url).toContain("q=ram");
    // The API's own origin must never appear in a browser request.
    expect(url).not.toContain("4000");
  });

  it("raises PartyApiError when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );
    await expect(remotePartySource().list("")).rejects.toBeInstanceOf(PartyApiError);
  });

  it("surfaces the API's error code rather than a bare status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "UNAUTHENTICATED", message: "Token not recognised." },
            }),
            { status: 401, headers: { "content-type": "application/json" } }
          )
      )
    );

    await expect(remotePartySource().list("")).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it("does not throw a parse error when the failure body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502</html>", { status: 502 }))
    );
    await expect(remotePartySource().list("")).rejects.toThrow(/502/);
  });
});

describe("a remote failure loses no local data", () => {
  it("leaves the local ledger byte-identical after every remote failure mode", async () => {
    const { ledger } = buildLedger();
    const before = JSON.stringify(ledger.data);

    const failures = [
      () => {
        throw new Error("ECONNREFUSED");
      },
      async () => new Response("boom", { status: 500 }),
      async () => new Response("not json", { status: 200 }),
    ];

    for (const failure of failures) {
      vi.stubGlobal("fetch", vi.fn(failure));
      await expect(remotePartySource().list("")).rejects.toBeTruthy();

      // The local source keeps answering, unchanged, throughout.
      const local = await localPartySource(ledger).list("");
      expect(local).toHaveLength(2);
      expect(JSON.stringify(ledger.data)).toBe(before);
    }
  });

  it("never writes to localStorage from a read path", async () => {
    const { ledger } = buildLedger();
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const clear = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem,
      removeItem,
      clear,
      key: vi.fn(),
      length: 0,
    } as unknown as Storage);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    await expect(remotePartySource().list("")).rejects.toBeTruthy();
    await localPartySource(ledger).list("");
    await localPartySource(ledger).get("pty_local1");

    // Reads are reads. Nothing on this path may touch the device's store.
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("cannot mutate the projection even if the API returns nonsense", async () => {
    const { ledger } = buildLedger();
    const snapshot: VyoraData = JSON.parse(JSON.stringify(ledger.data));

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ items: [{ id: "pty_local1", name: "OVERWRITTEN" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    );

    const rows = await remotePartySource().list("");
    expect(rows[0]!.party.name).toBe("OVERWRITTEN");

    // The remote answer is display-only. The local projection is untouched.
    expect(ledger.data).toEqual(snapshot);
    const local = await localPartySource(ledger).get("pty_local1");
    expect(local?.party.name).toBe("Local Ramesh");
  });
});

describe("the adapter surface is read-only", () => {
  it("exposes no write operation at all", () => {
    const { ledger } = buildLedger();
    const keys = Object.keys(localPartySource(ledger)).sort();
    expect(keys).toEqual(["get", "kind", "list"]);

    const remoteKeys = Object.keys(remotePartySource()).sort();
    expect(remoteKeys).toEqual(["get", "kind", "list"]);
  });
});

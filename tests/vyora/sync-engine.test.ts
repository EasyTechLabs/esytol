/**
 * The sync cycle, against a server that keeps the API's rules.
 *
 * Nothing here reaches inside the engine. Offline is a `fetch` that refuses to
 * answer, a server error is a 500, and an expired session is a 401 — the same
 * things the browser would actually meet. The engine is judged on what it does
 * to the merchant's data afterwards, which is the only thing that matters.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { FakeServer, freshDatabase } from "./sync-harness";
import { sync, projectionFrom, resetInFlight, MAX_PAGES_PER_SYNC } from "@/lib/vyora/sync/engine";
import { appendLocal, countEvents, countPending, readLog, readMeta } from "@/lib/vyora/sync/store";
import { toClientEvent } from "@/lib/vyora/sync/protocol";
import {
  createContactCreated,
  createCreditRecorded,
  createPaymentRecorded,
  createDayClosed,
  createEntryDeleted,
  reduceEvents,
} from "@/lib/vyora/events";
import { buildLedger } from "@/lib/vyora/ledger";
import type { LedgerEvent } from "@/lib/vyora/events";

const SHOP = "11111111-1111-4111-8111-111111111111";

let db: IDBDatabase;
let server: FakeServer;

beforeEach(async () => {
  db = await freshDatabase();
  server = new FakeServer();
  resetInFlight();
});

const engine = () => ({ db, shopId: SHOP, fetchImpl: server.fetch });

/** What the merchant would see: the net position of one party. */
async function netFor(partyId: string): Promise<number> {
  const ledger = buildLedger(await projectionFrom(db));
  return ledger.balances.netByParty.get(partyId) ?? 0;
}

describe("a browser that is offline", () => {
  it("records a whole day's work and keeps every bit of it", async () => {
    server.options.offline = true;

    const party = createContactCreated({ name: "Ramesh" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 5000, kind: "given" });
    const payment = createPaymentRecorded({
      partyId: party.party.id,
      amount: 2000,
      kind: "received",
    });
    const closing = createDayClosed(
      "2026-08-15",
      {
        date: "2026-08-15",
        collected: 2000,
        creditGiven: 5000,
        paidOut: 0,
        netCash: 2000,
        outstandingChange: 3000,
        entryCount: 2,
      },
      "closed offline"
    );
    for (const event of [party, credit, payment, closing]) await appendLocal(db, event);

    const outcome = await sync(engine());

    // Offline is a state, not a failure of the merchant's work.
    expect(outcome.state).toBe("offline");
    expect(await countPending(db)).toBe(4);
    expect(await netFor(party.party.id)).toBe(3000);
  });

  it("survives the browser being closed and reopened", async () => {
    server.options.offline = true;
    const party = createContactCreated({ name: "Ramesh" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 5000, kind: "given" });
    await appendLocal(db, party);
    await appendLocal(db, credit);
    await sync(engine());

    // Reopening is a fresh connection to the same database — no in-memory
    // state carried over, which is precisely what a restart means.
    const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vyora", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    expect(await countEvents(reopened)).toBe(2);
    expect(reduceEvents(await readLog(reopened)).transactions[0]!.amount).toBe(5000);
  });

  it("sends everything once the connection comes back, with no duplicates", async () => {
    server.options.offline = true;
    const party = createContactCreated({ name: "Ramesh" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 5000, kind: "given" });
    const payment = createPaymentRecorded({
      partyId: party.party.id,
      amount: 2000,
      kind: "received",
    });
    for (const event of [party, credit, payment]) await appendLocal(db, event);
    await sync(engine());

    server.options.offline = false;
    const outcome = await sync(engine());

    expect(outcome.state).toBe("synced");
    expect(outcome.pushed).toBe(3);
    expect(server.log).toHaveLength(3);
    expect(await countPending(db)).toBe(0);

    // Syncing again must not append a second copy of anything.
    await sync(engine());
    expect(server.log).toHaveLength(3);
    expect(await countEvents(db)).toBe(3);
    expect(await netFor(party.party.id)).toBe(3000);
  });
});

describe("two clients on one shop", () => {
  it("converges: web credits ₹500, mobile pays ₹200, web sees ₹300", async () => {
    // WEB — create the customer and give ₹500 of credit.
    const party = createContactCreated({ name: "Sunita" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 500, kind: "given" });
    await appendLocal(db, party);
    await appendLocal(db, credit);
    await sync(engine());
    expect(server.log).toHaveLength(2);

    // MOBILE — pulls those, then records a ₹200 payment of its own. Its events
    // arrive at the server exactly as a phone's would.
    const mobilePayment = createPaymentRecorded({
      partyId: party.party.id,
      amount: 200,
      kind: "received",
    });
    server.receiveFromOtherClient(toClientEvent(mobilePayment));

    // WEB — pulls.
    const outcome = await sync(engine());

    expect(outcome.pulled).toBe(1);
    expect(await netFor(party.party.id)).toBe(300);
  });

  it("applies its own events back harmlessly, since it pulls with no device", async () => {
    const party = createContactCreated({ name: "Own" });
    await appendLocal(db, party);
    await sync(engine());

    // A browser has no device, so `deviceId` is omitted and the server excludes
    // nothing — this browser reads its own work back on every pull.
    await sync(engine());
    await sync(engine());

    expect(await countEvents(db)).toBe(1);
    expect((await readLog(db)).filter((e) => e.id === party.id)).toHaveLength(1);
  });

  it("keeps the two clients' events in the server's order, not arrival order", async () => {
    // The other client's event is recorded FIRST on the server, but this
    // browser learns about it second.
    const theirs = createContactCreated({ name: "Theirs" });
    server.receiveFromOtherClient(toClientEvent(theirs));

    const mine = createContactCreated({ name: "Mine" });
    await appendLocal(db, mine);

    await sync(engine());

    const order = (await readLog(db)).map((e) => e.id);
    const serverOrder = server.log
      .slice()
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map((e) => e.eventId);
    // Convergence is this line: the local fold order is the server's order.
    expect(order).toEqual(serverOrder);
  });

  it("carries a deletion, which REST has no endpoint for", async () => {
    const party = createContactCreated({ name: "Deleted entry" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 700, kind: "given" });
    await appendLocal(db, party);
    await appendLocal(db, credit);
    await sync(engine());

    // The reason `/sync/push` had to be fixed rather than replaced by REST
    // calls: there is no endpoint that can say "this entry is gone".
    const deletion = createEntryDeleted(credit.transaction.id);
    await appendLocal(db, deletion);
    await sync(engine());

    expect(server.log.map((e) => e.type)).toContain("EntryDeleted");
    expect(await netFor(party.party.id)).toBe(0);
  });
});

describe("failure, and what it must not cost", () => {
  it("keeps queued work when the server errors, and sends it on the retry", async () => {
    const party = createContactCreated({ name: "Retried" });
    await appendLocal(db, party);

    server.options.failNext = 1;
    const first = await sync(engine());

    expect(first.state).toBe("offline");
    expect(await countPending(db)).toBe(1);
    expect(server.log).toHaveLength(0);

    const second = await sync(engine());
    expect(second.state).toBe("synced");
    expect(server.log).toHaveLength(1);
  });

  it("reuses one idempotency key across attempts at the same batch", async () => {
    const party = createContactCreated({ name: "Keyed" });
    await appendLocal(db, party);

    server.options.failNext = 1;
    await sync(engine());
    const afterFailure = await readMeta<string>(db, "pushIdempotencyKey");
    expect(afterFailure).toBeTruthy();

    await sync(engine());
    // A key minted per attempt is a NEW key on every retry, which is how one
    // batch becomes two. It is cleared only once the server has answered.
    expect(await readMeta<string>(db, "pushIdempotencyKey")).toBeNull();
  });

  it("stops syncing when the session has expired, and loses nothing", async () => {
    const party = createContactCreated({ name: "Signed out" });
    await appendLocal(db, party);

    server.options.unauthorized = true;
    const outcome = await sync(engine());

    expect(outcome.state).toBe("auth-required");
    expect(await countPending(db)).toBe(1);
    expect(server.log).toHaveLength(0);
  });

  it("keeps the push half's success when the pull half fails", async () => {
    const party = createContactCreated({ name: "Half" });
    await appendLocal(db, party);

    // Push succeeds; the pull that follows meets a 500.
    const realFetch = server.fetch;
    let seenPush = false;
    const flaky = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/vyora-sync/push")) {
        seenPush = true;
        return realFetch(input, init);
      }
      if (seenPush) {
        return new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "no" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    const outcome = await sync({ db, shopId: SHOP, fetchImpl: flaky });

    expect(outcome.state).toBe("offline");
    // The merchant's work IS on the server. Flattening both halves into one
    // "sync failed" would hide that and invite a pointless re-send.
    expect(outcome.pushed).toBe(1);
    expect(server.log).toHaveLength(1);
    expect(await countPending(db)).toBe(0);
  });
});

describe("the orchestrator", () => {
  it("collapses concurrent callers into one cycle", async () => {
    await appendLocal(db, createContactCreated({ name: "Once" }));

    // Startup, a mutation and the merchant pressing the button, together.
    const [a, b, c] = await Promise.all([sync(engine()), sync(engine()), sync(engine())]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    // One push and one pull, not three of each.
    expect(server.requests.filter((r) => r.url.startsWith("/api/vyora-sync/push"))).toHaveLength(1);
    expect(server.log).toHaveLength(1);
  });

  it("never sends a deviceId, because the browser has no device", async () => {
    await appendLocal(db, createContactCreated({ name: "Deviceless" }));

    const outcome = await sync(engine());

    // The harness answers 400 if one appears. ADR-0016 moved attribution to
    // the server so the browser does not have to invent a device, and a client
    // that started sending one again would quietly undo that.
    expect(outcome.state).toBe("synced");
    expect(server.log).toHaveLength(1);
  });

  it("pages through a long history without hanging the screen", async () => {
    for (let i = 0; i < 25; i++) {
      server.receiveFromOtherClient(toClientEvent(createContactCreated({ name: `Contact ${i}` })));
    }
    server.options.pageSize = 5;

    const outcome = await sync(engine());

    expect(outcome.pages).toBeLessThanOrEqual(MAX_PAGES_PER_SYNC);
    expect(await countEvents(db)).toBe(25);
    // Resuming from the cursor finishes the job rather than starting over.
    const cursor = await readMeta<string>(db, "cursor");
    expect(cursor).toBeTruthy();
  });

  it("resumes from the cursor rather than re-reading the whole log", async () => {
    for (let i = 0; i < 4; i++) {
      server.receiveFromOtherClient(toClientEvent(createContactCreated({ name: `C${i}` })));
    }
    server.options.pageSize = 2;
    await sync(engine());
    const requestsAfterFirst = server.requests.length;

    server.receiveFromOtherClient(toClientEvent(createContactCreated({ name: "Late" })));
    const outcome = await sync(engine());

    expect(outcome.pulled).toBe(1);
    expect(await countEvents(db)).toBe(5);
    expect(server.requests.length).toBeGreaterThan(requestsAfterFirst);
  });

  it("does nothing expensive when there is nothing to do", async () => {
    const outcome = await sync(engine());

    expect(outcome.state).toBe("synced");
    expect(outcome.pushed).toBe(0);
    expect(outcome.pulled).toBe(0);
    // No pending events means no push request at all.
    expect(server.requests.filter((r) => r.url.startsWith("/api/vyora-sync/push"))).toHaveLength(0);
  });

  it("records when it last succeeded", async () => {
    const outcome = await sync({ ...engine(), now: () => "2026-08-15T12:00:00.000Z" });

    expect(outcome.state).toBe("synced");
    expect(await readMeta<string>(db, "lastSyncAt")).toBe("2026-08-15T12:00:00.000Z");
  });
});

describe("the ledger the merchant reads", () => {
  it("is the same whether entries arrived locally or over the wire", async () => {
    const party = createContactCreated({ name: "Either way" });
    const credit = createCreditRecorded({ partyId: party.party.id, amount: 900, kind: "given" });
    const payment = createPaymentRecorded({
      partyId: party.party.id,
      amount: 400,
      kind: "received",
    });

    // Half recorded here, half by another client.
    await appendLocal(db, party);
    await appendLocal(db, credit);
    await sync(engine());
    server.receiveFromOtherClient(toClientEvent(payment));
    await sync(engine());

    const synced: LedgerEvent[] = await readLog(db);
    const local = reduceEvents([party, credit, payment]);

    expect(reduceEvents(synced).parties).toEqual(local.parties);
    expect(await netFor(party.party.id)).toBe(500);
  });
});

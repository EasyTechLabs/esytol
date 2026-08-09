/**
 * Mobile against the real API, the real PostgreSQL, and real SQLite.
 *
 * This runs the app's **own** code — the same repository, the same outbox, the
 * same sync engine, the same generated client — against a live local API. What
 * it does not exercise is React Native's UI layer, which needs an emulator; the
 * screens are thin wrappers over exactly these calls.
 *
 * Skipped unless `VYORA_E2E_API` names a running API, so the ordinary test run
 * stays hermetic:
 *
 *   VYORA_E2E_API=http://127.0.0.1:4000 VYORA_E2E_IDENTITY=alpha npx jest live-api
 */

import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { request as httpRequest } from "node:http";
import { migratedDatabase, type TestDatabase } from "./helpers";
import { createParty, recordCredit, recordPayment } from "../src/features/ledger";
import { readStatement, readSummary, countUnsyncedEntries } from "../src/database/repository";
import { drain } from "../src/sync/engine";
import { createApiClient } from "../src/api/client";
import * as outbox from "../src/sync/outbox";

const BASE_URL = process.env.VYORA_E2E_API;
const IDENTITY = process.env.VYORA_E2E_IDENTITY ?? "alpha";

const maybe = BASE_URL ? describe : describe.skip;

/**
 * A real HTTP transport.
 *
 * The `jest-expo` preset replaces `fetch` with React Native's XHR-backed
 * polyfill, which in a Node test process resolves without ever reaching the
 * network — every request comes back with an undefined status, which this
 * client correctly reads as a refusal. So this test supplies its own transport
 * over `node:http`.
 *
 * It implements only what the client actually uses: `status`, `ok` and
 * `text()`. The classification logic under test is entirely the client's.
 */
const nodeFetch = ((url: string, init: RequestInit = {}) =>
  new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers: (init.headers ?? {}) as Record<string, string>,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            text: async () => body,
            headers: new Map(Object.entries(res.headers)),
          })
        );
      }
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  })) as unknown as typeof fetch;

maybe("a phone talking to the real API", () => {
  let db: TestDatabase;
  const api = createApiClient({ baseUrl: BASE_URL!, identity: IDENTITY }, nodeFetch);

  beforeAll(async () => {
    db = await migratedDatabase();
  });
  afterAll(() => {
    db?.close();
  });

  it("records offline, then delivers everything once the API is reachable", async () => {
    const name = `E2E Mobile ${Date.now()}`;
    const partyId = await createParty(db, { name });
    await recordCredit(db, { partyId, amount: 2000, kind: "given", description: "mobile e2e" });
    await recordPayment(db, { partyId, amount: 750, kind: "received", note: "mobile e2e" });

    // The device already knows the answer, before any network.
    const localBefore = await readSummary(db, partyId);
    expect(localBefore.net).toBe(1250);
    expect(await countUnsyncedEntries(db)).toBe(2);

    const result = await drain(db, api);
    expect(result.stoppedBecause).toBeNull();
    expect(result.sent).toBe(3);
    expect(result.blocked).toBe(0);

    // Nothing is left queued, and every row is marked.
    expect(await countUnsyncedEntries(db)).toBe(0);
    expect((await outbox.counts(db)).pending).toBe(0);

    // The server folded the same balance from the same entries.
    const remote = await api.summary(partyId);
    if (remote.kind !== "ok") throw new Error(`summary failed: ${JSON.stringify(remote)}`);
    expect(remote.value.balance.net).toBe(localBefore.net);
    expect(remote.value.totals.creditGiven).toBe(2000);
    expect(remote.value.totals.paymentReceived).toBe(750);
    expect(remote.value.counts).toEqual({ credits: 1, payments: 1 });

    // And the two statements agree row for row, in the same order.
    const localRows = await readStatement(db, partyId);
    const remoteStatement = await api.statement(partyId);
    if (remoteStatement.kind !== "ok") throw new Error("statement failed");
    expect(remoteStatement.value.rows.map((r) => r.id)).toEqual(localRows.map((r) => r.id));
    expect(remoteStatement.value.rows.map((r) => r.runningNet)).toEqual(
      localRows.map((r) => r.runningNet)
    );
  }, 30_000);

  it("a second drain sends nothing and duplicates nothing", async () => {
    const before = await outbox.counts(db);
    const result = await drain(db, api);
    expect(result.attempted).toBe(0);
    expect(await outbox.counts(db)).toEqual(before);
  }, 30_000);

  it("survives the API going away mid-session without losing an entry", async () => {
    // Point at a port nothing is listening on — the same shape as a shop
    // losing signal, and the case the whole design exists for.
    const offline = createApiClient({ baseUrl: "http://127.0.0.1:59999", identity: IDENTITY }, nodeFetch);

    const partyId = await createParty(db, { name: `E2E Offline ${Date.now()}` });
    await recordCredit(db, { partyId, amount: 480, kind: "given" });

    const before = await readStatement(db, partyId);
    const result = await drain(db, offline);
    expect(result.sent).toBe(0);
    expect(result.stoppedBecause).toBeTruthy();

    // The ledger is untouched, and the queue still holds the delivery.
    expect(await readStatement(db, partyId)).toEqual(before);
    expect((await outbox.counts(db)).pending).toBeGreaterThan(0);

    // The deferred row is now sitting on its first backoff, so an immediate
    // retry finds nothing due. That is the queue working, not a failure.
    expect((await drain(db, api)).attempted).toBe(0);

    // Reconnect once the backoff has elapsed. Same rows, same original keys.
    const afterBackoff = () => new Date(Date.now() + 10_000).toISOString();
    const recovered = await drain(db, api, { now: afterBackoff });
    expect(recovered.sent).toBe(2);

    const remote = await api.summary(partyId);
    if (remote.kind !== "ok") throw new Error("summary failed");
    expect(remote.value.balance.net).toBe(480);
  }, 30_000);
});

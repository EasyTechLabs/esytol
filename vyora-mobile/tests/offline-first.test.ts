/**
 * Offline-first behaviour, end to end against real SQLite.
 *
 * The claim these tests defend is narrow and absolute: **a merchant's entry is
 * never lost because the network was not there.** Everything else in the sync
 * design is negotiable; that is not.
 */

import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import { migratedDatabase, fixedClock, type TestDatabase } from "./helpers";
import { createParty, recordCredit, recordPayment } from "../src/features/ledger";
import { listParties, readStatement, readSummary, countUnsyncedEntries } from "../src/database/repository";
import * as outbox from "../src/sync/outbox";
import { drain } from "../src/sync/engine";
import type { ApiClient, ApiOutcome } from "../src/api/client";

let db: TestDatabase;

beforeEach(async () => {
  db = await migratedDatabase();
});
afterEach(() => {
  db.close();
});

/** An API that is simply not there. */
function offlineApi(): ApiClient {
  const fail = async (): Promise<ApiOutcome<never>> => ({
    kind: "retry",
    message: "Could not reach the API.",
    status: null,
  });
  return {
    listParties: fail,
    createParty: fail,
    recordCredit: fail,
    recordPayment: fail,
    statement: fail,
    summary: fail,
  } as unknown as ApiClient;
}

/** An API that accepts everything, recording what it was sent. */
function acceptingApi(log: Array<{ path: string; key: string | undefined; body: unknown }>) {
  const ok = (path: string) =>
    (async (...args: unknown[]): Promise<ApiOutcome<unknown>> => {
      const options = args[args.length - 1] as { idempotencyKey?: string };
      const body = args.length === 3 ? args[1] : args[0];
      log.push({ path, key: options?.idempotencyKey, body });
      return { kind: "ok", value: { ok: true }, status: 201 };
    }) as never;

  return {
    listParties: ok("listParties"),
    createParty: ok("createParty"),
    recordCredit: ok("recordCredit"),
    recordPayment: ok("recordPayment"),
    statement: ok("statement"),
    summary: ok("summary"),
  } as unknown as ApiClient;
}

describe("a merchant can work with no connection at all", () => {
  it("records a party, a credit and a payment, and can read the balance back", async () => {
    const partyId = await createParty(db, { name: "Ramesh Traders" });
    await recordCredit(db, { partyId, amount: 2000, kind: "given" });
    await recordPayment(db, { partyId, amount: 500, kind: "received" });

    const rows = await readStatement(db, partyId);
    expect(rows.map((r) => r.runningNet)).toEqual([2000, 1500]);

    const summary = await readSummary(db, partyId);
    expect(summary.net).toBe(1500);
    expect(summary.totals).toEqual({
      creditGiven: 2000,
      creditTaken: 0,
      paymentReceived: 500,
      paymentPaid: 0,
    });

    // Nothing has been delivered, and everything is queued.
    expect(await countUnsyncedEntries(db)).toBe(2);
    expect((await outbox.counts(db)).pending).toBe(3);
  });

  it("shows unsent entries in the ledger rather than holding them back", async () => {
    // A merchant who took ₹500 with no signal must be able to see the ₹500 they
    // just took. That is precisely when they most need to.
    const partyId = await createParty(db, { name: "Offline Shop" });
    await recordPayment(db, { partyId, amount: 500, kind: "received" });

    const [party] = await listParties(db);
    expect(party!.net).toBe(-500);
    expect(party!.pending).toBe(1);

    const rows = await readStatement(db, partyId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.synced).toBe(false);
  });

  it("loses nothing when every delivery attempt fails", async () => {
    const partyId = await createParty(db, { name: "No Signal" });
    await recordCredit(db, { partyId, amount: 1200, kind: "given" });

    const before = await readStatement(db, partyId);
    const result = await drain(db, offlineApi());

    expect(result.sent).toBe(0);
    expect(result.deferred).toBe(1);
    expect(result.stoppedBecause).toContain("Could not reach");

    // The ledger is byte-for-byte what it was.
    expect(await readStatement(db, partyId)).toEqual(before);
    expect((await outbox.counts(db)).pending).toBe(2);
  });
});

describe("delivery, once a connection appears", () => {
  it("sends everything and marks it, in insertion order", async () => {
    const log: Array<{ path: string; key: string | undefined; body: unknown }> = [];
    const partyId = await createParty(db, { name: "Reconnected" });
    await recordCredit(db, { partyId, amount: 800, kind: "given" });
    await recordPayment(db, { partyId, amount: 300, kind: "received" });

    const result = await drain(db, acceptingApi(log));

    expect(result.sent).toBe(3);
    // The party must reach the server before the entries that reference it —
    // a credit posted first is refused with a 404 that looks permanent.
    expect(log.map((l) => l.path)).toEqual(["createParty", "recordCredit", "recordPayment"]);

    expect(await countUnsyncedEntries(db)).toBe(0);
    const counts = await outbox.counts(db);
    expect(counts.pending).toBe(0);
    expect(counts.sent).toBe(3);
  });

  it("never sends partyId in a body — it belongs in the path", async () => {
    // The contract's request schemas are additionalProperties: false, so an
    // extra partyId would be a validation failure on every single entry.
    const log: Array<{ path: string; key: string | undefined; body: unknown }> = [];
    const partyId = await createParty(db, { name: "Body Shape" });
    await recordCredit(db, { partyId, amount: 100, kind: "given" });
    await drain(db, acceptingApi(log));

    const credit = log.find((l) => l.path === "recordCredit")!;
    expect(credit.body).not.toHaveProperty("partyId");
    expect(credit.body).toHaveProperty("id");
    expect(credit.body).toHaveProperty("amount", 100);
  });

  it("reuses one idempotency key across retries instead of minting a new one", async () => {
    // This is the difference between a retry and a duplicate entry.
    const partyId = await createParty(db, { name: "Retry Safe" });
    await recordCredit(db, { partyId, amount: 640, kind: "given" });

    const clock = fixedClock();
    await drain(db, offlineApi(), { clock: clock.nowMs, now: clock.nowIso });

    const first = await db.getAllAsync<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM outbox ORDER BY id`
    );

    clock.advance(60_000);
    await drain(db, offlineApi(), { clock: clock.nowMs, now: clock.nowIso });

    const second = await db.getAllAsync<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM outbox ORDER BY id`
    );
    expect(second).toEqual(first);
  });

  it("never jumps a row that is waiting on a backoff", async () => {
    // Regression. The drain used to select only rows that were due, which let
    // a credit overtake the party it references after one dropped connection.
    // The server refused the credit with a 404 — permanent — and parked a
    // perfectly good entry as "needs attention".
    const clock = fixedClock();
    const partyId = await createParty(db, { name: "Ordering" });
    await recordCredit(db, { partyId, amount: 300, kind: "given" });

    // One outage defers the party.
    await drain(db, offlineApi(), { clock: clock.nowMs, now: clock.nowIso });

    // Connection is back, but the party's backoff has not elapsed. The credit
    // behind it must not be sent on its own.
    const log: Array<{ path: string; key: string | undefined; body: unknown }> = [];
    const immediate = await drain(db, acceptingApi(log), {
      clock: clock.nowMs,
      now: clock.nowIso,
    });
    expect(immediate.attempted).toBe(0);
    expect(log).toEqual([]);
    expect(immediate.stoppedBecause).toContain("Waiting until");

    // Once it has, both go, party first.
    clock.advance(10_000);
    const after = await drain(db, acceptingApi(log), { clock: clock.nowMs, now: clock.nowIso });
    expect(after.sent).toBe(2);
    expect(log.map((l) => l.path)).toEqual(["createParty", "recordCredit"]);
  });

  it("stops at the first unreachable row rather than burning the whole queue", async () => {
    const partyId = await createParty(db, { name: "One Outage" });
    await recordCredit(db, { partyId, amount: 100, kind: "given" });
    await recordCredit(db, { partyId, amount: 200, kind: "given" });

    const result = await drain(db, offlineApi());

    expect(result.attempted).toBe(1);
    expect(result.deferred).toBe(1);

    // One outage must not push every queued entry onto a long backoff.
    const rows = await db.getAllAsync<{ attempts: number }>(
      `SELECT attempts FROM outbox ORDER BY id`
    );
    expect(rows.map((r) => r.attempts)).toEqual([1, 0, 0]);
  });
});

describe("a refusal the server will not reconsider", () => {
  function refusingApi(): ApiClient {
    const permanent = async (): Promise<ApiOutcome<never>> => ({
      kind: "permanent",
      message: "Entry already exists with different content.",
      code: "RESOURCE_ALREADY_EXISTS",
      status: 409,
    });
    const ok = async (): Promise<ApiOutcome<unknown>> => ({
      kind: "ok",
      value: {},
      status: 201,
    });
    return {
      createParty: ok,
      recordCredit: permanent,
      recordPayment: ok,
      listParties: ok,
      statement: ok,
      summary: ok,
    } as unknown as ApiClient;
  }

  it("parks it, keeps the entry, and does not stop the rest of the queue", async () => {
    const partyId = await createParty(db, { name: "Conflicted" });
    await recordCredit(db, { partyId, amount: 100, kind: "given" });
    await recordPayment(db, { partyId, amount: 50, kind: "received" });

    const result = await drain(db, refusingApi());

    expect(result.blocked).toBe(1);
    // The payment behind it still went — a permanent refusal is about one row.
    expect(result.sent).toBe(2);

    const stuck = await outbox.blocked(db);
    expect(stuck).toHaveLength(1);
    expect(stuck[0]!.lastError).toContain("RESOURCE_ALREADY_EXISTS");

    // The merchant's entry is still in their ledger. Only the retrying stopped.
    const rows = await readStatement(db, partyId);
    expect(rows).toHaveLength(2);
    expect(await readSummary(db, partyId)).toMatchObject({ net: 50 });
  });

  it("retrying a blocked row keeps its original key", async () => {
    const partyId = await createParty(db, { name: "Requeued" });
    await recordCredit(db, { partyId, amount: 100, kind: "given" });
    await drain(db, refusingApi());

    const before = (await outbox.blocked(db))[0]!;
    await outbox.retryBlocked(db, before.id);

    const after = await db.getFirstAsync<{ idempotency_key: string; status: string; attempts: number }>(
      `SELECT idempotency_key, status, attempts FROM outbox WHERE id = ?`,
      [before.id]
    );
    expect(after!.idempotency_key).toBe(before.idempotencyKey);
    expect(after!.status).toBe("pending");
    expect(after!.attempts).toBe(0);
  });
});

describe("the ledger row and its delivery are written together or not at all", () => {
  it("rolls back the entry when queueing it fails", async () => {
    const partyId = await createParty(db, { name: "Atomic" });
    await recordCredit(db, { partyId, amount: 100, kind: "given" });

    // A second delivery for the same subject violates the unique index. That is
    // the failure this asserts against: if the two writes were not atomic, the
    // entry would survive with nothing left to deliver it.
    //
    // ORDER BY is not decoration here — an unordered SELECT comes back in
    // (kind, subject_id) index order, which puts the credit first and the
    // party last, and picking "the last row" then targets the wrong subject.
    const rows = await db.getAllAsync<{ subject_id: string }>(
      `SELECT subject_id FROM outbox WHERE kind = 'credit' ORDER BY id`
    );
    const entryId = rows[0]!.subject_id;

    await expect(
      db.withTransactionAsync(async () => {
        await outbox.enqueue(db, {
          kind: "credit",
          subjectId: entryId,
          idempotencyKey: "duplicate",
          payload: {},
        });
      })
    ).rejects.toThrow();

    const after = await db.getAllAsync<{ n: number }>(
      `SELECT count(*) AS n FROM outbox WHERE subject_id = ?`,
      [entryId]
    );
    expect(after[0]!.n).toBe(1);
  });
});

/**
 * The ledger slice on the API side.
 *
 * A credit is an immutable event; the statement is a projection of accepted
 * events. Nothing here replaces state, and no total is stored — so the tests
 * that matter are the ones proving the event log is the record and the
 * statement merely reads it.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { call, startHarness, uuid, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const token = () => h.seeded.alpha.token;
const partyId = () => h.seeded.alpha.partyIds[0]!;

function credit(overrides: Record<string, unknown> = {}) {
  return {
    id: `txn_${uuid()}`,
    amount: 2500,
    kind: "given",
    description: "ledger test",
    date: "2026-08-09",
    ...overrides,
  };
}

async function record(body: Record<string, unknown>, key = uuid(), party = partyId()) {
  return call(h.app, "POST", `/api/v1/parties/${party}/credits`, {
    token: token(),
    headers: { "idempotency-key": key },
    payload: body,
  });
}

describe("recording a credit appends an immutable event", () => {
  it("returns the stored entry with the event that produced it", async () => {
    const body = credit();
    const res = await record(body);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(body.id);
    expect(res.body.direction).toBe("given");
    expect(res.body.amount).toBe(2500);
    // The audit handle: a statement line can be traced back to one event.
    expect(res.body.eventId).toMatch(/^evt_/);
    // A business date is a calendar day, not an instant.
    expect(res.body.date).toBe("2026-08-09");
  });

  it("writes a CreditRecorded event, not a state replacement", async () => {
    const body = credit();
    await record(body);

    const { rows } = await h.pool.query<{ type: string; aggregate_id: string; payload: unknown }>(
      `SELECT type, aggregate_id, payload FROM events
        WHERE merchant_id = $1 AND payload->'transaction'->>'id' = $2`,
      [h.seeded.alpha.merchantId, body.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("CreditRecorded");
    expect(rows[0]!.aggregate_id).toBe(partyId());
  });

  it("never stores a balance", async () => {
    const { rows } = await h.pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%balance%'`
    );
    expect(rows).toEqual([]);
  });

  it("rejects a body that names a merchant", async () => {
    const res = await record({ ...credit(), merchantId: h.seeded.beta.merchantId });
    expect(res.status).toBe(422);
  });

  it("requires an Idempotency-Key", async () => {
    const res = await call(h.app, "POST", `/api/v1/parties/${partyId()}/credits`, {
      token: token(),
      payload: credit(),
    });
    expect(res.status).toBe(400);
  });

  it("404s for a party that is not in this workspace", async () => {
    const res = await record(credit(), uuid(), h.seeded.beta.partyIds[0]!);
    expect(res.status).toBe(404);
  });
});

describe("duplicate handling keeps the log immutable", () => {
  it("an identical replay adds no second event", async () => {
    const body = credit();
    const key = uuid();

    const first = await record(body, key);
    const replay = await record(body, key);

    expect(first.status).toBe(201);
    expect(replay.body.id).toBe(body.id);

    const { rows } = await h.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events
        WHERE merchant_id = $1 AND payload->'transaction'->>'id' = $2`,
      [h.seeded.alpha.merchantId, body.id]
    );
    expect(rows[0]!.n).toBe(1);
  });

  it("the same entry id with different content is refused, never overwritten", async () => {
    const id = `txn_${uuid()}`;
    await record(credit({ id, amount: 100 }));
    const conflict = await record(credit({ id, amount: 999 }));

    expect(conflict.status).toBe(409);

    const { rows } = await h.pool.query<{ amount: number }>(
      `SELECT amount FROM entry_projection WHERE merchant_id = $1 AND entry_id = $2`,
      [h.seeded.alpha.merchantId, id]
    );
    expect(rows[0]!.amount).toBe(100);
  });
});

describe("the statement is a projection of accepted events", () => {
  it("folds a running balance oldest-first", async () => {
    const party = h.seeded.alpha.partyIds[1]!;
    await record(credit({ amount: 1000, date: "2026-08-01" }), uuid(), party);
    await record(credit({ amount: 400, kind: "taken", date: "2026-08-02" }), uuid(), party);

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() });
    expect(res.status).toBe(200);

    const rows = res.body.rows as Array<{ signedAmount: number; runningNet: number }>;
    // The seeded credit (1500 given) plus 1000 given minus 400 taken.
    expect(rows.length).toBe(3);
    let running = 0;
    for (const row of rows) {
      running += row.signedAmount;
      expect(row.runningNet).toBe(running);
    }
    expect(res.body.balance.net).toBe(running);
    expect(res.body.balance.entryCount).toBe(rows.length);
  });

  it("signs direction from the merchant's point of view", async () => {
    const party = h.seeded.alpha.partyIds[2]!;
    const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() });
    const rows = res.body.rows as Array<{ direction: string; signedAmount: number }>;
    for (const row of rows) {
      if (row.direction === "given" || row.direction === "paid") {
        expect(row.signedAmount).toBeGreaterThan(0);
      } else {
        expect(row.signedAmount).toBeLessThan(0);
      }
    }
    // This seeded party is a supplier, so the merchant owes them.
    expect(res.body.balance.position).toBe("merchant_owes");
  });

  it("reports no_entries for a party with nothing recorded", async () => {
    const id = `pty_${uuid()}`;
    await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id, name: "Empty Party" },
    });
    const res = await call(h.app, "GET", `/api/v1/parties/${id}/statement`, { token: token() });
    expect(res.body.rows).toEqual([]);
    expect(res.body.balance).toMatchObject({ net: 0, position: "no_entries", entryCount: 0 });
  });

  it("rejects an out-of-range limit", async () => {
    const res = await call(h.app, "GET", `/api/v1/parties/${partyId()}/statement`, {
      token: token(),
      query: { limit: "500" },
    });
    expect(res.status).toBe(400);
  });
});

describe("cross-tenant statement isolation", () => {
  it("beta cannot read alpha's statement", async () => {
    const res = await call(h.app, "GET", `/api/v1/parties/${partyId()}/statement`, {
      token: h.seeded.beta.token,
    });
    // 404, never 403 — a 403 would confirm the party exists.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the same 404 for a party that exists nowhere", async () => {
    const fake = "pty_00000000-0000-4000-8000-000000000000";
    const crossTenant = await call(h.app, "GET", `/api/v1/parties/${partyId()}/statement`, {
      token: h.seeded.beta.token,
    });
    const nonExistent = await call(h.app, "GET", `/api/v1/parties/${fake}/statement`, {
      token: h.seeded.beta.token,
    });
    expect(crossTenant.status).toBe(nonExistent.status);
    expect(crossTenant.body.error.code).toBe(nonExistent.body.error.code);
  });

  it("beta cannot record a credit against alpha's party", async () => {
    const res = await call(h.app, "POST", `/api/v1/parties/${partyId()}/credits`, {
      token: h.seeded.beta.token,
      headers: { "idempotency-key": uuid() },
      payload: credit(),
    });
    expect(res.status).toBe(404);
  });

  it("an entry recorded by beta never appears in alpha's statement", async () => {
    const betaParty = h.seeded.beta.partyIds[0]!;
    const body = credit({ amount: 8888 });
    const made = await call(h.app, "POST", `/api/v1/parties/${betaParty}/credits`, {
      token: h.seeded.beta.token,
      headers: { "idempotency-key": uuid() },
      payload: body,
    });
    expect(made.status).toBe(201);

    for (const party of h.seeded.alpha.partyIds) {
      const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, {
        token: token(),
      });
      const ids = (res.body.rows as Array<{ id: string }>).map((r) => r.id);
      expect(ids).not.toContain(body.id);
    }
  });
});

/**
 * Party create / list / read / update, optimistic concurrency, idempotency.
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

describe("POST /api/v1/parties", () => {
  it("creates a party and emits a ContactCreated event", async () => {
    const partyId = `pty_${uuid()}`;
    const res = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name: "Ramesh Traders", phone: "9000000123" },
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(partyId);
    expect(res.body.version).toBe(1);
    expect(res.headers.etag).toBe('"1"');
    expect(res.headers.location).toBe(`/api/v1/parties/${partyId}`);

    // A REST write must be indistinguishable from a device write in the log.
    const { rows } = await h.pool.query(
      `SELECT type, aggregate_id FROM events
        WHERE merchant_id = $1 AND aggregate_id = $2`,
      [h.seeded.alpha.merchantId, partyId]
    );
    expect(rows).toEqual([{ type: "ContactCreated", aggregate_id: partyId }]);
  });

  it("reports no position for a party with no entries", async () => {
    const partyId = `pty_${uuid()}`;
    const res = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name: "Fresh Contact" },
    });
    expect(res.body.balance).toMatchObject({ net: 0, position: "no_entries", entryCount: 0 });
  });

  it("requires an Idempotency-Key", async () => {
    const res = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      payload: { id: `pty_${uuid()}`, name: "No Key" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects a body that names a merchant", async () => {
    const res = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: {
        id: `pty_${uuid()}`,
        name: "Sneaky",
        merchantId: h.seeded.beta.merchantId,
      },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.some((d: { code: string }) => d.code === "NOT_ALLOWED")).toBe(
      true
    );
  });

  it("rejects a duplicate party id", async () => {
    const partyId = `pty_${uuid()}`;
    const first = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name: "First" },
    });
    expect(first.status).toBe(201);

    const second = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name: "Second" },
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("RESOURCE_ALREADY_EXISTS");
  });
});

describe("Idempotency-Key replay", () => {
  it("returns the original result for an identical retry", async () => {
    const key = uuid();
    const partyId = `pty_${uuid()}`;
    const payload = { id: partyId, name: "Retry Safe" };

    const first = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": key },
      payload,
    });
    const replay = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": key },
      payload,
    });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);

    // Exactly one party, and exactly one event — the retry created nothing.
    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM events WHERE merchant_id = $1 AND aggregate_id = $2`,
      [h.seeded.alpha.merchantId, partyId]
    );
    expect(rows[0].n).toBe(1);
  });

  it("rejects the same key with a different body", async () => {
    const key = uuid();
    await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": key },
      payload: { id: `pty_${uuid()}`, name: "Original" },
    });

    const res = await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": key },
      payload: { id: `pty_${uuid()}`, name: "Different" },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("GET /api/v1/parties", () => {
  it("lists seeded parties with derived balances", async () => {
    const res = await call(h.app, "GET", "/api/v1/parties", { token: token() });
    expect(res.status).toBe(200);

    const seeded = res.body.items.filter((p: { id: string }) =>
      (h.seeded.alpha.partyIds as readonly string[]).includes(p.id)
    );
    expect(seeded).toHaveLength(3);
    for (const party of seeded) {
      expect(party.balance.entryCount).toBeGreaterThan(0);
      expect(party).not.toHaveProperty("role");
    }
  });

  it("filters by derived position in both directions", async () => {
    const owing = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { position: "owes_merchant" },
    });
    const owed = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { position: "merchant_owes" },
    });

    // The same schema produces both — which is the point of not storing a role.
    expect(owing.body.items.length).toBeGreaterThan(0);
    expect(owed.body.items.length).toBeGreaterThan(0);
    for (const p of owing.body.items) expect(p.balance.net).toBeGreaterThan(0);
    for (const p of owed.body.items) expect(p.balance.net).toBeLessThan(0);
  });

  it("paginates by cursor without repeating or skipping", async () => {
    const first = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { limit: 2 },
    });
    expect(first.body.items).toHaveLength(2);
    expect(first.body.page.hasMore).toBe(true);

    const second = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { limit: 2, cursor: first.body.page.nextCursor },
    });

    const firstIds = first.body.items.map((p: { id: string }) => p.id);
    const secondIds = second.body.items.map((p: { id: string }) => p.id);
    expect(firstIds.filter((id: string) => secondIds.includes(id))).toEqual([]);
  });

  it("rejects an out-of-range limit and an unknown position", async () => {
    const bad = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { limit: 500 },
    });
    expect(bad.status).toBe(400);

    const worse = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { position: "customer" },
    });
    expect(worse.status).toBe(400);
  });
});

describe("PATCH /api/v1/parties/{partyId}", () => {
  async function freshParty(name = "Editable"): Promise<string> {
    const partyId = `pty_${uuid()}`;
    await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name },
    });
    return partyId;
  }

  it("updates and bumps the version and ETag", async () => {
    const partyId = await freshParty();
    const res = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { name: "Renamed" },
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed");
    expect(res.body.version).toBe(2);
    expect(res.headers.etag).toBe('"2"');
  });

  it("clears an optional field with an explicit null", async () => {
    const partyId = `pty_${uuid()}`;
    await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name: "Has Phone", phone: "9000000999" },
    });

    const res = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { phone: null },
    });
    expect(res.body.phone).toBeNull();
  });

  it("leaves an omitted field untouched", async () => {
    const partyId = `pty_${uuid()}`;
    await call(h.app, "POST", "/api/v1/parties", {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { id: partyId, name: "Keep Note", note: "regular customer" },
    });

    const res = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { name: "Keep Note Renamed" },
    });
    expect(res.body.note).toBe("regular customer");
  });

  it("requires If-Match", async () => {
    const partyId = await freshParty();
    const res = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "idempotency-key": uuid() },
      payload: { name: "No Precondition" },
    });
    expect(res.status).toBe(428);
    expect(res.body.error.code).toBe("PRECONDITION_REQUIRED");
  });

  it("rejects a stale If-Match without applying the change", async () => {
    const partyId = await freshParty();
    await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { name: "First Writer" },
    });

    const stale = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { name: "Second Writer" },
    });

    expect(stale.status).toBe(412);
    expect(stale.body.error.code).toBe("VERSION_CONFLICT");

    // The first writer's change survives — the whole point of the precondition.
    const after = await call(h.app, "GET", `/api/v1/parties/${partyId}`, { token: token() });
    expect(after.body.name).toBe("First Writer");
  });

  it("rejects an attempt to write a read-only field", async () => {
    const partyId = await freshParty();
    const res = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { version: 99 },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.some((d: { code: string }) => d.code === "NOT_ALLOWED")).toBe(
      true
    );
  });

  it("emits a ContactUpdated event rather than mutating in place", async () => {
    const partyId = await freshParty();
    await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: token(),
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { name: "Event Backed" },
    });

    const { rows } = await h.pool.query<{ type: string }>(
      `SELECT type FROM events WHERE merchant_id = $1 AND aggregate_id = $2
        ORDER BY recorded_at ASC`,
      [h.seeded.alpha.merchantId, partyId]
    );
    expect(rows.map((r) => r.type)).toEqual(["ContactCreated", "ContactUpdated"]);
  });
});

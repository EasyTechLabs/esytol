/**
 * Two-workspace tenant isolation.
 *
 * The contract audit proved no *request* can carry a merchantId. That does not
 * prove the implementation scopes its queries — a missing WHERE clause is
 * invisible to a schema check. These tests are what closes that gap: every read
 * is attempted with the other workspace's credentials and must fail.
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

describe("workspaces are independent", () => {
  it("each caller sees only its own merchant", async () => {
    const a = await call(h.app, "GET", "/api/v1/me", { token: h.seeded.alpha.token });
    const b = await call(h.app, "GET", "/api/v1/me", { token: h.seeded.beta.token });

    expect(a.body.merchant.merchantId).toBe(h.seeded.alpha.merchantId);
    expect(b.body.merchant.merchantId).toBe(h.seeded.beta.merchantId);
    expect(a.body.merchant.merchantId).not.toBe(b.body.merchant.merchantId);
  });

  it("party lists do not overlap", async () => {
    const a = await call(h.app, "GET", "/api/v1/parties", { token: h.seeded.alpha.token });
    const b = await call(h.app, "GET", "/api/v1/parties", { token: h.seeded.beta.token });

    const aIds = a.body.items.map((p: { id: string }) => p.id);
    const bIds = b.body.items.map((p: { id: string }) => p.id);

    expect(aIds).toHaveLength(h.seeded.alpha.partyIds.length);
    expect(bIds).toHaveLength(h.seeded.beta.partyIds.length);
    expect(aIds.filter((id: string) => bIds.includes(id))).toEqual([]);
  });
});

describe("cross-tenant party lookup returns 404", () => {
  it("beta cannot read an alpha party", async () => {
    const partyId = h.seeded.alpha.partyIds[0]!;

    const owner = await call(h.app, "GET", `/api/v1/parties/${partyId}`, {
      token: h.seeded.alpha.token,
    });
    expect(owner.status).toBe(200);

    const intruder = await call(h.app, "GET", `/api/v1/parties/${partyId}`, {
      token: h.seeded.beta.token,
    });
    // 404, never 403 — a 403 would confirm the resource exists, which is itself
    // a cross-tenant disclosure.
    expect(intruder.status).toBe(404);
    expect(intruder.body.error.code).toBe("NOT_FOUND");
  });

  it("returns the same 404 for a party that exists nowhere", async () => {
    const real = h.seeded.alpha.partyIds[0]!;
    const fake = "pty_00000000-0000-4000-8000-000000000000";

    const crossTenant = await call(h.app, "GET", `/api/v1/parties/${real}`, {
      token: h.seeded.beta.token,
    });
    const nonExistent = await call(h.app, "GET", `/api/v1/parties/${fake}`, {
      token: h.seeded.beta.token,
    });

    expect(crossTenant.status).toBe(nonExistent.status);
    expect(crossTenant.body.error.code).toBe(nonExistent.body.error.code);
  });

  it("beta cannot patch an alpha party", async () => {
    const partyId = h.seeded.alpha.partyIds[0]!;
    const res = await call(h.app, "PATCH", `/api/v1/parties/${partyId}`, {
      token: h.seeded.beta.token,
      headers: { "if-match": '"1"', "idempotency-key": uuid() },
      payload: { name: "hijacked" },
    });
    expect(res.status).toBe(404);

    // And the original is untouched.
    const after = await call(h.app, "GET", `/api/v1/parties/${partyId}`, {
      token: h.seeded.alpha.token,
    });
    expect(after.body.name).not.toBe("hijacked");
  });
});

describe("events are scoped to a workspace", () => {
  it("beta's pull never returns alpha's events", async () => {
    const res = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: h.seeded.beta.token,
      query: { deviceId: h.seeded.beta.secondDeviceId, limit: 200 },
    });

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);

    const alphaParties = new Set(h.seeded.alpha.partyIds);
    for (const event of res.body.events) {
      expect(alphaParties.has(event.aggregateId)).toBe(false);
      expect(event.deviceId).not.toBe(h.seeded.alpha.deviceId);
    }
  });

  it("an event pushed by beta is invisible to alpha", async () => {
    const eventId = `evt_${uuid()}`;
    const partyId = `pty_${uuid()}`;

    const push = await call(h.app, "POST", "/api/v1/sync/push", {
      token: h.seeded.beta.token,
      headers: { "idempotency-key": uuid() },
      payload: {
        deviceId: h.seeded.beta.secondDeviceId,
        schemaVersion: 1,
        events: [
          {
            eventId,
            type: "ContactCreated",
            aggregateId: partyId,
            payloadVersion: 1,
            occurredAt: "2026-08-01T10:00:00.000Z",
            payload: {
              party: {
                id: partyId,
                name: "beta only",
                phone: null,
                note: null,
                createdAt: "2026-08-01T10:00:00.000Z",
              },
            },
          },
        ],
      },
    });
    expect(push.body.accepted).toHaveLength(1);

    const alphaPull = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: h.seeded.alpha.token,
      query: { deviceId: h.seeded.alpha.secondDeviceId, limit: 200 },
    });
    expect(alphaPull.body.events.map((e: { eventId: string }) => e.eventId)).not.toContain(eventId);

    const alphaRead = await call(h.app, "GET", `/api/v1/parties/${partyId}`, {
      token: h.seeded.alpha.token,
    });
    expect(alphaRead.status).toBe(404);
  });

  it("the same eventId can exist independently in both workspaces", async () => {
    // Deduplication is keyed on (merchantId, eventId). If it were global, one
    // workspace could suppress another's event and the loss would be silent.
    const eventId = `evt_${uuid()}`;
    const occurredAt = "2026-08-02T10:00:00.000Z";

    const build = (partyId: string) => ({
      deviceId: undefined as unknown as string,
      schemaVersion: 1,
      events: [
        {
          eventId,
          type: "ContactCreated",
          aggregateId: partyId,
          payloadVersion: 1,
          occurredAt,
          payload: {
            party: {
              id: partyId,
              name: "shared id",
              phone: null,
              note: null,
              createdAt: occurredAt,
            },
          },
        },
      ],
    });

    const aParty = `pty_${uuid()}`;
    const bParty = `pty_${uuid()}`;

    const a = await call(h.app, "POST", "/api/v1/sync/push", {
      token: h.seeded.alpha.token,
      headers: { "idempotency-key": uuid() },
      payload: { ...build(aParty), deviceId: h.seeded.alpha.secondDeviceId },
    });
    const b = await call(h.app, "POST", "/api/v1/sync/push", {
      token: h.seeded.beta.token,
      headers: { "idempotency-key": uuid() },
      payload: { ...build(bParty), deviceId: h.seeded.beta.secondDeviceId },
    });

    expect(a.body.accepted).toHaveLength(1);
    expect(b.body.accepted).toHaveLength(1);
    expect(b.body.duplicate).toHaveLength(0);
  });

  it("scopes idempotency keys per merchant", async () => {
    const key = uuid();
    const body = (partyId: string) => ({ id: partyId, name: "same key different workspace" });

    const aParty = `pty_${uuid()}`;
    const bParty = `pty_${uuid()}`;

    const a = await call(h.app, "POST", "/api/v1/parties", {
      token: h.seeded.alpha.token,
      headers: { "idempotency-key": key },
      payload: body(aParty),
    });
    const b = await call(h.app, "POST", "/api/v1/parties", {
      token: h.seeded.beta.token,
      headers: { "idempotency-key": key },
      payload: body(bParty),
    });

    // Global key scoping would make beta's create collide with alpha's and leak
    // the existence of another workspace's request.
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.id).toBe(bParty);
  });
});

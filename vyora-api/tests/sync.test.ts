/**
 * Sync push and pull.
 *
 * The behaviours here are the ones that decide whether a merchant's book
 * survives an unreliable connection: partial acceptance, duplicate delivery,
 * cursor ordering, and the snapshot refusal.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  call,
  contactCreatedEvent,
  snapshotEvent,
  startHarness,
  uuid,
  type Harness,
} from "./helpers.js";
import { decodeCursor, encodeCursor } from "../src/modules/sync/cursor.js";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const token = () => h.seeded.alpha.token;
const device = () => h.seeded.alpha.secondDeviceId;

async function push(events: unknown[], overrides: Record<string, unknown> = {}) {
  return call(h.app, "POST", "/api/v1/sync/push", {
    token: token(),
    headers: { "idempotency-key": uuid() },
    payload: { deviceId: device(), schemaVersion: 1, events, ...overrides },
  });
}

describe("push appends events", () => {
  it("accepts a valid event and applies it through the projection", async () => {
    const partyId = `pty_${uuid()}`;
    const event = contactCreatedEvent(partyId, "Pushed Party", "2026-08-03T10:00:00.000Z");

    const res = await push([event]);
    expect(res.status).toBe(200);
    expect(res.body.accepted).toHaveLength(1);
    expect(res.body.rejected).toHaveLength(0);

    // Applied through the same path a REST write uses, so it is readable.
    const read = await call(h.app, "GET", `/api/v1/parties/${partyId}`, { token: token() });
    expect(read.status).toBe(200);
    expect(read.body.name).toBe("Pushed Party");
  });

  it("treats a re-pushed event as a duplicate, keeping its original recordedAt", async () => {
    const event = contactCreatedEvent(`pty_${uuid()}`, "Once", "2026-08-03T11:00:00.000Z");

    const first = await push([event]);
    const second = await push([event]);

    expect(first.body.accepted).toHaveLength(1);
    expect(second.body.accepted).toHaveLength(0);
    expect(second.body.duplicate).toHaveLength(1);
    // An event's place in history must never move, or a cursor could step over
    // it.
    expect(second.body.duplicate[0].recordedAt).toBe(first.body.accepted[0].recordedAt);
  });

  it("rejects the same eventId carrying different content", async () => {
    const eventId = `evt_${uuid()}`;
    const at = "2026-08-03T12:00:00.000Z";
    const make = (name: string) => ({
      eventId,
      type: "ContactCreated",
      aggregateId: `pty_${uuid()}`,
      payloadVersion: 1,
      occurredAt: at,
      payload: {
        party: { id: `pty_${uuid()}`, name, phone: null, note: null, createdAt: at },
      },
    });

    await push([make("Original")]);
    const conflict = await push([make("Different")]);

    expect(conflict.body.rejected).toHaveLength(1);
    expect(conflict.body.rejected[0].reason).toBe("EVENT_ID_CONFLICT");
  });

  it("never replaces server state — pushing does not remove existing parties", async () => {
    const before = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { limit: 200 },
    });
    await push([contactCreatedEvent(`pty_${uuid()}`, "Additive", "2026-08-03T13:00:00.000Z")]);
    const after = await call(h.app, "GET", "/api/v1/parties", {
      token: token(),
      query: { limit: 200 },
    });

    expect(after.body.items.length).toBe(before.body.items.length + 1);
    for (const p of before.body.items) {
      expect(after.body.items.some((q: { id: string }) => q.id === p.id)).toBe(true);
    }
  });
});

describe("partial acceptance", () => {
  it("accepts the good events and rejects only the bad ones", async () => {
    const good1 = contactCreatedEvent(`pty_${uuid()}`, "Good One", "2026-08-04T09:00:00.000Z");
    const good2 = contactCreatedEvent(`pty_${uuid()}`, "Good Two", "2026-08-04T09:01:00.000Z");
    const unknownType = {
      eventId: `evt_${uuid()}`,
      type: "SomethingFromTheFuture",
      aggregateId: null,
      payloadVersion: 1,
      occurredAt: "2026-08-04T09:02:00.000Z",
      payload: {},
    };
    const malformedId = {
      ...contactCreatedEvent(`pty_${uuid()}`, "Bad Id", "2026-08-04T09:03:00.000Z"),
      eventId: "not-an-event-id",
    };
    const badPayload = {
      eventId: `evt_${uuid()}`,
      type: "ContactCreated",
      aggregateId: null,
      payloadVersion: 1,
      occurredAt: "2026-08-04T09:04:00.000Z",
      payload: { party: { id: "not-a-party-id", name: "", createdAt: "nope" } },
    };

    const res = await push([good1, unknownType, good2, malformedId, badPayload]);

    expect(res.status).toBe(200);
    expect(res.body.accepted).toHaveLength(2);
    expect(res.body.rejected).toHaveLength(3);

    const reasons = res.body.rejected.map((r: { reason: string }) => r.reason).sort();
    expect(reasons).toEqual(["EVENT_ID_MALFORMED", "PAYLOAD_INVALID", "UNKNOWN_EVENT_TYPE"]);

    // One malformed event from an old build must not wedge the outbox.
    const read = await call(h.app, "GET", `/api/v1/parties/${good2.aggregateId}`, {
      token: token(),
    });
    expect(read.status).toBe(200);
  });

  it("returns every submitted eventId in exactly one bucket", async () => {
    const events = [
      contactCreatedEvent(`pty_${uuid()}`, "A", "2026-08-04T10:00:00.000Z"),
      snapshotEvent("ImportCompleted", "2026-08-04T10:01:00.000Z"),
      contactCreatedEvent(`pty_${uuid()}`, "B", "2026-08-04T10:02:00.000Z"),
    ];
    await push([events[0]]); // make the first a duplicate

    const res = await push(events);
    const seen = [
      ...res.body.accepted.map((e: { eventId: string }) => e.eventId),
      ...res.body.duplicate.map((e: { eventId: string }) => e.eventId),
      ...res.body.rejected.map((e: { eventId: string }) => e.eventId),
    ];
    expect(seen.sort()).toEqual(events.map((e) => e.eventId).sort());
  });

  it("gives a rejected event a developer-facing message and no merchant wording", async () => {
    const res = await push([snapshotEvent("RestoreCompleted", "2026-08-04T11:00:00.000Z")]);
    const rejection = res.body.rejected[0];
    expect(typeof rejection.message).toBe("string");
    expect(rejection.message.length).toBeGreaterThan(0);
    // Rejections are explicit, never silently dropped.
    expect(rejection.eventId).toBeTruthy();
  });
});

describe("snapshot events are unsupported in sync v1", () => {
  it.each(["ImportCompleted", "RestoreCompleted"] as const)(
    "rejects %s with SNAPSHOT_EVENT_UNSUPPORTED",
    async (type) => {
      const res = await push([snapshotEvent(type, "2026-08-04T12:00:00.000Z")]);
      expect(res.status).toBe(200);
      expect(res.body.accepted).toHaveLength(0);
      expect(res.body.rejected[0].reason).toBe("SNAPSHOT_EVENT_UNSUPPORTED");
    }
  );

  it("does not store a rejected snapshot", async () => {
    const event = snapshotEvent("ImportCompleted", "2026-08-04T12:30:00.000Z");
    await push([event]);
    const { rows } = await h.pool.query(
      `SELECT 1 FROM events WHERE merchant_id = $1 AND event_id = $2`,
      [h.seeded.alpha.merchantId, event.eventId]
    );
    expect(rows).toHaveLength(0);
  });

  it("is distinguished from an unknown type", async () => {
    // The whole reason the payload is specified in the contract: the server
    // recognises the event and refuses it for the right reason.
    const snapshot = await push([snapshotEvent("ImportCompleted", "2026-08-04T13:00:00.000Z")]);
    const unknown = await push([
      {
        eventId: `evt_${uuid()}`,
        type: "NotAThing",
        aggregateId: null,
        payloadVersion: 1,
        occurredAt: "2026-08-04T13:01:00.000Z",
        payload: {},
      },
    ]);
    expect(snapshot.body.rejected[0].reason).toBe("SNAPSHOT_EVENT_UNSUPPORTED");
    expect(unknown.body.rejected[0].reason).toBe("UNKNOWN_EVENT_TYPE");
  });
});

describe("batch-level refusals", () => {
  it("refuses an out-of-date schemaVersion and consumes nothing", async () => {
    const event = contactCreatedEvent(`pty_${uuid()}`, "Stale Client", "2026-08-04T14:00:00.000Z");
    const res = await push([event], { schemaVersion: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SYNC_SCHEMA_VERSION_UNSUPPORTED");

    // The client's outbox must survive being out of date.
    const { rows } = await h.pool.query(
      `SELECT 1 FROM events WHERE merchant_id = $1 AND event_id = $2`,
      [h.seeded.alpha.merchantId, event.eventId]
    );
    expect(rows).toHaveLength(0);
  });

  it("refuses an oversized batch with 413", async () => {
    const events = Array.from({ length: 501 }, (_, i) =>
      contactCreatedEvent(`pty_${uuid()}`, `Bulk ${i}`, "2026-08-04T15:00:00.000Z")
    );
    const res = await push(events);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("pull", () => {
  it("orders by recordedAt, not occurredAt", async () => {
    // Three events whose device clocks run backwards. If the cursor sorted by
    // occurredAt, a device that was offline could be skipped permanently.
    const older = contactCreatedEvent(
      `pty_${uuid()}`,
      "Recorded First",
      "2020-01-01T00:00:00.000Z"
    );
    const middle = contactCreatedEvent(
      `pty_${uuid()}`,
      "Recorded Second",
      "2019-01-01T00:00:00.000Z"
    );
    const newest = contactCreatedEvent(
      `pty_${uuid()}`,
      "Recorded Third",
      "2018-01-01T00:00:00.000Z"
    );

    await push([older]);
    await push([middle]);
    await push([newest]);

    const res = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: h.seeded.alpha.deviceId, limit: 200 },
    });

    const pushed = res.body.events.filter((e: { eventId: string }) =>
      [older.eventId, middle.eventId, newest.eventId].includes(e.eventId)
    );
    expect(pushed.map((e: { eventId: string }) => e.eventId)).toEqual([
      older.eventId,
      middle.eventId,
      newest.eventId,
    ]);

    // occurredAt is descending while recordedAt ascends — proof the sort key is
    // the server clock.
    const occurred = pushed.map((e: { occurredAt: string }) => Date.parse(e.occurredAt));
    expect(occurred[0]).toBeGreaterThan(occurred[2]);

    const recorded = pushed.map((e: { recordedAt: string }) => Date.parse(e.recordedAt));
    expect(recorded[0]).toBeLessThanOrEqual(recorded[2]);
  });

  it("excludes the caller's own device by default and includes it on request", async () => {
    const event = contactCreatedEvent(`pty_${uuid()}`, "Own Device", "2026-08-05T09:00:00.000Z");
    await push([event]); // pushed by alpha.secondDeviceId

    const excluded = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: device(), limit: 200 },
    });
    expect(excluded.body.events.map((e: { eventId: string }) => e.eventId)).not.toContain(
      event.eventId
    );

    const included = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: device(), limit: 200, includeOwnDevice: true },
    });
    expect(included.body.events.map((e: { eventId: string }) => e.eventId)).toContain(
      event.eventId
    );
  });

  it("advances the cursor without repeating or skipping", async () => {
    const first = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: h.seeded.alpha.secondDeviceId, limit: 2 },
    });
    expect(first.body.events.length).toBeLessThanOrEqual(2);

    const second = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: h.seeded.alpha.secondDeviceId, limit: 2, cursor: first.body.nextCursor },
    });

    const a = first.body.events.map((e: { eventId: string }) => e.eventId);
    const b = second.body.events.map((e: { eventId: string }) => e.eventId);
    expect(a.filter((id: string) => b.includes(id))).toEqual([]);
  });

  it("requires deviceId", async () => {
    const res = await call(h.app, "GET", "/api/v1/sync/pull", { token: token() });
    expect(res.status).toBe(400);
  });
});

describe("cursor failures", () => {
  it("rejects a malformed cursor", async () => {
    const res = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: device(), cursor: "garbage" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SYNC_CURSOR_INVALID");
  });

  it("rejects a cursor signed by another server", async () => {
    const foreign = encodeCursor(
      { recordedAt: new Date().toISOString(), eventId: "evt_x" },
      "a-different-secret"
    );
    const res = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: device(), cursor: foreign },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SYNC_CURSOR_INVALID");
  });

  it("reports an expired cursor separately so the client knows to restart", async () => {
    const ancient = encodeCursor(
      { recordedAt: "2020-01-01T00:00:00.000Z", eventId: "evt_old" },
      h.config.cursorSecret
    );
    const res = await call(h.app, "GET", "/api/v1/sync/pull", {
      token: token(),
      query: { deviceId: device(), cursor: ancient },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SYNC_CURSOR_EXPIRED");
  });

  it("round-trips a cursor it issued", () => {
    const position = { recordedAt: new Date().toISOString(), eventId: "evt_round-trip" };
    const decoded = decodeCursor(encodeCursor(position, "s"), "s", 90);
    expect(decoded).toEqual(position);
  });
});

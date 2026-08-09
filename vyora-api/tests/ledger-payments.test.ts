/**
 * Payments and the ledger summary.
 *
 * A payment is the same kind of thing as a credit — an immutable event that
 * moves a derived position — so the assertions mirror the credit ones rather
 * than inventing a second standard. What is specific to payments is what they
 * deliberately do *not* do: settle a nominated entry, refuse to go past zero,
 * or get netted at rest.
 *
 * Every test here creates its own party. These files share one database, and a
 * total asserted against a party another test also writes to is a total that
 * passes until someone adds a case above it.
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

/** A party nobody else touches, so totals mean what they say. */
async function freshParty(name = "Payments Test"): Promise<string> {
  const id = `pty_${uuid()}`;
  const res = await call(h.app, "POST", "/api/v1/parties", {
    token: token(),
    headers: { "idempotency-key": uuid() },
    payload: { id, name: `${name} ${id.slice(4, 12)}` },
  });
  expect(res.status).toBe(201);
  return id;
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: `pay_${uuid()}`,
    amount: 500,
    kind: "received",
    note: "part payment",
    date: "2026-08-09",
    ...overrides,
  };
}

function credit(overrides: Record<string, unknown> = {}) {
  return {
    id: `txn_${uuid()}`,
    amount: 2000,
    kind: "given",
    description: "opening credit",
    date: "2026-08-01",
    ...overrides,
  };
}

const pay = (party: string, body: Record<string, unknown>, key = uuid()) =>
  call(h.app, "POST", `/api/v1/parties/${party}/payments`, {
    token: token(),
    headers: { "idempotency-key": key },
    payload: body,
  });

const give = (party: string, body: Record<string, unknown>, key = uuid()) =>
  call(h.app, "POST", `/api/v1/parties/${party}/credits`, {
    token: token(),
    headers: { "idempotency-key": key },
    payload: body,
  });

describe("recording a payment appends an immutable event", () => {
  it("returns the stored entry, typed as a payment", async () => {
    const party = await freshParty();
    const body = payment();
    const res = await pay(party, body);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(body.id);
    expect(res.body.entryType).toBe("payment");
    expect(res.body.direction).toBe("received");
    expect(res.body.amount).toBe(500);
    expect(res.body.eventId).toMatch(/^evt_/);
    expect(res.body.date).toBe("2026-08-09");
    // A payment has nothing falling due.
    expect(res.body.dueDate).toBeNull();
  });

  it("writes a PaymentRecorded event carrying the note", async () => {
    const party = await freshParty();
    const body = payment({ note: "cash at shop" });
    await pay(party, body);

    const { rows } = await h.pool.query<{
      type: string;
      aggregate_id: string;
      payload: { payment: { note: string | null } };
    }>(
      `SELECT type, aggregate_id, payload FROM events
        WHERE merchant_id = $1 AND payload->'payment'->>'id' = $2`,
      [h.seeded.alpha.merchantId, body.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("PaymentRecorded");
    expect(rows[0]!.aggregate_id).toBe(party);
    // `note` on the wire and `note` in the event — renaming it in transit
    // would make the local and server records look like different things.
    expect(rows[0]!.payload.payment.note).toBe("cash at shop");
  });

  it("requires an Idempotency-Key", async () => {
    const party = await freshParty();
    const res = await call(h.app, "POST", `/api/v1/parties/${party}/payments`, {
      token: token(),
      payload: payment(),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a body that names a merchant", async () => {
    const party = await freshParty();
    const res = await pay(party, { ...payment(), merchantId: h.seeded.beta.merchantId });
    expect(res.status).toBe(422);
  });

  it("rejects a payment kind that is really a credit direction", async () => {
    // `given`/`taken` are credit directions. Accepting one here would put an
    // entry in the log whose type and direction disagree.
    const party = await freshParty();
    const res = await pay(party, payment({ kind: "given" }));
    expect(res.status).toBe(422);
  });

  it("404s for a party that is not in this workspace", async () => {
    const res = await pay("pty_00000000-0000-4000-8000-000000000000", payment());
    expect(res.status).toBe(404);
  });
});

describe("duplicate handling keeps the payment log immutable", () => {
  it("an identical replay returns the original response verbatim and adds no second event", async () => {
    const party = await freshParty();
    const body = payment();
    const key = uuid();

    const first = await pay(party, body, key);
    const second = await pay(party, body, key);

    // Status included. A retry distinguishable from the original is not
    // idempotent — the client that lost the first response must not have to
    // care which of its two attempts did the work.
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);

    const { rows } = await h.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM events
        WHERE merchant_id = $1 AND payload->'payment'->>'id' = $2`,
      [h.seeded.alpha.merchantId, body.id]
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it("the same entry id with different content is refused, never overwritten", async () => {
    const party = await freshParty();
    const body = payment({ amount: 500 });
    await pay(party, body);

    const conflicting = await pay(party, { ...body, amount: 900 });
    expect(conflicting.status).toBe(409);

    const { rows } = await h.pool.query<{ amount: number }>(
      `SELECT amount FROM entry_projection WHERE merchant_id = $1 AND entry_id = $2`,
      [h.seeded.alpha.merchantId, body.id]
    );
    expect(rows[0]!.amount).toBe(500);
  });

  it("a payment cannot reuse a credit's entry id", async () => {
    // Entry ids are unique across both kinds. Letting a payment land on a
    // credit's id would replace one kind of entry with the other.
    const party = await freshParty();
    const c = credit();
    await give(party, c);

    const res = await pay(party, payment({ id: c.id }));
    expect(res.status).toBe(409);

    const { rows } = await h.pool.query<{ entry_type: string }>(
      `SELECT entry_type FROM entry_projection WHERE merchant_id = $1 AND entry_id = $2`,
      [h.seeded.alpha.merchantId, c.id]
    );
    expect(rows[0]!.entry_type).toBe("credit");
  });
});

describe("a payment moves the balance, and settles nothing in particular", () => {
  it("reduces what the party owes", async () => {
    const party = await freshParty();
    await give(party, credit({ amount: 2000 }));
    await pay(party, payment({ amount: 500 }));

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() });
    expect(res.body.balance.net).toBe(1500);
    expect(res.body.balance.position).toBe("owes_merchant");
    expect(res.body.balance.entryCount).toBe(2);
  });

  it("appears in the statement fold in the same order it was recorded", async () => {
    const party = await freshParty();
    await give(party, credit({ amount: 2000, date: "2026-08-01" }));
    await pay(party, payment({ amount: 500, date: "2026-08-05" }));
    await give(party, credit({ amount: 300, date: "2026-08-07" }));

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() });
    const rows = res.body.rows as Array<{
      entryType: string;
      signedAmount: number;
      runningNet: number;
      label: string;
    }>;

    expect(rows.map((r) => r.entryType)).toEqual(["credit", "payment", "credit"]);
    expect(rows.map((r) => r.runningNet)).toEqual([2000, 1500, 1800]);
    expect(rows[1]!.signedAmount).toBe(-500);
    expect(rows[1]!.label).toBe("Payment received");
  });

  it("inverts the position when the party overpays, rather than clamping at zero", async () => {
    // Refusing an over-payment would make the ledger disagree with what
    // physically happened at the counter.
    const party = await freshParty();
    await give(party, credit({ amount: 1000 }));
    const over = await pay(party, payment({ amount: 1600 }));
    expect(over.status).toBe(201);

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() });
    expect(res.body.balance.net).toBe(-600);
    expect(res.body.balance.position).toBe("merchant_owes");
  });

  it("signs a payment the merchant made in the opposite direction", async () => {
    const party = await freshParty();
    await give(party, credit({ amount: 1000, kind: "taken" }));
    await pay(party, payment({ amount: 400, kind: "paid" }));

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() });
    const rows = res.body.rows as Array<{ signedAmount: number; label: string }>;
    expect(rows[0]!.signedAmount).toBe(-1000);
    expect(rows[1]!.signedAmount).toBe(400);
    expect(rows[1]!.label).toBe("Payment made");
    expect(res.body.balance.net).toBe(-600);
  });

  it("stores no balance for a payment either", async () => {
    const { rows } = await h.pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%balance%'`
    );
    expect(rows).toEqual([]);
  });
});

describe("the ledger summary is the statement's arithmetic without its rows", () => {
  it("reports gross totals per direction alongside the one signed net", async () => {
    const party = await freshParty();
    await give(party, credit({ amount: 2000, kind: "given" }));
    await give(party, credit({ amount: 700, kind: "taken" }));
    await pay(party, payment({ amount: 500, kind: "received" }));
    await pay(party, payment({ amount: 200, kind: "paid" }));

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/summary`, { token: token() });
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      creditGiven: 2000,
      creditTaken: 700,
      paymentReceived: 500,
      paymentPaid: 200,
    });
    expect(res.body.counts).toEqual({ credits: 2, payments: 2 });
    // +2000 − 700 − 500 + 200
    expect(res.body.balance.net).toBe(1000);
    expect(res.body.balance.position).toBe("owes_merchant");
    expect(res.body.balance.entryCount).toBe(4);
  });

  it("agrees with the statement it summarises", async () => {
    const party = await freshParty();
    await give(party, credit({ amount: 3300 }));
    await pay(party, payment({ amount: 1100 }));
    await give(party, credit({ amount: 450, kind: "taken" }));

    const [summary, statement] = await Promise.all([
      call(h.app, "GET", `/api/v1/parties/${party}/summary`, { token: token() }),
      call(h.app, "GET", `/api/v1/parties/${party}/statement`, { token: token() }),
    ]);

    expect(summary.body.balance.net).toBe(statement.body.balance.net);
    expect(summary.body.balance.position).toBe(statement.body.balance.position);
    expect(summary.body.balance.entryCount).toBe(statement.body.balance.entryCount);
    // The last row's running total *is* the net — the fold has one definition.
    const rows = statement.body.rows as Array<{ runningNet: number }>;
    expect(rows[rows.length - 1]!.runningNet).toBe(summary.body.balance.net);
  });

  it("totals every entry, not just the first page the statement would return", async () => {
    // The statement takes a limit; a total over the first N entries is not a
    // total, so the summary must not inherit one.
    const party = await freshParty();
    for (let i = 0; i < 12; i += 1) {
      await give(party, credit({ amount: 100 }));
    }

    const limited = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, {
      token: token(),
      query: { limit: "5" },
    });
    const summary = await call(h.app, "GET", `/api/v1/parties/${party}/summary`, {
      token: token(),
    });

    expect((limited.body.rows as unknown[]).length).toBe(5);
    expect(limited.body.balance.net).toBe(500);
    expect(summary.body.balance.net).toBe(1200);
    expect(summary.body.counts.credits).toBe(12);
  });

  it("reports an empty relationship without pretending it has one", async () => {
    const party = await freshParty("Never Traded");
    const res = await call(h.app, "GET", `/api/v1/parties/${party}/summary`, { token: token() });

    expect(res.body.balance).toMatchObject({ net: 0, position: "no_entries", entryCount: 0 });
    expect(res.body.totals).toEqual({
      creditGiven: 0,
      creditTaken: 0,
      paymentReceived: 0,
      paymentPaid: 0,
    });
    expect(res.body.firstActivityAt).toBeNull();
    expect(res.body.balance.lastActivityAt).toBeNull();
  });

  it("dates the relationship from its first entry", async () => {
    const party = await freshParty();
    const first = await give(party, credit({ amount: 100 }));
    const last = await pay(party, payment({ amount: 40 }));

    const res = await call(h.app, "GET", `/api/v1/parties/${party}/summary`, { token: token() });
    expect(res.body.firstActivityAt).toBe(first.body.createdAt);
    expect(res.body.balance.lastActivityAt).toBe(last.body.createdAt);
  });
});

describe("cross-tenant isolation covers payments and summaries", () => {
  it("beta cannot record a payment against alpha's party", async () => {
    const res = await call(
      h.app,
      "POST",
      `/api/v1/parties/${h.seeded.alpha.partyIds[0]}/payments`,
      {
        token: h.seeded.beta.token,
        headers: { "idempotency-key": uuid() },
        payload: payment(),
      }
    );
    expect(res.status).toBe(404);
  });

  it("beta cannot read alpha's summary, and cannot tell it apart from nothing", async () => {
    const crossTenant = await call(
      h.app,
      "GET",
      `/api/v1/parties/${h.seeded.alpha.partyIds[0]}/summary`,
      { token: h.seeded.beta.token }
    );
    const nonExistent = await call(
      h.app,
      "GET",
      "/api/v1/parties/pty_00000000-0000-4000-8000-000000000000/summary",
      { token: h.seeded.beta.token }
    );
    expect(crossTenant.status).toBe(404);
    expect(crossTenant.status).toBe(nonExistent.status);
    expect(crossTenant.body.error.code).toBe(nonExistent.body.error.code);
  });

  it("a payment recorded by beta never reaches alpha's totals", async () => {
    const betaParty = h.seeded.beta.partyIds[0]!;
    const before = await call(h.app, "GET", `/api/v1/parties/${betaParty}/summary`, {
      token: h.seeded.beta.token,
    });

    const body = payment({ amount: 7777 });
    const made = await call(h.app, "POST", `/api/v1/parties/${betaParty}/payments`, {
      token: h.seeded.beta.token,
      headers: { "idempotency-key": uuid() },
      payload: body,
    });
    expect(made.status).toBe(201);

    const after = await call(h.app, "GET", `/api/v1/parties/${betaParty}/summary`, {
      token: h.seeded.beta.token,
    });
    expect(after.body.totals.paymentReceived).toBe(before.body.totals.paymentReceived + 7777);

    for (const party of h.seeded.alpha.partyIds) {
      const res = await call(h.app, "GET", `/api/v1/parties/${party}/statement`, {
        token: token(),
      });
      const ids = (res.body.rows as Array<{ id: string }>).map((r) => r.id);
      expect(ids).not.toContain(body.id);
    }
  });
});

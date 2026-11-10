/**
 * The UDHARPE pilot money paths, black-box, over HTTP to the running API.
 *
 * One shopkeeper (the emulator's persona) and one customer (the RMX3392's),
 * plus a stranger customer and a second shop to attack them with. Each stage
 * starts where the last one left the two of them, and every balance is a bare
 * whole-rupee literal: a hundredfold error reads 200000 instead of 2000.
 *
 * What this cannot prove, and does not claim to: a real camera, a real
 * liveness movement, a real QR scan through a lens. Those are the physical
 * checklist's.
 */

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  call,
  count,
  lit,
  netOf,
  openShop,
  outstandingFor,
  registerDevice,
  signIn,
  sql,
  sqlError,
  type Shop,
  type Who,
} from "./harness";

test.describe.configure({ mode: "serial" });

let shopkeeper: Who;
let customer: Who;
let stranger: Who;
let rival: Who;
let shop: Shop;
let rivalShop: Shop;
let partyId: string;
let relationshipId: string;

/** The ledger entry a finalised proposal became. */
const entryOf = (proposalId: string) =>
  sql(
    `SELECT ep.entry_id FROM proposals p JOIN entry_projection ep ON ep.event_id = p.final_event_id
      WHERE p.proposal_id = ${lit(proposalId)}`
  );

const credits = () =>
  count(
    `SELECT count(*) FROM events WHERE merchant_id = ${lit(shop.merchantId)} AND type = 'CreditRecorded'`
  );
const payments = () =>
  count(
    `SELECT count(*) FROM events WHERE merchant_id = ${lit(shop.merchantId)} AND type = 'PaymentRecorded'`
  );

async function propose(amount: number, key?: string) {
  return call(shopkeeper, "POST", "/api/v1/proposals", {
    shop,
    key,
    data: { partyId, type: "credit", amount },
  });
}

test.beforeAll(async () => {
  shopkeeper = await signIn("pilot-shopkeeper");
  await registerDevice(shopkeeper, "Device A — emulator");
  shop = await openShop(shopkeeper, `Pilot Kirana ${Date.now().toString(36)}`);
  customer = await signIn("pilot-customer");
  await registerDevice(customer, "Device B — RMX3392");
  stranger = await signIn("pilot-stranger");
  rival = await signIn("pilot-rival");
  await registerDevice(rival, "rival phone");
  rivalShop = await openShop(rival, `Rival Stores ${Date.now().toString(36)}`);
});

// ── B. Shop/customer relationship ────────────────────────────────────────────

test.describe("B. relationship by the shop's code", () => {
  test("B1 a malformed or unknown shop code is refused and creates nothing", async () => {
    const mine = () =>
      count(`SELECT count(*) FROM shop_relationships WHERE person_id = ${lit(customer.personId)}`);
    const before = mine();
    for (const shopPublicId of ["VYR-0000-00", "not-a-code", "vyora:shop/VYR-ZZZZ-ZZ"]) {
      const res = await call(customer, "POST", "/api/v1/relationships", { data: { shopPublicId } });
      expect(res.status, shopPublicId).toBeGreaterThanOrEqual(400);
      expect(res.status, shopPublicId).toBeLessThan(500);
    }
    expect(mine()).toBe(before);
  });

  test("B2 the customer's scan becomes a pending request; a second scan does not make a second", async () => {
    const asked = await call(customer, "POST", "/api/v1/relationships", {
      data: { shopPublicId: shop.shopId },
    });
    expect(asked.status).toBe(201);
    expect(asked.body.status).toBe("pending");
    relationshipId = asked.body.relationshipId;

    const again = await call(customer, "POST", "/api/v1/relationships", {
      data: { shopPublicId: shop.shopId },
    });
    expect([200, 201, 409]).toContain(again.status);
    expect(
      count(
        `SELECT count(*) FROM shop_relationships
          WHERE merchant_id = ${lit(shop.merchantId)} AND person_id = ${lit(customer.personId)}
            AND status IN ('pending','active')`
      )
    ).toBe(1);
  });

  test("B3 nobody but the shop can accept: not the asker, not a stranger, not another shop", async () => {
    const self = await call(customer, "POST", `/api/v1/relationships/${relationshipId}/accept`, {
      data: {},
    });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("WRONG_SIDE");

    const byStranger = await call(
      stranger,
      "POST",
      `/api/v1/relationships/${relationshipId}/accept`,
      { data: {} }
    );
    expect([403, 404]).toContain(byStranger.status);

    const byRival = await call(rival, "POST", `/api/v1/relationships/${relationshipId}/accept`, {
      shop: rivalShop,
      data: {},
    });
    expect([403, 404]).toContain(byRival.status);

    // A pending request is not consent: the customer still cannot send a list.
    const early = await call(customer, "POST", `/api/v1/shops/${shop.shopId}/quotes`, {
      data: { lines: [{ title: "Rice", quantity: 1 }] },
    });
    expect(early.status).toBe(404);
  });

  test("B4 the shop accepts; both sides see the other, and the contact is linked", async () => {
    const accepted = await call(
      shopkeeper,
      "POST",
      `/api/v1/relationships/${relationshipId}/accept`,
      {
        shop,
        data: {},
      }
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("active");

    const mine = await call(customer, "GET", "/api/v1/relationships");
    // The reused synthetic customer keeps earlier runs' shops; this run's is one of them.
    expect(mine.body.items).toContainEqual(
      expect.objectContaining({
        relationshipId,
        status: "active",
        shopPublicId: shop.shopId,
        displayName: shop.name,
      })
    );
    const theirs = await call(shopkeeper, "GET", "/api/v1/relationships", { shop });
    expect(theirs.body.items).toEqual([
      expect.objectContaining({ relationshipId, status: "active" }),
    ]);

    partyId = sql(
      `SELECT party_id FROM party_projection
        WHERE merchant_id = ${lit(shop.merchantId)} AND person_id = ${lit(customer.personId)} AND deleted = false`
    );
    expect(partyId).toMatch(/^pty_/);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(0);
  });
});

// ── C. Shopping list ─────────────────────────────────────────────────────────

async function pricedList(titles: string[], amounts: number[]) {
  const sent = await call(customer, "POST", `/api/v1/shops/${shop.shopId}/quotes`, {
    data: { lines: titles.map((title) => ({ title, quantity: 1 })) },
  });
  expect(sent.status).toBe(201);
  const priced = await call(shopkeeper, "POST", `/api/v1/quotes/${sent.body.quoteId}/revise`, {
    shop,
    data: {
      version: sent.body.version,
      lines: sent.body.lines.map(
        (l: { lineId: string; title: string; quantity: number }, i: number) => ({
          lineId: l.lineId,
          title: l.title,
          quantity: l.quantity,
          amount: amounts[i],
        })
      ),
    },
  });
  expect(priced.status).toBe(200);
  return priced.body as { quoteId: string; version: number; total: number };
}

test.describe("C. shopping list", () => {
  test("C1 sent, priced, agreed and paid in full at the counter: no credit, no balance", async () => {
    const list = await pricedList(["Sugar"], [300]);
    const shopSees = await call(shopkeeper, "GET", "/api/v1/quotes", { shop });
    expect(shopSees.body.items.map((q: { quoteId: string }) => q.quoteId)).toContain(list.quoteId);

    expect(
      (
        await call(customer, "POST", `/api/v1/quotes/${list.quoteId}/agree`, {
          data: { version: 2 },
        })
      ).status
    ).toBe(200);
    const settled = await call(customer, "POST", `/api/v1/quotes/${list.quoteId}/settle`, {
      data: { version: 2, method: "upi" },
    });
    expect(settled.status).toBe(200);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(0);
  });

  test("C2 part paid: ₹700 now, ₹2,000 asked on credit, owed only once the customer agrees", async () => {
    const list = await pricedList(["Rice", "Oil"], [2400, 300]);
    expect(list.total).toBe(2700);
    expect(
      (
        await call(customer, "POST", `/api/v1/quotes/${list.quoteId}/agree`, {
          data: { version: 2 },
        })
      ).status
    ).toBe(200);

    const key = randomUUID();
    const part = await call(shopkeeper, "POST", `/api/v1/quotes/${list.quoteId}/part-pay`, {
      shop,
      key,
      data: { version: 2, paidNow: 700, method: "cash" },
    });
    expect(part.status).toBe(200);
    const replay = await call(shopkeeper, "POST", `/api/v1/quotes/${list.quoteId}/part-pay`, {
      shop,
      key,
      data: { version: 2, paidNow: 700, method: "cash" },
    });
    expect(replay.status).toBe(200);
    expect(replay.body.creditProposalId).toBe(part.body.creditProposalId);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(0);

    const both = await call(customer, "GET", "/api/v1/my/quotes");
    expect(
      both.body.items.find((q: { quoteId: string }) => q.quoteId === list.quoteId)?.status
    ).toBe("credited");

    const ok = await call(
      customer,
      "POST",
      `/api/v1/proposals/${part.body.creditProposalId}/accept`,
      { data: { version: 1 } }
    );
    expect(ok.status).toBe(200);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2000);
    expect(await outstandingFor(customer, shop)).toBe(2000);
  });

  test("C3 a part payment of nothing, everything or paise is refused", async () => {
    const list = await pricedList(["Dal"], [500]);
    await call(customer, "POST", `/api/v1/quotes/${list.quoteId}/agree`, { data: { version: 2 } });
    for (const paidNow of [0, 500, 501, 100.5]) {
      const res = await call(shopkeeper, "POST", `/api/v1/quotes/${list.quoteId}/part-pay`, {
        shop,
        data: { version: 2, paidNow, method: "cash" },
      });
      expect(res.status, String(paidNow)).toBeGreaterThanOrEqual(400);
      expect(res.status, String(paidNow)).toBeLessThan(500);
    }
    await call(customer, "POST", `/api/v1/quotes/${list.quoteId}/cancel`, { data: { version: 2 } });
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2000);
  });
});

// ── D. Credit ledger ─────────────────────────────────────────────────────────

let agreedEntryId: string;

test.describe("D. credit ledger", () => {
  test("D1 a rejected proposal changes nothing", async () => {
    const asked = await propose(1000);
    expect(asked.status).toBe(201);
    const pending = await call(customer, "GET", "/api/v1/my/proposals");
    expect(pending.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proposalId: asked.body.proposalId, status: "proposed" }),
      ])
    );
    const no = await call(customer, "POST", `/api/v1/proposals/${asked.body.proposalId}/reject`, {
      data: { version: 1 },
    });
    expect(no.status).toBe(200);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2000);
  });

  test("D2 the shop cannot accept its own proposal; one in flight at a time; a resent request makes no second", async () => {
    const key = randomUUID();
    const asked = await propose(500, key);
    expect(asked.status).toBe(201);
    // Creation is not keyed (DEFECT P-1): a resend is refused by the
    // one-in-flight rule rather than answered with the original. No duplicate.
    const replay = await propose(500, key);
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe("RESOURCE_ALREADY_EXISTS");

    const second = await propose(600);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("RESOURCE_ALREADY_EXISTS");

    const own = await call(
      shopkeeper,
      "POST",
      `/api/v1/proposals/${asked.body.proposalId}/accept`,
      {
        shop,
        data: { version: 1 },
      }
    );
    expect(own.status).toBe(403);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2000);

    // Two phones accepting at the same instant: exactly one ledger entry.
    const before = credits();
    const [a, b] = await Promise.all([
      call(customer, "POST", `/api/v1/proposals/${asked.body.proposalId}/accept`, {
        data: { version: 1 },
      }),
      call(customer, "POST", `/api/v1/proposals/${asked.body.proposalId}/accept`, {
        data: { version: 1 },
      }),
    ]);
    expect([a.status, b.status].filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    expect(credits() - before).toBe(1);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2500);
    agreedEntryId = entryOf(asked.body.proposalId);
    expect(agreedEntryId).toMatch(/^txn_/);
  });

  test("D3 a disputed figure blocks acceptance until revised, then only the agreed figure is recorded", async () => {
    const asked = await propose(1000);
    const disputed = await call(customer, "POST", "/api/v1/disputes", {
      data: {
        subjectKind: "proposal",
        subjectId: asked.body.proposalId,
        claim: "It was 800, not 1000",
      },
    });
    expect(disputed.status).toBe(201);
    const sneak = await call(
      customer,
      "POST",
      `/api/v1/proposals/${asked.body.proposalId}/accept`,
      { data: { version: 1 } }
    );
    expect(sneak.status).toBe(409);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2500);

    const revised = await call(
      shopkeeper,
      "POST",
      `/api/v1/proposals/${asked.body.proposalId}/revise`,
      {
        shop,
        data: { version: 1, amount: 800 },
      }
    );
    expect(revised.status).toBe(200);
    const ok = await call(customer, "POST", `/api/v1/proposals/${asked.body.proposalId}/accept`, {
      data: { version: 2 },
    });
    expect(ok.status).toBe(200);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(3300);
  });

  test("D4 an agreed entry cannot be deleted, and paise are refused", async () => {
    const del = await call(
      shopkeeper,
      "DELETE",
      `/api/v1/parties/${partyId}/entries/${agreedEntryId}`,
      { shop }
    );
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("TRANSITION_REFUSED");
    const paise = await propose(100.5);
    expect(paise.status).toBeGreaterThanOrEqual(400);
    expect(paise.status).toBeLessThan(500);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(3300);
    expect(sql(`SELECT amount FROM entry_projection WHERE entry_id = ${lit(agreedEntryId)}`)).toBe(
      "500"
    );
  });
});

// ── E. Repayments ────────────────────────────────────────────────────────────

async function repay(amount: string, key?: string) {
  const proposed = await call(customer, "POST", `/api/v1/shops/${shop.shopId}/payments`, {
    key,
    data: { amount, method: "cash" },
  });
  return proposed;
}

let firstPaymentEntry: string;

test.describe("E. repayments", () => {
  test("E1 a partial repayment counts only once the shop agrees, and a replay does not double it", async () => {
    const key = randomUUID();
    const proposed = await repay("700", key);
    expect(proposed.status).toBe(201);
    expect(proposed.body.allocation.outstandingBefore).toBe("3300");
    expect(proposed.body.allocation.outstandingAfter).toBe("2600");
    // As with credit (DEFECT P-1): a resend is refused, never a second proposal.
    const again = await repay("700", key);
    expect(again.status).toBe(409);
    expect(
      count(
        `SELECT count(*) FROM proposals WHERE merchant_id = ${lit(shop.merchantId)} AND type = 'payment' AND status = 'proposed'`
      )
    ).toBe(1);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(3300);

    const before = payments();
    const accept = () =>
      call(shopkeeper, "POST", `/api/v1/payments/${proposed.body.paymentId}/accept`, {
        data: { agreedAllocation: proposed.body.allocation.fingerprint },
      });
    const [a, b] = await Promise.all([accept(), accept()]);
    expect([a.status, b.status]).toContain(200);
    expect(payments() - before).toBe(1);
    firstPaymentEntry = (a.status === 200 ? a : b).body.entryId;
    expect(firstPaymentEntry).toMatch(/^txn_/);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(2600);
    expect(await outstandingFor(customer, shop)).toBe(2600);
  });

  test("E2 multiple repayments, then the rest in full: owes nothing", async () => {
    for (const [amount, after] of [
      ["600", 2000],
      ["2000", 0],
    ] as const) {
      const p = await repay(amount);
      expect(p.status).toBe(201);
      const ok = await call(shopkeeper, "POST", `/api/v1/payments/${p.body.paymentId}/accept`, {
        data: { agreedAllocation: p.body.allocation.fingerprint },
      });
      expect(ok.status).toBe(200);
      expect(await netOf(shopkeeper, shop, partyId)).toBe(after);
    }
    // Paying when nothing is owed is an advance by design (allocation
    // "overpayment"): nothing allocated, the whole amount a remainder.
    const over = await repay("1");
    expect(over.status).toBe(201);
    expect(over.body.allocation.remainder).toBe("1");
    const declined = await call(
      shopkeeper,
      "POST",
      `/api/v1/payments/${over.body.paymentId}/reject`,
      {
        data: { reason: "Nothing owed" },
      }
    );
    expect(declined.status).toBe(200);
  });

  test("E3 a rejected repayment changes nothing; paise are refused", async () => {
    const credit = await propose(400);
    await call(customer, "POST", `/api/v1/proposals/${credit.body.proposalId}/accept`, {
      data: { version: 1 },
    });
    expect(await netOf(shopkeeper, shop, partyId)).toBe(400);
    const p = await repay("100");
    const no = await call(shopkeeper, "POST", `/api/v1/payments/${p.body.paymentId}/reject`, {
      data: { reason: "Not received" },
    });
    expect(no.status).toBe(200);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(400);
    expect((await repay("100.50")).status).toBe(422);
  });

  test("E4 an agreed allocation cannot be rewritten, even in the database", async () => {
    const table = sql(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE '%allocation%' ORDER BY table_name LIMIT 1`
    );
    expect(table).not.toBe("");
    const err = sqlError(
      `UPDATE ${table} SET amount = amount + 1 WHERE merchant_id = ${lit(shop.merchantId)}`
    );
    expect(err, `${table} accepted an update`).not.toBeNull();
    const deleted = await call(
      shopkeeper,
      "DELETE",
      `/api/v1/parties/${partyId}/entries/${firstPaymentEntry}`,
      { shop }
    );
    expect(deleted.status).toBe(409);
  });
});

// ── F. Adjustments (local development API: the flag is on here by design) ───

test.describe("F. corrections, on an isolated development API", () => {
  let creditId: string;

  test("F1 a correction needs a reason, and changes nothing until the customer accepts", async () => {
    const credit = await propose(1000);
    await call(customer, "POST", `/api/v1/proposals/${credit.body.proposalId}/accept`, {
      data: { version: 1 },
    });
    creditId = entryOf(credit.body.proposalId);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(1400);

    const noReason = await call(shopkeeper, "POST", "/api/v1/proposals", {
      shop,
      data: {
        partyId,
        type: "adjustment",
        amount: 200,
        adjustsEntryId: creditId,
        direction: "reduce",
        reason: "  ",
      },
    });
    expect(noReason.status).toBeGreaterThanOrEqual(400);
    expect(noReason.status).toBeLessThan(500);

    const asked = await call(shopkeeper, "POST", "/api/v1/proposals", {
      shop,
      data: {
        partyId,
        type: "adjustment",
        amount: 200,
        adjustsEntryId: creditId,
        direction: "reduce",
        reason: "Two bags of rice came back",
      },
    });
    expect(asked.status).toBe(201);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(1400);
    const own = await call(
      shopkeeper,
      "POST",
      `/api/v1/proposals/${asked.body.proposalId}/accept`,
      {
        shop,
        data: { version: 1 },
      }
    );
    expect(own.status).toBe(403);

    const ok = await call(customer, "POST", `/api/v1/proposals/${asked.body.proposalId}/accept`, {
      data: { version: 1 },
    });
    expect(ok.status).toBe(200);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(1200);
    // The original stands untouched beside a linked row of its own.
    expect(sql(`SELECT amount FROM entry_projection WHERE entry_id = ${lit(creditId)}`)).toBe(
      "1000"
    );
    expect(
      count(`SELECT count(*) FROM entry_projection WHERE adjusts_entry_id = ${lit(creditId)}`)
    ).toBe(1);
    expect(
      count(
        `SELECT count(*) FROM events WHERE merchant_id = ${lit(shop.merchantId)} AND type = 'EntryAdjusted'`
      )
    ).toBe(1);
  });

  test("F2 a full reversal brings the credit to nothing; no more than the credit can come off", async () => {
    const over = await call(shopkeeper, "POST", "/api/v1/proposals", {
      shop,
      data: {
        partyId,
        type: "adjustment",
        amount: 801,
        adjustsEntryId: creditId,
        direction: "reduce",
        reason: "x",
      },
    });
    expect(over.status).toBeGreaterThanOrEqual(400);
    const all = await call(shopkeeper, "POST", "/api/v1/proposals", {
      shop,
      data: {
        partyId,
        type: "adjustment",
        amount: 800,
        adjustsEntryId: creditId,
        direction: "reduce",
        reason: "Wrong customer",
      },
    });
    expect(all.status).toBe(201);
    await call(customer, "POST", `/api/v1/proposals/${all.body.proposalId}/accept`, {
      data: { version: 1 },
    });
    expect(await netOf(shopkeeper, shop, partyId)).toBe(400);
  });

  test("F3 a repayment cannot be corrected, and a phone cannot push an adjustment itself", async () => {
    const res = await call(shopkeeper, "POST", "/api/v1/proposals", {
      shop,
      data: {
        partyId,
        type: "adjustment",
        amount: 100,
        adjustsEntryId: firstPaymentEntry,
        direction: "reduce",
        reason: "x",
      },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(400);
  });
});

// ── G. Reliability: retries and interrupted submissions ──────────────────────

test.describe("G. retries", () => {
  test("G1 an acceptance cut off mid-flight and retried with its key is recorded once", async () => {
    const asked = await propose(250);
    expect(asked.status).toBe(201);
    const key = randomUUID();
    const before = credits();
    // The phone gives up before the answer arrives — what a train tunnel does.
    await call(customer, "POST", `/api/v1/proposals/${asked.body.proposalId}/accept`, {
      key,
      timeout: 1,
      data: { version: 1 },
    }).catch(() => null);
    const retried = await call(
      customer,
      "POST",
      `/api/v1/proposals/${asked.body.proposalId}/accept`,
      {
        key,
        data: { version: 1 },
      }
    );
    expect(retried.status).toBe(200);
    const thrice = await call(
      customer,
      "POST",
      `/api/v1/proposals/${asked.body.proposalId}/accept`,
      {
        key,
        data: { version: 1 },
      }
    );
    expect(thrice.status).toBe(200);
    expect(credits() - before).toBe(1);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(650);
  });

  test("G2 a creation cut off mid-flight and resent leaves exactly one proposal (DEFECT P-1: the resend reads as refused)", async () => {
    const key = randomUUID();
    const before = count(
      `SELECT count(*) FROM proposals WHERE merchant_id = ${lit(shop.merchantId)}`
    );
    await call(shopkeeper, "POST", "/api/v1/proposals", {
      shop,
      key,
      timeout: 1,
      data: { partyId, type: "credit", amount: 150 },
    }).catch(() => null);
    await new Promise((r) => setTimeout(r, 500));
    const resent = await propose(150, key);
    expect([201, 409]).toContain(resent.status);
    expect(
      count(`SELECT count(*) FROM proposals WHERE merchant_id = ${lit(shop.merchantId)}`) - before
    ).toBe(1);
    const live = sql(
      `SELECT proposal_id || '|' || current_version FROM proposals
        WHERE merchant_id = ${lit(shop.merchantId)} AND status = 'proposed' ORDER BY created_at DESC LIMIT 1`
    ).split("|");
    await call(shopkeeper, "POST", `/api/v1/proposals/${live[0]}/cancel`, {
      shop,
      data: { version: Number(live[1]) },
    });
    expect(await netOf(shopkeeper, shop, partyId)).toBe(650);
  });
});

// ── H. Security and administration ───────────────────────────────────────────

test.describe("H. who may see and do what", () => {
  test("H1 no token, no data", async ({ playwright }) => {
    const anon = await playwright.request.newContext({
      baseURL: process.env.UDHARPE_E2E_API ?? "http://127.0.0.1:4000",
    });
    for (const path of [
      "/api/v1/relationships",
      "/api/v1/my/proposals",
      `/api/v1/parties/${partyId}/summary`,
      "/api/v1/admin/shops",
    ]) {
      expect((await anon.get(path)).status(), path).toBe(401);
    }
    await anon.dispose();
  });

  test("H2 another customer cannot read or pay this customer's shop", async () => {
    expect((await call(stranger, "GET", `/api/v1/shops/${shop.shopId}/outstanding`)).status).toBe(
      404
    );
    const pay = await call(stranger, "POST", `/api/v1/shops/${shop.shopId}/payments`, {
      data: { amount: "100", method: "cash" },
    });
    expect(pay.status).toBe(404);
    const theirs = await call(stranger, "GET", "/api/v1/my/proposals");
    expect(theirs.body.items ?? []).toEqual([]);
  });

  test("H3 another shop cannot read, write or borrow this shop's records", async () => {
    // Its own header: this shop's contact does not exist there.
    expect(
      (await call(rival, "GET", `/api/v1/parties/${partyId}/summary`, { shop: rivalShop })).status
    ).toBe(404);
    // This shop's header: it is not a member.
    expect([403, 404]).toContain(
      (await call(rival, "GET", `/api/v1/parties/${partyId}/summary`, { shop })).status
    );
    const write = await call(rival, "POST", "/api/v1/proposals", {
      shop,
      data: { partyId, type: "credit", amount: 100 },
    });
    expect([403, 404]).toContain(write.status);
    const steal = await call(rival, "POST", "/api/v1/proposals", {
      shop: rivalShop,
      data: { partyId, type: "credit", amount: 100 },
    });
    expect([403, 404, 409, 422]).toContain(steal.status);
    expect(await netOf(shopkeeper, shop, partyId)).toBe(650);
  });

  test("H4 the admin directory and audit are refused to shopkeepers and customers", async () => {
    for (const path of [
      "/api/v1/admin/shops",
      "/api/v1/admin/people",
      "/api/v1/admin/relationships",
      "/api/v1/admin/audit",
      "/api/v1/admin/applications",
    ]) {
      expect((await call(shopkeeper, "GET", path)).status, path).toBe(403);
      expect((await call(customer, "GET", path)).status, path).toBe(403);
    }
  });

  test("H5 answers never carry a session token or the other side's email", async () => {
    const seen = JSON.stringify([
      (await call(customer, "GET", "/api/v1/relationships")).body,
      (await call(customer, "GET", "/api/v1/my/proposals")).body,
      (await call(shopkeeper, "GET", "/api/v1/relationships", { shop })).body,
      (await call(shopkeeper, "GET", `/api/v1/parties/${partyId}/statement`, { shop })).body,
    ]);
    for (const secret of [shopkeeper.token, customer.token]) expect(seen).not.toContain(secret);
    expect(seen).not.toContain(customer.email);
    expect(seen).not.toContain(shopkeeper.email);
  });

  test("H6 every agreed money movement is in the audit trail with its actor", async () => {
    expect(
      count(`SELECT count(*) FROM audit_events WHERE actor_person_id = ${lit(customer.personId)}`)
    ).toBeGreaterThan(0);
    expect(
      count(`SELECT count(*) FROM audit_events WHERE actor_person_id = ${lit(shopkeeper.personId)}`)
    ).toBeGreaterThan(0);
  });

  test("H7 the books agree: the shop's balance, the customer's view and the ledger rows", async () => {
    const net = await netOf(shopkeeper, shop, partyId);
    expect(net).toBe(650);
    expect(await outstandingFor(customer, shop)).toBe(650);
    const fromRows = Number(
      sql(
        `SELECT COALESCE(sum(CASE WHEN direction = 'given' THEN amount ELSE -amount END), 0)
           FROM entry_projection WHERE merchant_id = ${lit(shop.merchantId)} AND party_id = ${lit(partyId)} AND deleted = false`
      )
    );
    expect(fromRows).toBe(650);
  });
});

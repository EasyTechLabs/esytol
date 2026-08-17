/**
 * Phase 5 — web ↔ mobile convergence, end to end (WEB-SYNC-004).
 *
 * The scenario the mission names, run in order across two clients that share
 * nothing but a shop and a PostgreSQL row:
 *
 *   WEB     credit ₹500        →  /sync/push  →  PostgreSQL
 *   MOBILE  pull               ←  /sync/pull
 *   MOBILE  payment ₹200       →  REST        →  PostgreSQL
 *   WEB     pull               ←  /sync/pull  →  ₹300
 *   WEB     reload, sync twice →  still ₹300
 *
 * The mobile half is `vyora-mobile/tests/web-convergence.test.ts`, invoked from
 * the middle of this test so the ordering is real rather than assumed. It runs
 * the phone's own repository, outbox, sync engine and generated API client
 * against real SQLite.
 *
 * **What this is not.** No physical phone and no emulator is driven here: the
 * mobile half is the app's own code on Node, not its React Native UI. That
 * distinction is kept in the report rather than blurred — a tapped screen is a
 * claim this file cannot support.
 *
 * The two write paths are deliberately different, and that is the thing under
 * test: the browser pushes events, the phone posts REST writes the server turns
 * into events, and both read one log back through the same cursor.
 */

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { eventCount, expectParty, recordCredit, sql, syncTone } from "./harness";
import { suiteShop } from "./shared";

test.describe.configure({ mode: "serial" });

const MOBILE_REPO = join(process.cwd(), "..", "vyora-mobile");

/** Run the phone's half, and surface its output when it fails. */
function runMobileHalf(env: Record<string, string>): string {
  try {
    // Jest writes its report to stderr, so both streams are merged — reading
    // only stdout would report an empty run as a skipped one.
    return execFileSync("npx jest --ci web-convergence 2>&1", {
      cwd: MOBILE_REPO,
      encoding: "utf8",
      timeout: 300_000,
      env: { ...process.env, ...env },
      shell: true,
    });
  } catch (cause) {
    const error = cause as { stdout?: string; stderr?: string };
    throw new Error(`The phone's half failed.\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
  }
}

test("web credits ₹500, mobile pays ₹200, and both settle on ₹300", async ({ page }) => {
  const shop = suiteShop();
  const contact = `Convergence ${Date.now().toString(36)}`;

  // ── WEB: credit ₹500 ──────────────────────────────────────────────────────
  await page.goto("/vyora");
  const before = eventCount(shop.merchantId);
  await recordCredit(page, contact, 500);
  await expectParty(page, contact);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  // In PostgreSQL, attributed to a real device the browser never named.
  await expect.poll(() => eventCount(shop.merchantId), { timeout: 60_000 }).toBe(before + 2);
  const partyId = sql(
    `SELECT party_id FROM party_projection WHERE merchant_id = '${shop.merchantId}' AND name = '${contact}'`
  );
  expect(partyId).not.toBe("");
  expect(
    sql(
      `SELECT balance FROM (SELECT sum(CASE WHEN direction = 'given' THEN amount ELSE -amount END) AS balance
         FROM entry_projection WHERE merchant_id = '${shop.merchantId}' AND party_id = '${partyId}') b`
    )
  ).toBe("500");

  // ── MOBILE: pull, pay ₹200, deliver ───────────────────────────────────────
  const output = runMobileHalf({
    VYORA_E2E_API: "http://127.0.0.1:4000",
    VYORA_E2E_TOKEN: shop.token,
    VYORA_E2E_SHOP: shop.merchantId,
    VYORA_E2E_PARTY: contact,
    VYORA_E2E_CREDIT: "500",
    VYORA_E2E_PAYMENT: "200",
  });
  expect(output, "the phone's half must actually run, not skip").toContain("1 passed");

  // The payment is in PostgreSQL, and the server folds ₹300.
  expect(
    sql(
      `SELECT balance FROM (SELECT sum(CASE WHEN direction = 'given' THEN amount ELSE -amount END) AS balance
         FROM entry_projection WHERE merchant_id = '${shop.merchantId}' AND party_id = '${partyId}') b`
    )
  ).toBe("300");

  // ── WEB: pull it back ─────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  const balance = async () =>
    page.evaluate(async (name: string) => {
      const open = (): Promise<IDBDatabase> =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open("vyora");
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      const db = await open();
      const rows = await new Promise<{ event: Record<string, unknown> }[]>((resolve, reject) => {
        const tx = db.transaction("events", "readonly");
        const req = tx.objectStore("events").index("by_order").getAll();
        req.onsuccess = () => resolve(req.result as { event: Record<string, unknown> }[]);
        req.onerror = () => reject(req.error);
      });
      const events = rows.map((r) => r.event) as {
        type: string;
        party?: { id: string; name: string };
        transaction?: { partyId: string; amount: number; kind: string };
        payment?: { partyId: string; amount: number; kind: string };
      }[];
      const party = events.find(
        (e) => e.type === "ContactCreated" && e.party?.name === name
      )?.party;
      if (!party) return null;
      let net = 0;
      for (const e of events) {
        if (e.transaction?.partyId === party.id) {
          net += e.transaction.kind === "given" ? e.transaction.amount : -e.transaction.amount;
        }
        if (e.payment?.partyId === party.id) {
          net += e.payment.kind === "received" ? -e.payment.amount : e.payment.amount;
        }
      }
      return net;
    }, contact);

  // The browser folded the phone's payment into its own credit.
  await expect.poll(balance, { timeout: 60_000 }).toBe(300);

  // ── RELOAD, then sync twice more ──────────────────────────────────────────
  await page.reload();
  await expectParty(page, contact);
  expect(await balance()).toBe(300);

  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
  }
  expect(await balance()).toBe(300);

  // Nothing was applied twice, on either side of the boundary.
  expect(
    sql(
      `SELECT count(*) FROM (SELECT event_id FROM events WHERE merchant_id = '${shop.merchantId}'
        GROUP BY event_id HAVING count(*) > 1) d`
    )
  ).toBe("0");
});

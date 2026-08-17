/**
 * Phase 6 evidence — what happens to a deletion on its way to a phone.
 *
 * This is not a test of desired behaviour. It is the probe that establishes,
 * against the real API and a real phone-side client, whether the two write
 * paths converge for the whole event vocabulary or only for part of it. The
 * finding it produces is written up in `MOBILE-SYNC-ARCH-001`.
 *
 * It asserts only facts that must hold either way — that the browser really
 * deleted the entry and that the deletion really reached PostgreSQL — and then
 * reports what the phone made of it. Nothing here pins a wrong balance as
 * correct.
 */

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { eventCount, expectParty, recordCredit, sql, syncTone } from "./harness";
import { suiteShop } from "./shared";

test.describe.configure({ mode: "serial" });

const MOBILE_REPO = join(process.cwd(), "..", "vyora-mobile");

test("a deletion made in the browser reaches PostgreSQL, and the phone is asked for its view", async ({
  page,
}) => {
  const shop = suiteShop();
  const contact = `Deleted ${Date.now().toString(36)}`;

  await page.goto("/vyora");
  await recordCredit(page, contact, 900);
  await expectParty(page, contact);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  const partyId = sql(
    `SELECT party_id FROM party_projection WHERE merchant_id = '${shop.merchantId}' AND name = '${contact}'`
  );
  expect(partyId).not.toBe("");

  // Delete the entry through the real screen.
  await page.goto(`/vyora/parties/${partyId}`);
  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .getByRole("button", { name: /delete/i })
    .first()
    .click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  // The browser's own book no longer counts it.
  const webBalance = await page.evaluate(async (name: string) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vyora");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise<{ event: Record<string, unknown> }[]>((resolve, reject) => {
      const tx = db.transaction("events", "readonly");
      const req = tx.objectStore("events").index("by_order").getAll();
      req.onsuccess = () => resolve(req.result as { event: Record<string, unknown> }[]);
      req.onerror = () => reject(req.error);
    });
    const events = rows.map((r) => r.event) as {
      type: string;
      party?: { id: string; name: string };
      transaction?: { id: string; partyId: string; amount: number; kind: string };
      entryId?: string;
    }[];
    const party = events.find((e) => e.type === "ContactCreated" && e.party?.name === name)?.party;
    if (!party) return null;
    const deleted = new Set(
      events.filter((e) => e.type === "EntryDeleted").map((e) => e.entryId as string)
    );
    let net = 0;
    for (const e of events) {
      if (e.transaction?.partyId === party.id && !deleted.has(e.transaction.id)) {
        net += e.transaction.kind === "given" ? e.transaction.amount : -e.transaction.amount;
      }
    }
    return net;
  }, contact);
  expect(webBalance, "the browser must have removed the entry from its own book").toBe(0);

  // And the deletion is in PostgreSQL as an event — no REST endpoint could have
  // carried it, which is why sync push exists.
  expect(
    sql(
      `SELECT count(*) FROM events WHERE merchant_id = '${shop.merchantId}' AND type = 'EntryDeleted'`
    )
  ).not.toBe("0");
  expect(eventCount(shop.merchantId)).toBeGreaterThan(0);

  // Now ask a phone what it makes of the same log. Reported, not asserted:
  // whichever way this comes out is the evidence Phase 6 needs.
  const output = execFileSync("npx jest --ci deletion-view 2>&1", {
    cwd: MOBILE_REPO,
    encoding: "utf8",
    timeout: 300_000,
    shell: true,
    env: {
      ...process.env,
      VYORA_E2E_API: "http://127.0.0.1:4000",
      VYORA_E2E_TOKEN: shop.token,
      VYORA_E2E_SHOP: shop.merchantId,
      VYORA_E2E_PARTY: contact,
    },
  });
  console.log(`\n--- the phone's view of a browser deletion ---\n${output}`);
});

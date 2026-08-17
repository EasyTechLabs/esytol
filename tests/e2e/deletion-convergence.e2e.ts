/**
 * Web deletes, the phone agrees (ADR-0017, MOBILE-DELETE-SEMANTICS-001).
 *
 * This file replaces the WEB-SYNC-004 probe that measured the defect. That one
 * asserted nothing and printed what the phone folded, because pinning the answer
 * while it was wrong would have recorded a defect as a requirement. It printed
 * ₹900 against the browser's ₹0.
 *
 * ADR-0017 decided the answer and both clients now produce it, so the probe
 * becomes the proof:
 *
 *   WEB     credit ₹900   → /sync/push → PostgreSQL
 *   MOBILE  pull                       → ₹900
 *   WEB     delete        → /sync/push → PostgreSQL holds EntryDeleted
 *   MOBILE  pull                       → ₹0
 *   BOTH    sync again                 → still ₹0
 *
 * and the same for `ContactDeleted`.
 *
 * Nothing is mocked. The browser is a real Chromium driving the real screens,
 * the API is `vyora-api` on real PostgreSQL, and the phone half is the app's own
 * repository, applier and generated client against real SQLite — not its React
 * Native UI, which this file does not claim to have exercised.
 */

import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { eventCount, expectParty, recordCredit, sql, syncTone } from "./harness";
import { suiteShop } from "./shared";

test.describe.configure({ mode: "serial" });

const MOBILE_REPO = join(process.cwd(), "..", "vyora-mobile");

/** Ask a phone with an empty book what it folds for this contact. */
function phoneFolds(env: Record<string, string>): string {
  try {
    return execFileSync("npx jest --ci deletion-view 2>&1", {
      cwd: MOBILE_REPO,
      encoding: "utf8",
      timeout: 300_000,
      shell: true,
      env: { ...process.env, ...env },
    });
  } catch (cause) {
    const error = cause as { stdout?: string; stderr?: string };
    throw new Error(`The phone disagreed.\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
  }
}

/** The browser's own fold for one contact, read out of its IndexedDB. */
async function webBalance(page: Page, name: string) {
  return page.evaluate(async (contact: string) => {
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
      partyId?: string;
      entryId?: string;
      transaction?: { id: string; partyId: string; amount: number; kind: string };
    }[];

    const party = events.find(
      (e) => e.type === "ContactCreated" && e.party?.name === contact
    )?.party;
    if (!party) return { present: false, net: 0 };

    // The browser's own fold, in miniature: a deleted contact takes its entries
    // with it, a deleted entry leaves the balance.
    const contactGone = events.some((e) => e.type === "ContactDeleted" && e.partyId === party.id);
    if (contactGone) return { present: false, net: 0 };

    const deleted = new Set(
      events.filter((e) => e.type === "EntryDeleted").map((e) => e.entryId as string)
    );
    let net = 0;
    for (const e of events) {
      if (e.transaction?.partyId === party.id && !deleted.has(e.transaction.id)) {
        net += e.transaction.kind === "given" ? e.transaction.amount : -e.transaction.amount;
      }
    }
    return { present: true, net };
  }, name);
}

test("a deleted entry is gone on both clients, and stays gone", async ({ page }) => {
  const shop = suiteShop();
  const contact = `DelEntry ${Date.now().toString(36)}`;

  // ── WEB: ₹900 ─────────────────────────────────────────────────────────────
  await page.goto("/vyora");
  const before = eventCount(shop.merchantId);
  await recordCredit(page, contact, 900);
  await expectParty(page, contact);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
  await expect.poll(() => eventCount(shop.merchantId), { timeout: 60_000 }).toBe(before + 2);
  expect(await webBalance(page, contact)).toEqual({ present: true, net: 900 });

  // ── MOBILE: pull → ₹900 ───────────────────────────────────────────────────
  const first = phoneFolds({
    VYORA_E2E_API: "http://127.0.0.1:4000",
    VYORA_E2E_TOKEN: shop.token,
    VYORA_E2E_SHOP: shop.merchantId,
    VYORA_E2E_PARTY: contact,
    VYORA_E2E_EXPECT_NET: "900",
  });
  expect(first, "the phone's half must run, not skip").toContain("1 passed");

  // ── WEB: delete the entry through the real screen ─────────────────────────
  const partyId = sql(
    `SELECT party_id FROM party_projection WHERE merchant_id = '${shop.merchantId}' AND name = '${contact}'`
  );
  await page.goto(`/vyora/parties/${partyId}`);
  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .getByRole("button", { name: /delete/i })
    .first()
    .click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  expect(await webBalance(page, contact)).toEqual({ present: true, net: 0 });
  expect(
    sql(
      `SELECT count(*) FROM events WHERE merchant_id = '${shop.merchantId}' AND type = 'EntryDeleted'`
    )
  ).not.toBe("0");

  // ── MOBILE: pull → ₹0. The defect, closed. ────────────────────────────────
  const second = phoneFolds({
    VYORA_E2E_API: "http://127.0.0.1:4000",
    VYORA_E2E_TOKEN: shop.token,
    VYORA_E2E_SHOP: shop.merchantId,
    VYORA_E2E_PARTY: contact,
    VYORA_E2E_EXPECT_NET: "0",
  });
  expect(second).toContain("1 passed");

  // ── BOTH: sync again, nothing moves ───────────────────────────────────────
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
  }
  expect(await webBalance(page, contact)).toEqual({ present: true, net: 0 });

  // The phone's own repeat pull is asserted inside its half; this is the third.
  expect(
    phoneFolds({
      VYORA_E2E_API: "http://127.0.0.1:4000",
      VYORA_E2E_TOKEN: shop.token,
      VYORA_E2E_SHOP: shop.merchantId,
      VYORA_E2E_PARTY: contact,
      VYORA_E2E_EXPECT_NET: "0",
    })
  ).toContain("1 passed");

  // Every event exactly once, on the one side that stores them.
  expect(
    sql(
      `SELECT count(*) FROM (SELECT event_id FROM events WHERE merchant_id = '${shop.merchantId}'
        GROUP BY event_id HAVING count(*) > 1) d`
    )
  ).toBe("0");
});

test("a deleted contact takes its entries with it on both clients", async ({ page }) => {
  const shop = suiteShop();
  const contact = `DelContact ${Date.now().toString(36)}`;

  await page.goto("/vyora");
  await recordCredit(page, contact, 750);
  await expectParty(page, contact);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  // Deleting a contact lives behind a long press on its row, which `useLongPress`
  // also exposes as a context menu for desktop and accessibility. Right-click is
  // therefore the real affordance here, not a test-only hook.
  await page.goto("/vyora/parties");
  await page.getByText(contact).first().click({ button: "right" });
  await page.getByRole("button", { name: "Delete contact" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  // The browser no longer has the contact at all.
  expect(await webBalance(page, contact)).toEqual({ present: false, net: 0 });
  expect(
    sql(
      `SELECT count(*) FROM events WHERE merchant_id = '${shop.merchantId}' AND type = 'ContactDeleted'`
    )
  ).not.toBe("0");

  // And neither does the phone, entries and all.
  expect(
    phoneFolds({
      VYORA_E2E_API: "http://127.0.0.1:4000",
      VYORA_E2E_TOKEN: shop.token,
      VYORA_E2E_SHOP: shop.merchantId,
      VYORA_E2E_PARTY: contact,
      VYORA_E2E_EXPECT_PARTY_GONE: "1",
    })
  ).toContain("1 passed");
});

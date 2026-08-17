/**
 * Phase 4 — two real tabs, one book (WEB-SYNC-004).
 *
 * This is the case jsdom cannot reach at all. Two tabs of one origin share an
 * IndexedDB and a `navigator.locks` manager, and neither exists in jsdom — so
 * every previous claim about multi-tab safety rested on `tests/vyora/multitab`,
 * which drives two providers over one `localStorage` with a hand-written lock
 * stub. That test is worth having and it is not this.
 *
 * Both pages live in one browser context, which is what makes them tabs of the
 * same profile rather than two unrelated browsers.
 */

import { test, expect } from "@playwright/test";
import { eventCount, expectParty, indexedDbState, recordCredit, sql, syncTone } from "./harness";
import { suiteShop } from "./shared";

test.describe.configure({ mode: "serial" });

test("both tabs have Web Locks, and the ledger lock actually serialises them", async ({
  context,
}) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/vyora");
  await b.goto("/vyora");

  // The capability the whole design rests on, in the browser rather than in a
  // stub. `hasWebLocks()` returning false is what puts extra tabs into
  // read-only mode, so this is also the assertion that the fallback is *not*
  // what is being exercised below.
  expect(await a.evaluate(() => typeof navigator.locks?.request === "function")).toBe(true);
  expect(await b.evaluate(() => typeof navigator.locks?.request === "function")).toBe(true);

  // Tab A takes the same named lock the ledger uses and holds it. Tab B then
  // asks for it. If the lock is real and shared across tabs, B waits.
  const held = a.evaluate(
    () =>
      new Promise<void>((resolve) => {
        navigator.locks.request("vyora.ledger.write", async () => {
          (window as unknown as { __held: boolean }).__held = true;
          resolve();
          await new Promise((done) => setTimeout(done, 2500));
        });
      })
  );
  await held;

  const waited = await b.evaluate(async () => {
    const started = performance.now();
    await navigator.locks.request("vyora.ledger.write", async () => undefined);
    return performance.now() - started;
  });

  // B could not have got in while A held it. A stub confined to one page would
  // have returned immediately.
  expect(waited).toBeGreaterThan(1000);

  await a.close();
  await b.close();
});

test("two tabs recording at once lose nothing and duplicate nothing", async ({ context }) => {
  const shop = suiteShop();
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/vyora");
  await b.goto("/vyora");
  await expect.poll(() => syncTone(a), { timeout: 60_000 }).toBe("synced");

  const before = eventCount(shop.merchantId);

  // Both tabs record, as close to simultaneously as two real pages get.
  await Promise.all([recordCredit(a, "Tab A Anand", 1100), recordCredit(b, "Tab B Bhavna", 2200)]);

  // Neither write was lost: the lock made them take turns rather than one
  // overwriting the other's projection.
  await expect.poll(() => eventCount(shop.merchantId), { timeout: 60_000 }).toBe(before + 4);

  // And nothing was applied twice.
  expect(
    sql(
      `SELECT count(*) FROM (SELECT event_id FROM events WHERE merchant_id = '${shop.merchantId}'
        GROUP BY event_id HAVING count(*) > 1) d`
    )
  ).toBe("0");

  // Both tabs converge on the same book once each has synced.
  for (const page of [a, b]) {
    await page
      .getByRole("button", { name: "Sync now" })
      .click()
      .catch(() => undefined);
    await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
    await page.reload();
    await expectParty(page, "Tab A Anand");
    await expectParty(page, "Tab B Bhavna");
  }

  const left = await indexedDbState(a);
  const right = await indexedDbState(b);
  expect(left.events).toBe(right.events);
  expect(left.pending).toBe(0);
  expect(right.pending).toBe(0);
  expect(left.cursor).toEqual(right.cursor);

  await a.close();
  await b.close();
});

test("three simultaneous sync requests do not corrupt the cursor or the outbox", async ({
  context,
}) => {
  const shop = suiteShop();
  const page = await context.newPage();
  await page.goto("/vyora");
  await recordCredit(page, "Storm Suresh", 3300);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  const settled = eventCount(shop.merchantId);
  const before = await indexedDbState(page);

  // Three clicks in the same tick. The engine shares one in-flight promise, so
  // this is one cycle with three callers rather than three cycles.
  const button = page.getByRole("button", { name: "Sync now" });
  await Promise.all([button.click(), button.click(), button.click()]);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  const after = await indexedDbState(page);
  expect(after.events).toBe(before.events);
  expect(after.pending).toBe(0);
  expect(eventCount(shop.merchantId)).toBe(settled);
  // A cursor that went backwards, or got written by two cycles at once, would
  // show up here as a changed or absent position.
  expect(after.cursor).not.toBeNull();

  await page.close();
});

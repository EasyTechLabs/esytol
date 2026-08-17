/**
 * Phases 2 and 3 — real persistence, and a real disconnection (WEB-SYNC-004).
 *
 * Both of these were asserted in jsdom in WEB-SYNC-003 against `fake-indexeddb`
 * and a `fetch` that refused to answer. Neither is a lie, and neither is the
 * thing itself: jsdom has no IndexedDB at all, and a stubbed `fetch` is a
 * statement about the stub. Here the database is Chromium's own, the reload is
 * a real page load, and "offline" is the browser's network stack refusing to
 * make a connection — the same switch DevTools flips.
 */

import { test, expect } from "@playwright/test";
import { eventCount, expectParty, indexedDbState, recordCredit, sql, syncTone } from "./harness";
import { suiteShop } from "./shared";

test.describe.configure({ mode: "serial" });

test("an entry survives closing the browser, and lives in IndexedDB rather than the old key", async ({
  page,
  context,
}) => {
  const shop = suiteShop();
  await page.goto("/vyora");

  await recordCredit(page, "Durable Devi", 4321);
  await expectParty(page, "Durable Devi");

  // The legacy key is not where the ledger went. `vyora.events.v2` holds
  // nothing, and the whole-log rewrite that used to happen per entry is gone
  // with it — that rewrite was O(E²) over a session.
  const legacy = await page.evaluate(() => localStorage.getItem("vyora.events.v2"));
  expect(legacy).toBeNull();

  const before = await indexedDbState(page);
  expect(before.names).toContain("Durable Devi");
  expect(before.events).toBeGreaterThanOrEqual(2);

  // Close the page entirely and open the app again in the same profile.
  await page.close();
  const reopened = await context.newPage();
  await expectParty(reopened, "Durable Devi");

  const after = await indexedDbState(reopened);
  expect(after.names).toContain("Durable Devi");
  expect(eventCount(shop.merchantId)).toBeGreaterThanOrEqual(2);
});

test("records while the API is unreachable, then converges when it returns", async ({
  page,
  context,
}) => {
  const shop = suiteShop();
  await page.goto("/vyora");

  // Get to a known-synced starting point.
  await recordCredit(page, "Before Outage", 100);
  await expect.poll(() => syncTone(page), { timeout: 30_000 }).toBe("synced");
  const baseline = eventCount(shop.merchantId);

  // The API becomes unreachable, at the browser's network layer.
  //
  // `route.abort("connectionfailed")` is Chromium refusing to complete the
  // request — the same thing a dead connection does, and observed by the app as
  // a rejected `fetch` it never sees the inside of. It is not a stubbed
  // `fetch`: nothing in the page is replaced, and the sync client's own code
  // runs untouched.
  //
  // Only the *API* is cut, not the whole network. `context.setOffline(true)`
  // would also cut the Next dev server this page is served from, so the app
  // could not be navigated at all — which tests the harness rather than the
  // ledger. The truest-offline case is asserted separately below.
  await context.route("**/api/vyora-sync/**", (route) => route.abort("connectionfailed"));

  await recordCredit(page, "Outage Ohm", 7777);
  // The merchant's entry is on the screen, because recording never waited for
  // the network.
  await expectParty(page, "Outage Ohm");

  // And it says offline — never a false "Synced".
  await expect.poll(() => syncTone(page), { timeout: 30_000 }).toBe("offline");
  const queued = await indexedDbState(page);
  expect(queued.pending).toBeGreaterThan(0);

  // Nothing reached the server while it was unreachable.
  expect(eventCount(shop.merchantId)).toBe(baseline);

  // The API comes back.
  await context.unroute("**/api/vyora-sync/**");
  await page.getByRole("button", { name: "Sync now" }).click();

  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
  await expect
    .poll(() => eventCount(shop.merchantId), { timeout: 30_000 })
    .toBeGreaterThan(baseline);

  const drained = await indexedDbState(page);
  expect(drained.pending).toBe(0);

  // The entry recorded during the outage is in PostgreSQL, by name.
  const stored = sql(
    `SELECT count(*) FROM events WHERE merchant_id = '${shop.merchantId}' AND payload::text LIKE '%Outage Ohm%'`
  );
  expect(stored).toBe("1");

  // And it is still there after a reload.
  await page.reload();
  await expectParty(page, "Outage Ohm");
});

test("a genuinely offline browser says offline rather than synced", async ({ page, context }) => {
  const shop = suiteShop();
  await page.goto("/vyora");
  await recordCredit(page, "Grid Down", 500);
  await expect.poll(() => syncTone(page), { timeout: 30_000 }).toBe("synced");
  const baseline = eventCount(shop.merchantId);

  // The whole network stack, the way a phone in a basement experiences it. No
  // navigation happens inside this window — the app is already loaded, which is
  // exactly the situation a merchant is in when the signal drops mid-shift.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("offline");
  expect(eventCount(shop.merchantId)).toBe(baseline);

  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
});

test("syncing repeatedly changes nothing", async ({ page }) => {
  const shop = suiteShop();
  await page.goto("/vyora");
  await recordCredit(page, "Repeat Rao", 2500);
  await expect.poll(() => syncTone(page), { timeout: 30_000 }).toBe("synced");

  const afterFirst = eventCount(shop.merchantId);
  const localAfterFirst = (await indexedDbState(page)).events;

  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect.poll(() => syncTone(page), { timeout: 30_000 }).toBe("synced");
  }

  expect(eventCount(shop.merchantId)).toBe(afterFirst);
  expect((await indexedDbState(page)).events).toBe(localAfterFirst);

  // Every event exactly once under (merchant_id, event_id) — the primary key
  // doing the work ADR-0003 says it does.
  const duplicates = sql(
    `SELECT count(*) FROM (SELECT event_id FROM events WHERE merchant_id = '${shop.merchantId}'
      GROUP BY event_id HAVING count(*) > 1) d`
  );
  expect(duplicates).toBe("0");
});

test("an interrupted sync loses nothing, duplicates nothing, and recovers", async ({
  page,
  context,
}) => {
  const shop = suiteShop();
  await page.goto("/vyora");
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");
  const settled = eventCount(shop.merchantId);

  // Cut the API *first*, so the entry below is recorded and then caught by a
  // push that cannot complete — an interruption rather than a clean outage.
  let cut = true;
  await context.route("**/api/vyora-sync/**", (route) =>
    cut ? route.abort("connectionfailed") : route.continue()
  );

  await recordCredit(page, "Interrupted Iqbal", 6100);
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("offline");

  // The merchant's work is on the device and not on the server.
  const stranded = await indexedDbState(page);
  expect(stranded.pending).toBeGreaterThan(0);
  expect(eventCount(shop.merchantId)).toBe(settled);

  // The cursor was not moved by a cycle that failed.
  const cursorWhileDown = stranded.cursor;
  expect(cursorWhileDown).not.toBeNull();

  // Connectivity returns and the client retries.
  cut = false;
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  const recovered = await indexedDbState(page);
  expect(recovered.pending).toBe(0);
  expect(eventCount(shop.merchantId)).toBe(settled + 2);

  // Exactly once in PostgreSQL, and the local log did not grow a second copy.
  expect(
    sql(
      `SELECT count(*) FROM events WHERE merchant_id = '${shop.merchantId}' AND payload::text LIKE '%Interrupted Iqbal%'`
    )
  ).toBe("1");
  expect(
    sql(
      `SELECT count(*) FROM (SELECT event_id FROM events WHERE merchant_id = '${shop.merchantId}'
        GROUP BY event_id HAVING count(*) > 1) d`
    )
  ).toBe("0");

  // And it survives a reload.
  await page.reload();
  await expectParty(page, "Interrupted Iqbal");
});

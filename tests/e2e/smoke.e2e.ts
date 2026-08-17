/**
 * Phase 1 — the application, in a real browser (WEB-SYNC-004).
 *
 * Before anything is claimed about sync, this establishes that the thing being
 * tested is the actual product: a Chromium that loads the real app with a real
 * session, renders a real ledger, creates a real IndexedDB, and puts a real row
 * in PostgreSQL.
 *
 * The sign-in and shop-creation journey itself is `auth.setup.ts`, which runs
 * before this and would fail the whole suite if any of it broke.
 *
 * Console errors and failed requests are collected rather than ignored, because
 * "it worked" while the console fills with exceptions is not a passing state.
 */

import { test, expect } from "@playwright/test";
import { API_URL } from "../../playwright.config";
import { eventCount, expectParty, indexedDbState, recordCredit, sql, syncTone } from "./harness";
import { suiteShop } from "./shared";

test.describe.configure({ mode: "serial" });

test("the servers this suite needs are actually running", async ({ request }) => {
  const health = await request.get(`${API_URL}/api/v1/health`);
  expect(health.status(), "vyora-api must be running on 4000").toBe(200);
  expect((await health.json()).dependencies[0].status).toBe("ok");

  // And PostgreSQL answers as itself, not through the API.
  expect(sql("SELECT 1")).toBe("1");
});

test("opens the shop, records a credit, and syncs it to PostgreSQL", async ({ page }) => {
  const shop = suiteShop();
  const problems: string[] = [];
  const failed: string[] = [];

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Chromium logs every non-2xx response. A session probe answering 401
    // before a page has its cookie is the app working, not a fault.
    if (m.text().includes("401 (Unauthorized)")) return;
    problems.push(m.text());
  });
  page.on("requestfailed", (r) => {
    // Next's router cancels a prefetch when a real navigation overtakes it.
    const why = r.failure()?.errorText ?? "";
    if (why.includes("ERR_ABORTED") && r.url().includes("_rsc=")) return;
    failed.push(`${r.method()} ${r.url()} (${why})`);
  });

  await page.goto("/vyora");
  // The shell rendered, which means the client bundle evaluated and hydrated —
  // the thing the CSP was silently preventing before this milestone.
  await expect(page.getByText("Vyora Alpha · Early Access Preview")).toBeVisible({
    timeout: 60_000,
  });

  const before = eventCount(shop.merchantId);
  await recordCredit(page, "Ramesh Smoke", 1200);
  await expectParty(page, "Ramesh Smoke");

  // The real browser really made a database, and the entry is in it.
  const stored = await indexedDbState(page);
  expect(stored.events).toBeGreaterThanOrEqual(2);
  expect(stored.names).toContain("Ramesh Smoke");

  // And it reached PostgreSQL.
  await expect
    .poll(() => eventCount(shop.merchantId), {
      timeout: 60_000,
      message: "events should reach PostgreSQL",
    })
    .toBeGreaterThanOrEqual(before + 2);

  await expect.poll(() => syncTone(page), { timeout: 60_000 }).toBe("synced");

  // Server-attributed: the browser sent no device, and the event still names a
  // real registered one (ADR-0016).
  const attributed = sql(
    `SELECT count(DISTINCT device_id) FROM events WHERE merchant_id = '${shop.merchantId}'`
  );
  expect(attributed).toBe("1");
  expect(sql(`SELECT device_id FROM events WHERE merchant_id = '${shop.merchantId}' LIMIT 1`)).toBe(
    shop.deviceId
  );

  expect(problems, `console errors: ${problems.join(" | ")}`).toEqual([]);
  expect(failed, `failed requests: ${failed.join(" | ")}`).toEqual([]);
});

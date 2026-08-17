/**
 * One account, one shop, one phone — established once per run (WEB-SYNC-004).
 *
 * Every test used to sign in for itself, which was honest and unworkable: the
 * API rate-limits code requests per address *and* per /24 of source address
 * (`LIMITS` in `email-otp.ts`), so a suite that signs in a dozen times exhausts
 * the bucket and then reads a `202` that delivered nothing. That limiter is
 * doing its job. The fix is to stop asking it for twelve codes.
 *
 * So this runs first, does the whole first-run journey through the real screens
 * exactly once, and saves the browser state every other test reuses:
 *
 *   sign in by email code → create a shop → register a phone for it
 *
 * Cookies and `localStorage` are carried over, which is what makes the session
 * and the active shop survive into each test. **IndexedDB is not** — Playwright
 * does not serialise it — and that is a feature here: every test opens with an
 * empty local book against a shop that already exists, which is precisely the
 * "new browser, existing shop" case, and it keeps tests from inheriting each
 * other's entries.
 */

import { test as setup, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  apiToken,
  createShop,
  merchantIdFor,
  registerDevice,
  signIn,
  uniqueEmail,
} from "./harness";
import { AUTH_STATE, SHOP_FILE } from "./shared";

setup("sign in, create a shop, and register a phone for it", async ({ page }) => {
  const email = uniqueEmail("suite");
  await signIn(page, email);

  const name = `E2E Suite ${Date.now().toString(36)}`;
  const shopId = await createShop(page, name);
  const merchantId = merchantIdFor(shopId);
  expect(merchantId).toMatch(/^[0-9a-f-]{36}$/);

  // ADR-0016: without a registered device this shop cannot be written to by
  // anybody, and every push would be a 409. This is the merchant opening Vyora
  // on their phone once.
  const token = await apiToken(email);
  const deviceId = await registerDevice(token);

  // The active shop is written by `enterShop` during the create flow; carrying
  // it over is what lets a reused session sync without choosing a shop again.
  const activeShop = await page.evaluate(() => localStorage.getItem("vyora.shop.v1"));
  expect(activeShop, "the create-shop flow must record the active shop").toBe(merchantId);

  mkdirSync(dirname(SHOP_FILE), { recursive: true });
  writeFileSync(SHOP_FILE, JSON.stringify({ email, shopId, merchantId, token, deviceId }, null, 2));
  await page.context().storageState({ path: AUTH_STATE });
});

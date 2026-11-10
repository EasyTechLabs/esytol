/**
 * The dedicated test administrator signs in to the real admin panel once.
 *
 * Made an administrator by one SQL row in the local test database — there is
 * no route for that, by design — then signed in through the panel's own email
 * code screens. The browser state Playwright saves holds the httpOnly session
 * cookie; it is written owner-only under the gitignored `.auth/` and never
 * printed.
 */

import { test as setup, expect } from "@playwright/test";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { codesDelivered, latestCode, lit, signIn, sql } from "./harness";

const STATE = join(__dirname, ".auth", "admin.json");

setup("the test administrator signs in to the admin panel", async ({ page, browser }) => {
  const admin = await signIn("pilot-admin");

  // A saved panel session is resumed while it lasts (eight hours), so the
  // per-address code limit is not spent on every run.
  if (existsSync(STATE)) {
    const saved = await browser.newContext({ storageState: STATE });
    const probe = await saved.newPage();
    await probe.goto("/udharpe/admin");
    const resumed = await probe
      .getByRole("button", { name: "Sign out" })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    await saved.close();
    if (resumed) return;
  }

  sql(
    `INSERT INTO platform_admins (person_id, reason)
     VALUES (${lit(admin.personId)}, 'pilot end-to-end test administrator (synthetic)')
     ON CONFLICT DO NOTHING`
  );

  await page.goto("/udharpe/admin");
  await page.getByPlaceholder("you@example.com").fill(admin.email);
  const seen = codesDelivered(admin.email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByPlaceholder("123456")).toBeVisible();
  await page.getByPlaceholder("123456").fill(await latestCode(admin.email, seen));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Udharpe administration" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  mkdirSync(join(__dirname, ".auth"), { recursive: true, mode: 0o700 });
  await page.context().storageState({ path: STATE });
  chmodSync(STATE, 0o600);
});

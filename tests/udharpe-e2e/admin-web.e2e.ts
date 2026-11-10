/**
 * The Udharpe admin panel, in a real browser, signed in as the test
 * administrator: review and decide applications, read the directory, and see
 * every decision in the audit trail.
 *
 * The applications reviewed here are synthetic. Their photographs are capture
 * rows written straight into the test database, as the API's own route tests
 * do, because the real ones can only come from a phone's camera. This proves
 * the review workflow and what it stores, never that a camera or a liveness
 * check worked — that is the physical checklist's.
 */

import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { call, lit, openShop, registerDevice, signIn, sql, type Who } from "./harness";

test.describe.configure({ mode: "serial" });

/** An applicant with an application waiting, made through the API route. */
async function applicant(
  label: string,
  shopName: string
): Promise<{ who: Who; applicationId: string }> {
  const who = await signIn(label);
  // Clear whatever this synthetic identity applied for on an earlier run.
  sql(`DELETE FROM shopkeeper_applications WHERE person_id = ${lit(who.personId)}`);
  const capture = (kind: "person" | "shop") => {
    const id = randomUUID();
    sql(
      `INSERT INTO liveness_captures
         (capture_id, person_id, kind, status, nonce, prompt, expires_at, storage_key)
       VALUES (${lit(id)}, ${lit(who.personId)}, '${kind}'::capture_kind, 'passed'::capture_status,
               ${lit(randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""))},
               'Synthetic — not a camera capture', now() + interval '5 minutes', ${lit(`captures/${id}.jpg`)})`
    );
    return id;
  };
  const res = await call(who, "POST", "/api/v1/applications", {
    data: {
      shopName,
      shopLocality: "Bengaluru GPO",
      ownerCaptureId: capture("person"),
      shopCaptureId: capture("shop"),
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { who, applicationId: res.body.applicationId };
}

async function openTab(page: Page, tab: string) {
  await page.goto("/udharpe/admin");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.getByRole("button", { name: tab, exact: true }).click();
}

const card = (page: Page, shopName: string) => page.locator("li").filter({ hasText: shopName });

const run = Date.now().toString(36);
const approveName = `Approve Kirana ${run}`;
const rejectName = `Reject Stores ${run}`;
let approved: { who: Who; applicationId: string };
let rejected: { who: Who; applicationId: string };

test("A1 a pending application is opened for review and approved; the applicant sees it", async ({
  page,
}) => {
  approved = await applicant("pilot-applicant-a", approveName);
  await openTab(page, "applications");
  await page.getByRole("button", { name: "pending", exact: true }).click();
  await card(page, approveName).getByRole("button", { name: "Open for review" }).click();
  // Wait for the queue to reload before switching (DEFECT P-6: a reload still
  // in flight overwrites the next tab's list).
  await expect(card(page, approveName)).toHaveCount(0);

  await page.getByRole("button", { name: "under review", exact: true }).click();
  await card(page, approveName).getByRole("button", { name: "Approve" }).click();
  await expect(card(page, approveName)).toHaveCount(0);
  await page.getByRole("button", { name: "approved", exact: true }).click();
  await expect(card(page, approveName)).toContainText("approved");

  const me = await call(approved.who, "GET", "/api/v1/applications/me");
  expect(me.status).toBe(200);
  expect(JSON.stringify(me.body)).toContain('"approved"');
  expect(
    sql(
      `SELECT status FROM shopkeeper_applications WHERE application_id = ${lit(approved.applicationId)}`
    )
  ).toBe("approved");
});

test("A2 rejecting asks for a reason, refuses without one, and shows the applicant the reason", async ({
  page,
}) => {
  rejected = await applicant("pilot-applicant-b", rejectName);
  await openTab(page, "applications");
  await card(page, rejectName).getByRole("button", { name: "Open for review" }).click();
  await expect(card(page, rejectName)).toHaveCount(0);
  await page.getByRole("button", { name: "under review", exact: true }).click();

  // Cancelled prompt: nothing is decided.
  page.once("dialog", (d) => void d.dismiss());
  await card(page, rejectName).getByRole("button", { name: "Reject" }).click();
  await expect(card(page, rejectName)).toContainText("under review");

  page.once(
    "dialog",
    (d) => void d.accept("Shopfront photo does not show a shop (synthetic test)")
  );
  await card(page, rejectName).getByRole("button", { name: "Reject" }).click();
  await expect(card(page, rejectName)).toHaveCount(0);
  await page.getByRole("button", { name: "rejected", exact: true }).click();
  await expect(card(page, rejectName)).toContainText("Shopfront photo does not show a shop");

  const me = await call(rejected.who, "GET", "/api/v1/applications/me");
  expect(JSON.stringify(me.body)).toContain("Shopfront photo does not show a shop");
});

test("A3 the directory lists shops, shopkeepers apart from customers, and relationships — with no money", async ({
  page,
}) => {
  // A shop with a linked customer, made by the routes the phones call.
  const owner = await signIn("pilot-dir-owner");
  await registerDevice(owner, "dir phone");
  const shop = await openShop(owner, `Directory Kirana ${run}`);
  const customer = await signIn("pilot-dir-customer");
  const asked = await call(customer, "POST", "/api/v1/relationships", {
    data: { shopPublicId: shop.shopId },
  });
  expect(asked.status).toBe(201);
  await call(owner, "POST", `/api/v1/relationships/${asked.body.relationshipId}/accept`, {
    shop,
    data: {},
  });

  await openTab(page, "directory");
  await page.getByPlaceholder("Name, email or code").fill(shop.name);
  await page.getByPlaceholder("Name, email or code").press("Enter");
  const shops = page.locator("table");
  await expect(shops).toContainText(shop.name);
  await expect(shops).toContainText(shop.shopId);
  await expect(page.locator("main main")).not.toContainText(/₹|balance|outstanding/i);

  await page.getByRole("button", { name: "people", exact: true }).click();
  await page.getByLabel("Role").selectOption("customer");
  await page.getByPlaceholder("Name, email or code").fill(customer.email);
  await page.getByPlaceholder("Name, email or code").press("Enter");
  await expect(page.locator("table")).toContainText(customer.email);
  await page.getByLabel("Role").selectOption("shopkeeper");
  await page.getByPlaceholder("Name, email or code").press("Enter");
  await expect(page.locator("table")).not.toContainText(customer.email);

  await page.getByRole("button", { name: "relationships", exact: true }).click();
  await page.getByPlaceholder("Name, email or code").fill(shop.name);
  await page.getByPlaceholder("Name, email or code").press("Enter");
  await expect(page.locator("table")).toContainText(shop.name);
  await expect(page.locator("table")).toContainText(/active/i);
});

test("A4 every decision and every directory view is in the audit trail", async ({ page }) => {
  await openTab(page, "audit");
  await expect(page.locator("table")).toBeVisible();
  for (const id of [approved.applicationId, rejected.applicationId]) {
    const actions = sql(
      `SELECT string_agg(action, ',' ORDER BY at) FROM audit_events WHERE object_id = ${lit(id)} AND actor_is_admin`
    );
    expect(actions, id).toMatch(/open/);
    expect(actions, id).toMatch(/approve|reject/);
  }
  expect(
    Number(
      sql(
        `SELECT count(*) FROM audit_events WHERE action = 'admin.directory.viewed' AND at > now() - interval '10 minutes'`
      )
    )
  ).toBeGreaterThan(0);
});

test("A5 the panel's forwarder refuses an admin path off its allowlist, and the API refuses a non-admin", async ({
  page,
}) => {
  const off = await page.request.get("/api/udharpe-admin/../v1/sync/pull");
  expect(off.status()).toBeGreaterThanOrEqual(400);
  const notAdmin = await signIn("pilot-dir-customer");
  expect((await call(notAdmin, "GET", "/api/v1/admin/applications?status=pending")).status).toBe(
    403
  );
});

test("A6 a saved session is resumed on reload; a browser without one is asked to sign in", async ({
  page,
  browser,
}) => {
  await page.goto("/udharpe/admin");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  const stranger = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fresh = await stranger.newPage();
  await fresh.goto("/udharpe/admin");
  await expect(fresh.getByRole("button", { name: "Send me a code" })).toBeVisible();
  await expect(fresh.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await stranger.close();
});

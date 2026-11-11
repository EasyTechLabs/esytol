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
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

/**
 * A 48×32 gradient made by a script — a synthetic test image, never a camera
 * capture. Used only to show the panel fetches and renders what the API
 * returns; real-camera evidence is the physical checklist's.
 */
const SYNTHETIC_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAMKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAwAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAA//aAAwDAQACEQMRAD8A+SINK9q2INK9q7ODSv8AZrYg0r2r9MrZn5nz2W5xtqcXBpX+zWxBpX+zXaQaV7VrwaV7V4lbM/M/UMtzjbU4yDSv9mtiDSv9muzg0r/ZrYg0r/ZrxK2Z+Z+oZbnG2p//0Oeg0r/ZrYg0r/Zrs4NK/wBmtiDSv9muatmfmfznlucbanGQaV/s1sQaV7V2cGlf7NbEGlf7NeJWzPzP1DLc421OMg0r2rXg0r2rtINK/wBmtiDSvavErZn5n6hlucban//Z",
  "base64"
);

test("A7 the reviewer sees both photographs only on asking, through the panel's own route", async ({
  page,
}) => {
  // Where the local API keeps captures. Without it the bytes cannot be placed,
  // and this test says so rather than passing on nothing.
  const root = process.env.UDHARPE_E2E_CAPTURE_ROOT;
  test.skip(!root, "UDHARPE_E2E_CAPTURE_ROOT is not set");

  const shopName = `Photo Kirana ${run}`;
  const who = await signIn("pilot-applicant-photos");
  sql(`DELETE FROM shopkeeper_applications WHERE person_id = ${lit(who.personId)}`);
  const ids: Record<"person" | "shop", string> = { person: randomUUID(), shop: randomUUID() };
  for (const kind of ["person", "shop"] as const) {
    const id = ids[kind];
    const key = `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.jpg`;
    mkdirSync(dirname(join(root!, key)), { recursive: true });
    writeFileSync(join(root!, key), SYNTHETIC_JPEG, { mode: 0o600 });
    sql(
      `INSERT INTO liveness_captures (capture_id, person_id, kind, status, nonce, prompt, expires_at, storage_key)
       VALUES (${lit(id)}, ${lit(who.personId)}, '${kind}'::capture_kind, 'passed'::capture_status,
               ${lit(randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""))},
               'Synthetic — not a camera capture', now() + interval '5 minutes', ${lit(key)})`
    );
  }
  const res = await call(who, "POST", "/api/v1/applications", {
    data: {
      shopName,
      shopLocality: "Bengaluru GPO",
      ownerCaptureId: ids.person,
      shopCaptureId: ids.shop,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const applicationId = res.body.applicationId as string;

  const fetched: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/photos/")) fetched.push(new URL(r.url()).pathname);
  });

  await openTab(page, "applications");
  await page.getByRole("button", { name: "pending", exact: true }).click();
  const item = card(page, shopName);
  await expect(item).toBeVisible();
  // Nothing fetched, nothing shown, until the reviewer asks.
  await expect(item.locator("img")).toHaveCount(0);
  expect(fetched).toEqual([]);

  await item.getByRole("button", { name: "Show photos" }).click();
  for (const alt of ["Photo of the applicant", "Photo of the shop"]) {
    const img = item.getByRole("img", { name: alt });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBe(48);
    // Same-origin, through the panel's server route — never the API or storage.
    expect(await img.getAttribute("src")).toMatch(
      /^\/api\/udharpe-admin\/applications\/[0-9a-f-]{36}\/photos\/(owner|shop)$/
    );
  }
  expect([...new Set(fetched)].sort()).toEqual([
    `/api/udharpe-admin/applications/${applicationId}/photos/owner`,
    `/api/udharpe-admin/applications/${applicationId}/photos/shop`,
  ]);

  // Every view is on the record, against the application.
  expect(
    Number(
      sql(
        `SELECT count(DISTINCT detail->>'which') FROM audit_events
          WHERE action = 'shopkeeper_application.photo.viewed' AND object_id::text = ${lit(applicationId)} AND actor_is_admin`
      )
    )
  ).toBe(2);

  // And a browser without the admin session gets nothing.
  const stranger = await page
    .context()
    .browser()!
    .newContext({ storageState: { cookies: [], origins: [] } });
  const anon = await stranger.request.get(
    new URL(`/api/udharpe-admin/applications/${applicationId}/photos/owner`, page.url()).toString()
  );
  expect(anon.status()).toBeGreaterThanOrEqual(400);
  expect(anon.headers()["content-type"] ?? "").not.toMatch(/image/);
  await stranger.close();
});

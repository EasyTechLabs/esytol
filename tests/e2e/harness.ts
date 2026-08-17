/**
 * What a real browser needs to reach a real shop (WEB-SYNC-004).
 *
 * Everything here drives the application the way a person does, or the API the
 * way a phone does. Nothing stubs a browser capability, and nothing weakens a
 * security control to make a test easier:
 *
 *  - the session is established by the real email-code flow, through the real
 *    screen, and ends up in the same `httpOnly` cookie a merchant gets;
 *  - the six-digit code is read from the **development mailer's log**, which is
 *    the mechanism already in the repository for exactly this (`createDevMailer`
 *    writes it "to the inbox and to the application log"). No test-only bypass
 *    was added to the API to make this possible;
 *  - PostgreSQL is inspected with `psql`, so "the event is in the database" is a
 *    statement about the database rather than about what the API said.
 *
 * ## Why a device is registered out of band
 *
 * ADR-0016: a shop with no registered device cannot be written to *by any
 * client*, browser included — `requireDevice` refuses with `409
 * NO_DEVICE_REGISTERED`. A shop created entirely in a browser therefore has
 * nothing to attribute events to until somebody opens Vyora on a phone once.
 *
 * `registerDevice` is that phone. It uses the ordinary `POST /api/v1/devices`
 * with the person's own bearer token — the same call the Android app makes on
 * launch — so the precondition is met the way it is met in life, not by
 * inserting a row.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { API_URL } from "../../playwright.config";

/** Where the API's stdout was redirected. The dev mailer writes codes here. */
const API_LOG =
  process.env.VYORA_E2E_API_LOG ??
  "C:/Users/dell/AppData/Local/Temp/claude/g--my-ai-pro/226e2c92-b3bc-4bb0-ab74-4308684ebcde/scratchpad/api.log";

const PSQL = process.env.VYORA_E2E_PSQL ?? "C:/Users/dell/pgsql16/bin/psql.exe";
const PGURL = process.env.VYORA_E2E_PGURL ?? "postgres://postgres:postgres@127.0.0.1:55432/vyora";

/** One scalar out of PostgreSQL, so a claim about storage is checked at storage. */
export function sql(query: string): string {
  return execFileSync(PSQL, ["-d", PGURL, "-t", "-A", "-c", query], {
    encoding: "utf8",
    timeout: 30_000,
  }).trim();
}

/**
 * The most recent code the development mailer delivered to this address.
 *
 * Read from the log rather than the in-process inbox, which no route exposes —
 * deliberately, since an HTTP endpoint that hands out login codes is a thing
 * that could escape a developer's machine.
 */
export async function latestCode(email: string): Promise<string> {
  // Polled, because the API answers `202` before its log line has necessarily
  // reached the file. This waits for a write that has already been ordered —
  // it is not a timeout raised to let a failing assertion pass.
  const deadline = Date.now() + 15_000;
  for (;;) {
    const lines = readFileSync(API_LOG, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("[dev-mail]") && line.includes(email));
    const last = lines[lines.length - 1];
    const code = last?.match(/(\d{6})\s*$/)?.[1];
    if (code) return code;
    if (Date.now() > deadline) {
      throw new Error(`No code was delivered to ${email}. Is the API log at ${API_LOG}?`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@synthetic.local`;
}

/** Sign in through the real screen, and wait until the app agrees. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/vyora/shop");
  await page.getByTestId("signin-email-input").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByTestId("signin-email-input").fill(email);
  await page.getByTestId("signin-request").click();

  await page.getByTestId("signin-code-input").waitFor({ state: "visible" });
  // Requested by the click above; read after the screen advanced, so the code
  // is the one that request produced.
  await page.getByTestId("signin-code-input").fill(await latestCode(email));
  await page.getByTestId("signin-verify").click();

  // Either the shop list or the create form — both mean the session exists.
  await expect(page.getByTestId("create-shop-name").or(page.getByTestId("shop-list"))).toBeVisible({
    timeout: 30_000,
  });
}

/** Create a shop through the real form. Returns its public code. */
export async function createShop(page: Page, name: string): Promise<string> {
  if (
    !(await page
      .getByTestId("create-shop-name")
      .isVisible()
      .catch(() => false))
  ) {
    await page.goto("/vyora/shop");
  }
  await page.getByTestId("create-shop-name").fill(name);
  await page.getByTestId("create-shop-address").fill("1 Test Road");
  await page.getByTestId("create-shop-pincode").fill("560001");
  await page.getByTestId("create-shop-locality").fill("Bengaluru GPO");
  await page.getByTestId("create-shop-submit").click();

  // The "done" card shows the shop's name once it exists and was selected.
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });

  const shopId = sql(
    `SELECT public_id FROM merchants WHERE display_name = '${name.replace(/'/g, "''")}'`
  );
  if (!shopId) throw new Error(`Shop ${name} has no public id`);
  return shopId;
}

/** The merchant id behind a public shop code. */
export function merchantIdFor(shopId: string): string {
  return sql(`SELECT merchant_id FROM merchants WHERE public_id = '${shopId}'`);
}

/**
 * A bearer token for this person, the way the phone gets one.
 *
 * Separate from the browser's session on purpose: they are two clients of one
 * account, which is exactly the situation being tested.
 */
export async function apiToken(email: string): Promise<string> {
  const request = await fetch(`${API_URL}/api/v1/auth/email/request-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (request.status !== 202) throw new Error(`request-code answered ${request.status}`);

  const verify = await fetch(`${API_URL}/api/v1/auth/email/verify-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: await latestCode(email) }),
  });
  if (!verify.ok) throw new Error(`verify-code answered ${verify.status}`);
  const body = (await verify.json()) as { session?: { token?: string }; token?: string };
  const token = body.session?.token ?? body.token;
  if (!token) throw new Error(`No token in verify-code response: ${JSON.stringify(body)}`);
  return token;
}

/**
 * Register a device for this account — "the merchant opened Vyora on a phone".
 *
 * The ordinary route with an ordinary installation key. Without this a
 * browser-only shop cannot be written to at all, which is ADR-0016 working
 * rather than a problem to route around.
 */
export async function registerDevice(token: string, label = "E2E phone"): Promise<string> {
  const key = Buffer.from(
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
  ).toString("base64url");

  const res = await fetch(`${API_URL}/api/v1/devices`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ installationKey: key, label }),
  });
  if (!res.ok) throw new Error(`device registration answered ${res.status}`);
  const device = (await res.json()) as { deviceId: string };
  return device.deviceId;
}

export interface Shop {
  readonly email: string;
  readonly shopId: string;
  readonly merchantId: string;
  readonly token: string;
  readonly deviceId: string;
}

/**
 * A signed-in browser, in a new shop that has a phone registered to it.
 *
 * The device is the ADR-0016 precondition, not a convenience: without one the
 * shop cannot be written to by anybody, and every push would be a `409`.
 */
export async function openShopWithDevice(page: Page, label: string): Promise<Shop> {
  const email = uniqueEmail(label);
  await signIn(page, email);
  const name = `${label} ${Date.now().toString(36)}`;
  const shopId = await createShop(page, name);
  const token = await apiToken(email);
  const deviceId = await registerDevice(token);
  return { email, shopId, merchantId: merchantIdFor(shopId), token, deviceId };
}

/** How many events PostgreSQL holds for this shop. */
export function eventCount(merchantId: string): number {
  return Number(sql(`SELECT count(*) FROM events WHERE merchant_id = '${merchantId}'`));
}

/** Read the merchant-facing sync tone the UI is currently showing. */
export async function syncTone(page: Page): Promise<string | null> {
  const bar = page.getByTestId("vyora-sync-status");
  if (!(await bar.isVisible().catch(() => false))) return null;
  return bar.getAttribute("data-tone");
}

/** Record a credit through the real capture screen. */
export async function recordCredit(page: Page, name: string, amount: number): Promise<void> {
  await page.goto("/vyora/credit");
  await page.getByLabel("Amount in rupees").fill(String(amount));
  await page.getByPlaceholder("Name…").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // Capture navigates back to the dashboard once the entry is durable.
  await page.waitForURL("**/vyora", { timeout: 30_000 });
}

/**
 * Assert a contact is on the screen, on the screen that lists contacts.
 *
 * The dashboard shows totals rather than names, so "is it there" is asked where
 * a merchant would ask it.
 */
export async function expectParty(page: Page, name: string): Promise<void> {
  await page.goto("/vyora/parties");
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
}

/** Everything this browser has stored, read from inside the page. */
export async function indexedDbState(
  page: Page
): Promise<{ events: number; pending: number; cursor: unknown; names: string[] }> {
  return page.evaluate(async () => {
    const open = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("vyora");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const db = await open();
    const all = <T>(store: string, index?: string): Promise<T[]> =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const src = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
        const req = src.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });

    const rows = await all<{ state: string; event: { type: string; party?: { name: string } } }>(
      "events"
    );
    const meta = await all<{ key: string; value: unknown }>("meta");
    return {
      events: rows.length,
      pending: rows.filter((r) => r.state === "pending").length,
      cursor: meta.find((m) => m.key === "cursor")?.value ?? null,
      names: rows
        .filter((r) => r.event.type === "ContactCreated")
        .map((r) => r.event.party?.name ?? ""),
    };
  });
}

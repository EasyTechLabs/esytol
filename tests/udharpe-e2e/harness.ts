/**
 * The pilot end-to-end harness: real identities against a running local API.
 *
 * Nothing here writes a session, a link or a consent behind the API's back.
 * People sign in by the real email-code flow — the code read from the
 * development mailer's log, as `tests/e2e/harness.ts` does — and every
 * shop, relationship, list, proposal and payment is made by the route a phone
 * or browser calls. SQL is used for two things only: making the dedicated test
 * administrator one (there is no route for that, by design), and reading
 * storage to check a claim the API made about it.
 *
 * It refuses to run against anything but loopback, so it can never write a
 * ledger record anywhere real.
 */

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, request as pwRequest, type APIRequestContext } from "@playwright/test";

export const API_URL = process.env.UDHARPE_E2E_API ?? "http://127.0.0.1:4000";
export const WEB_URL = process.env.UDHARPE_E2E_WEB ?? "http://127.0.0.1:3000";
const API_LOG = process.env.UDHARPE_E2E_API_LOG ?? join(tmpdir(), "api.log");
const PG_CONTAINER = process.env.UDHARPE_E2E_PG_CONTAINER ?? "udharpe-pg16";
const PG_DB = process.env.UDHARPE_E2E_PG_DB ?? "vyora_e2e";

for (const url of [API_URL, WEB_URL]) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`The pilot suite only runs against loopback, not ${url}.`);
  }
}

/** One scalar (or one row, `|`-separated) out of the test database. */
export function sql(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      PG_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      PG_DB,
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    { encoding: "utf8", timeout: 30_000 }
  ).trim();
}

/** Like `sql`, but returns the error text instead of throwing. */
export function sqlError(query: string): string | null {
  try {
    sql(query);
    return null;
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
}

export const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}@synthetic.local`;
}

const mailTo = (email: string) =>
  readFileSync(API_LOG, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("[dev-mail]") && line.includes(email));

/** How many codes have been delivered to this address so far. */
export const codesDelivered = (email: string) => mailTo(email).length;

/**
 * The most recent code the development mailer delivered to this address,
 * waiting until more than `seen` have been — so a code asked for a moment ago
 * is never confused with an older, already used one.
 */
export async function latestCode(email: string, seen = 0): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const lines = mailTo(email);
    const code = lines.length > seen ? lines.at(-1)?.match(/(\d{6})\s*$/)?.[1] : undefined;
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code was delivered to ${email}. Is the API log at ${API_LOG}?`);
}

export interface Who {
  readonly label: string;
  readonly email: string;
  readonly token: string;
  readonly personId: string;
  readonly api: APIRequestContext;
}

export interface Res {
  readonly status: number;
  // Answers are read field by field in the assertions, against the contract.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly body: any;
}

/**
 * Sessions of the synthetic identities, kept between runs.
 *
 * The API rate-limits code requests per address and per network, and a suite
 * that signs five people in on every run soon reads a 202 that delivered
 * nothing — the limiter doing its job. So each identity signs in once, by the
 * real flow, and its session is reused until it stops working. Gitignored,
 * owner-only, never printed.
 */
const AUTH_DIR = join(__dirname, ".auth");
const IDENTITIES = join(AUTH_DIR, "identities.json");

function savedIdentities(): Record<string, { email: string; token: string }> {
  if (!existsSync(IDENTITIES)) return {};
  return JSON.parse(readFileSync(IDENTITIES, "utf8"));
}

function saveIdentity(label: string, email: string, token: string): void {
  mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  const all = { ...savedIdentities(), [label]: { email, token } };
  writeFileSync(IDENTITIES, JSON.stringify(all, null, 2), { mode: 0o600 });
  chmodSync(IDENTITIES, 0o600);
}

async function asWho(label: string, email: string, token: string): Promise<Who | null> {
  const api = await pwRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { authorization: `Bearer ${token}` },
  });
  if ((await api.get("/api/v1/me")).status() !== 200) {
    await api.dispose();
    return null;
  }
  const personId = sql(`SELECT person_id FROM person_accounts WHERE email = ${lit(email)}`);
  expect(personId).toMatch(/^[0-9a-f-]{36}$/);
  return { label, email, token, personId, api };
}

/** Sign in by email code, exactly as the phone does — once per identity. */
export async function signIn(label: string): Promise<Who> {
  const saved = savedIdentities()[label];
  if (saved) {
    const who = await asWho(label, saved.email, saved.token);
    if (who) return who;
  }
  const email = uniqueEmail(label.toLowerCase());
  const anon = await pwRequest.newContext({ baseURL: API_URL });
  const asked = await anon.post("/api/v1/auth/email/request-code", { data: { email } });
  expect(asked.status(), "request-code").toBe(202);
  const verified = await anon.post("/api/v1/auth/email/verify-code", {
    data: { email, code: await latestCode(email) },
  });
  expect(verified.ok(), `verify-code ${verified.status()}`).toBe(true);
  const body = await verified.json();
  const token: string = body.session?.token ?? body.token;
  await anon.dispose();
  saveIdentity(label, email, token);
  return (await asWho(label, email, token))!;
}

/** "Opened the app on a phone": the ordinary device registration. */
export async function registerDevice(who: Who, label: string): Promise<string> {
  const res = await who.api.post("/api/v1/devices", {
    data: { installationKey: randomBytes(32).toString("base64url"), label },
  });
  expect(res.ok(), `device registration ${res.status()}`).toBe(true);
  return (await res.json()).deviceId;
}

export interface Shop {
  readonly merchantId: string;
  readonly shopId: string;
  readonly name: string;
}

export async function openShop(who: Who, name: string): Promise<Shop> {
  const res = await who.api.post("/api/v1/shops", {
    data: {
      name,
      addressLine: "14 Synthetic Road",
      pincode: "560001",
      localitySuggested: "Bengaluru GPO",
      localityConfirmed: "Bengaluru GPO",
    },
  });
  expect(res.status(), "open shop").toBe(201);
  const body = await res.json();
  return { merchantId: body.merchantId, shopId: body.shopId, name };
}

type Opts = { shop?: Shop; key?: string | false; data?: unknown; timeout?: number };

/** One request, with the shop header and a fresh idempotency key unless told otherwise. */
export async function call(
  who: Who | APIRequestContext,
  method: string,
  path: string,
  opts: Opts = {}
): Promise<Res> {
  const api = "api" in who ? who.api : who;
  const headers: Record<string, string> = {};
  if (opts.shop) headers["x-vyora-shop"] = opts.shop.merchantId;
  if (opts.key !== false && method !== "GET") headers["idempotency-key"] = opts.key ?? randomUUID();
  const res = await api.fetch(path, { method, headers, data: opts.data, timeout: opts.timeout });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  return { status: res.status(), body };
}

export async function netOf(shopkeeper: Who, shop: Shop, partyId: string): Promise<number> {
  const res = await call(shopkeeper, "GET", `/api/v1/parties/${partyId}/summary`, { shop });
  expect(res.status, "summary").toBe(200);
  return Number(res.body.balance.net);
}

export async function outstandingFor(customer: Who, shop: Shop): Promise<number> {
  const res = await call(customer, "GET", `/api/v1/shops/${shop.shopId}/outstanding`);
  expect(res.status, "outstanding").toBe(200);
  return Number(res.body.total);
}

export const count = (query: string) => Number(sql(query));

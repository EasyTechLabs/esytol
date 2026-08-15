/**
 * What sync must never do.
 *
 * Two halves. The first is the forwarder: the gate is re-evaluated on the
 * server, a missing session is refused there, and the token never appears in
 * anything the browser can read. The second is the local store: no credential
 * is written into IndexedDB, and signing out or changing shop leaves nothing
 * behind for the next person.
 *
 * The tenancy guarantees themselves — that a browser cannot pull or push
 * another shop's log — belong to the API and are proven in its own suite
 * (`tests/sync-attribution.test.ts`, cases G and L), against a real database
 * with real memberships. Re-asserting them here against a fake would prove only
 * that the fake agrees with itself.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { freshDatabase } from "./sync-harness";
import { appendLocal, clearAll, countEvents, readMeta, writeMeta } from "@/lib/vyora/sync/store";
import { createContactCreated } from "@/lib/vyora/events";
import { PULL_PATH, PUSH_PATH } from "@/lib/vyora/sync/client";

const ORIGINAL = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const key of ["NEXT_PUBLIC_VYORA_API_URL", "NODE_ENV"]) {
    delete (process.env as Record<string, string | undefined>)[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) (process.env as Record<string, string>)[key] = value;
  }
}

/** Re-imported per case so the module reads the environment just set. */
async function loadForwarder(cookieValue: string | undefined) {
  vi.resetModules();
  vi.doMock("next/headers", () => ({
    cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
  }));
  return import("@/app/api/vyora-sync/forward");
}

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/vyora-sync/push", { headers });

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.doUnmock("next/headers");
  Object.assign(process.env, ORIGINAL);
});

describe("the sync forwarder", () => {
  it("does not exist in a production build", async () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000" });
    const { forwardSync } = await loadForwarder("a-session-token");

    const response = await forwardSync("GET", "/api/v1/sync/pull", req({ "x-vyora-shop": "s1" }));

    // 404 rather than 403: as far as any caller is concerned this endpoint is
    // not here, and saying otherwise advertises it.
    expect(response.status).toBe(404);
  });

  it("refuses an API URL that is not loopback", async () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_VYORA_API_URL: "https://api.example.com" });
    const { forwardSync } = await loadForwarder("a-session-token");

    const response = await forwardSync("GET", "/api/v1/sync/pull", req({ "x-vyora-shop": "s1" }));

    expect(response.status).toBe(404);
  });

  it("answers 401 itself when there is no session, without asking upstream", async () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { forwardSync } = await loadForwarder(undefined);

    const response = await forwardSync("GET", "/api/v1/sync/pull", req({ "x-vyora-shop": "s1" }));

    expect(response.status).toBe(401);
    // "You are signed out" and "the server rejected your token" become one
    // answer the client has a single branch for — and no round trip.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("refuses a request that names no shop", async () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000" });
    const { forwardSync } = await loadForwarder("a-session-token");

    const response = await forwardSync("GET", "/api/v1/sync/pull", req());

    expect(response.status).toBe(400);
  });

  it("never returns the session token to the browser", async () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000" });
    const secret = "super-secret-session-token";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"events":[]}', { status: 200 }));
    const { forwardSync } = await loadForwarder(secret);

    const response = await forwardSync("GET", "/api/v1/sync/pull", req({ "x-vyora-shop": "s1" }));
    const body = await response.text();

    expect(body).not.toContain(secret);
    for (const [, value] of response.headers.entries()) expect(value).not.toContain(secret);

    // It went upstream, in an Authorization header this server added.
    const sent = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect((sent.headers as Record<string, string>).authorization).toBe(`Bearer ${secret}`);
    fetchSpy.mockRestore();
  });

  it("reports an unreachable API as retryable, not as a rejection", async () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const { forwardSync } = await loadForwarder("a-session-token");

    const response = await forwardSync("GET", "/api/v1/sync/pull", req({ "x-vyora-shop": "s1" }));

    // 502, so the sync engine backs off and leaves the queue alone. A 4xx here
    // would read as "the server refused your work".
    expect(response.status).toBe(502);
    fetchSpy.mockRestore();
  });
});

describe("what the browser stores", () => {
  it("goes through this app's own server, never straight to the API", async () => {
    // If these ever became absolute API URLs, the session cookie would have to
    // be readable by script for them to work — which is the thing the whole
    // design exists to avoid.
    expect(PUSH_PATH.startsWith("/")).toBe(true);
    expect(PULL_PATH.startsWith("/")).toBe(true);
  });

  it("writes no credential into IndexedDB", async () => {
    const db = await freshDatabase();
    await appendLocal(db, createContactCreated({ name: "Ramesh", phone: "9876543210" }));
    await writeMeta(db, "cursor", "an-opaque-cursor");

    const dumped = await new Promise<string>((resolve, reject) => {
      const tx = db.transaction(["events", "meta"], "readonly");
      const events = tx.objectStore("events").getAll();
      const meta = tx.objectStore("meta").getAll();
      tx.oncomplete = () => resolve(JSON.stringify({ events: events.result, meta: meta.result }));
      tx.onerror = () => reject(tx.error);
    });

    // The ledger is the merchant's own data and belongs here. A token, a
    // device key or an installation key does not — and the browser holds none
    // of them to write (ADR-0016).
    expect(dumped).not.toMatch(/token|bearer|authorization|installationKey|deviceId/i);
  });

  it("leaves nothing for the next person on sign-out", async () => {
    const db = await freshDatabase();
    await appendLocal(db, createContactCreated({ name: "Previous merchant" }));
    await writeMeta(db, "cursor", "their-position");

    await clearAll(db);

    expect(await countEvents(db)).toBe(0);
    // A cursor belongs to one shop's log. Keeping it would have the next
    // person's first pull start from where the last one got to — and skip
    // everything before it, permanently.
    expect(await readMeta<string>(db, "cursor")).toBeNull();
  });
});

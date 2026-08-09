/**
 * The API client, the configuration gate, and contract drift.
 *
 * The classification tests are the important ones. The outbox decides whether
 * to retry, park or clear a row entirely on the basis of these three outcomes,
 * so getting one wrong means either a merchant's entry retries forever against
 * a refusal, or gets parked over a dropped connection and never sent at all.
 */

import { describe, expect, it } from "@jest/globals";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApiClient, IDENTITY_HEADER } from "../src/api/client";
import { decideApi, defaultBaseUrl, isLocalHost, ANDROID_EMULATOR_HOST } from "../src/api/config";
import { OPERATIONS } from "../src/api/contract.generated";

const config = { baseUrl: "http://127.0.0.1:4000", identity: "synthetic-fixture" };

function respondWith(status: number, body: unknown) {
  return async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
}

describe("every failure is classified into something the outbox can act on", () => {
  it("treats an accepted write as ok", async () => {
    const client = createApiClient(config, respondWith(201, { id: "txn_1" }) as typeof fetch);
    const result = await client.recordCredit("pty_1", { amount: 100 }, { idempotencyKey: "k" });
    expect(result.kind).toBe("ok");
  });

  it("treats an idempotent replay as ok — it is a success that happened twice", async () => {
    // The server replays the stored response verbatim, 201 included.
    const client = createApiClient(config, respondWith(201, { id: "txn_1" }) as typeof fetch);
    const result = await client.recordCredit("pty_1", { amount: 100 }, { idempotencyKey: "k" });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.status).toBe(201);
  });

  it("treats no connection as retryable, because nothing was decided", async () => {
    const client = createApiClient(config, (async () => {
      throw new Error("Network request failed");
    }) as unknown as typeof fetch);
    const result = await client.recordCredit("pty_1", {}, { idempotencyKey: "k" });
    expect(result.kind).toBe("retry");
  });

  it("treats 5xx, 408 and 429 as retryable", async () => {
    for (const status of [500, 502, 503, 408, 429]) {
      const client = createApiClient(config, respondWith(status, {}) as typeof fetch);
      const result = await client.recordCredit("pty_1", {}, { idempotencyKey: "k" });
      expect(result.kind).toBe("retry");
    }
  });

  it("treats 400, 404 and 422 as permanent — the server has decided", async () => {
    for (const status of [400, 404, 422]) {
      const client = createApiClient(
        config,
        respondWith(status, { error: { code: "NOT_FOUND", message: "no" } }) as typeof fetch
      );
      const result = await client.recordCredit("pty_1", {}, { idempotencyKey: "k" });
      expect(result.kind).toBe("permanent");
    }
  });

  it("treats 409 as permanent, so the app never 'fixes' it by minting a new id", async () => {
    // A 409 means this entry id exists with different content. Retrying with a
    // fresh id would record the merchant's action twice.
    const client = createApiClient(
      config,
      respondWith(409, {
        error: { code: "RESOURCE_ALREADY_EXISTS", message: "Entry exists with different content." },
      }) as typeof fetch
    );
    const result = await client.recordCredit("pty_1", {}, { idempotencyKey: "k" });
    expect(result.kind).toBe("permanent");
    if (result.kind === "permanent") expect(result.code).toBe("RESOURCE_ALREADY_EXISTS");
  });

  it("surfaces the server's error code rather than a bare status", async () => {
    const client = createApiClient(
      config,
      respondWith(422, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request body failed contract validation.",
          details: [{ message: "amount must be > 0" }],
        },
      }) as typeof fetch
    );
    const result = await client.recordCredit("pty_1", {}, { idempotencyKey: "k" });
    if (result.kind !== "permanent") throw new Error("expected permanent");
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(result.message).toContain("amount must be > 0");
  });
});

describe("what the client puts on the wire", () => {
  it("sends the identity header and the idempotency key, and never a merchantId", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const client = createApiClient(config, (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response("{}", { status: 201, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch);

    await client.recordPayment(
      "pty_1",
      { id: "pay_1", amount: 500, kind: "received", date: "2026-08-09" },
      { idempotencyKey: "11111111-2222-4333-8444-555555555555" }
    );

    const call = seen as unknown as { url: string; init: RequestInit };
    expect(call.url).toBe("http://127.0.0.1:4000/api/v1/parties/pty_1/payments");
    const headers = call.init.headers as Record<string, string>;
    expect(headers[IDENTITY_HEADER]).toBe("synthetic-fixture");
    expect(headers["idempotency-key"]).toBe("11111111-2222-4333-8444-555555555555");
    expect(JSON.parse(String(call.init.body))).not.toHaveProperty("merchantId");
  });

  it("uses the contract's own paths", () => {
    expect(OPERATIONS.recordPayment.path).toBe("/api/v1/parties/{partyId}/payments");
    expect(OPERATIONS.getPartyLedgerSummary.path).toBe("/api/v1/parties/{partyId}/summary");
  });
});

describe("the configuration gate", () => {
  it("refuses everything in a release build, whatever is configured", () => {
    const decision = decideApi({
      isDev: false,
      baseUrl: "http://127.0.0.1:4000",
      identity: "anything",
    });
    expect(decision.enabled).toBe(false);
    if (!decision.enabled) expect(decision.reason).toContain("release build");
  });

  it("refuses a public host", () => {
    const decision = decideApi({ isDev: true, baseUrl: "https://api.example.com", identity: "x" });
    expect(decision.enabled).toBe(false);
  });

  it("accepts loopback, the emulator host alias and private ranges", () => {
    for (const host of ["127.0.0.1", "localhost", ANDROID_EMULATOR_HOST, "192.168.1.7", "172.16.0.3"]) {
      expect(isLocalHost(host)).toBe(true);
    }
    for (const host of ["8.8.8.8", "example.com", "172.32.0.1", "11.0.0.1"]) {
      expect(isLocalHost(host)).toBe(false);
    }
  });

  it("refuses when no identity has been configured", () => {
    const decision = decideApi({ isDev: true, baseUrl: "http://127.0.0.1:4000" });
    expect(decision.enabled).toBe(false);
  });

  it("points Android at the emulator's host alias, not at the emulator itself", () => {
    // 127.0.0.1 inside an emulator is the emulator. Getting this wrong produces
    // a timeout indistinguishable from the server being down.
    expect(defaultBaseUrl("android")).toBe(`http://${ANDROID_EMULATOR_HOST}:4000`);
    expect(defaultBaseUrl("ios")).toBe("http://127.0.0.1:4000");
  });
});

describe("generated types track the contract", () => {
  it("is not stale", () => {
    // Re-runs the generator and compares. A server-side contract change that
    // the mobile client has not picked up fails here, in the repository,
    // rather than as a rejected write on a merchant's phone.
    const root = join(__dirname, "..");
    expect(() =>
      execFileSync(process.execPath, ["scripts/generate-api-types.mjs", "--check"], {
        cwd: root,
        stdio: "pipe",
      })
    ).not.toThrow();
  });

  it("carries no hand-written wire shapes alongside it", () => {
    const client = readFileSync(join(__dirname, "..", "src", "api", "client.ts"), "utf8");
    // Response types must be imported, never redeclared.
    expect(client).not.toMatch(/interface\s+(LedgerEntry|PartyStatement|PartyLedgerSummary)\b/);
    expect(client).toContain('from "./contract.generated"');
  });
});

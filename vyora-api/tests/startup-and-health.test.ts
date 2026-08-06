/**
 * Startup safety gates, health, migrations, and the error envelope.
 *
 * The development-identity gate is tested because a control nobody tests is a
 * control nobody has.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { loadConfig, StartupError, isLocalDatabaseUrl } from "../src/config.js";
import { call, startHarness, TEST_DATABASE_URL, type Harness, type Res } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

describe("development identity safety gate", () => {
  it("refuses to start when dev auth is enabled under NODE_ENV=production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        VYORA_DEV_AUTH: "true",
        DATABASE_URL: TEST_DATABASE_URL,
      } as NodeJS.ProcessEnv)
    ).toThrow(StartupError);
  });

  it("starts in production when dev auth is off", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        VYORA_DEV_AUTH: "false",
        DATABASE_URL: TEST_DATABASE_URL,
      } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it("refuses a remote database URL", () => {
    expect(isLocalDatabaseUrl("postgres://u:p@db.example.com:5432/vyora")).toBe(false);
    expect(isLocalDatabaseUrl("postgres://u:p@127.0.0.1:55432/vyora")).toBe(true);
    expect(() =>
      loadConfig({
        NODE_ENV: "development",
        DATABASE_URL: "postgres://u:p@db.example.com:5432/vyora",
      } as NodeJS.ProcessEnv)
    ).toThrow(StartupError);
  });

  it("does not leak the connection string when refusing", () => {
    try {
      loadConfig({
        NODE_ENV: "development",
        DATABASE_URL: "postgres://user:sup3rsecret@db.example.com:5432/vyora",
      } as NodeJS.ProcessEnv);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).message).not.toContain("sup3rsecret");
      expect((err as Error).message).toContain("db.example.com");
    }
  });

  it("rejects the dev identity header when dev auth is disabled", async () => {
    const off = await startHarness({ VYORA_DEV_AUTH: "false" });
    try {
      const res = await call(off.app, "GET", "/api/v1/me", { devIdentity: "alpha" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    } finally {
      await off.close();
    }
  });

  it("accepts a seeded dev identity and discloses authMode", async () => {
    const res = await call(h.app, "GET", "/api/v1/me", { devIdentity: "alpha" });
    expect(res.status).toBe(200);
    expect(res.body.authMode).toBe("development");
  });

  it("rejects an unknown dev identity", async () => {
    const res = await call(h.app, "GET", "/api/v1/me", { devIdentity: "not-a-fixture" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/health", () => {
  it("answers without credentials", async () => {
    const res = await call(h.app, "GET", "/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.dependencies[0]).toEqual({ name: "postgres", status: "ok" });
  });

  it("sets X-Request-Id even on the unauthenticated path", async () => {
    const res = await call(h.app, "GET", "/api/v1/health");
    expect(res.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("error envelope", () => {
  const errorPaths: Array<[string, () => Promise<Res>]> = [
    ["401 no credentials", () => call(h.app, "GET", "/api/v1/me")],
    ["401 expired token", () => call(h.app, "GET", "/api/v1/me", { token: "alpha-token-expired" })],
    [
      "404 unknown party",
      () =>
        call(h.app, "GET", "/api/v1/parties/pty_00000000-0000-4000-8000-000000000000", {
          token: "alpha-token-synthetic",
        }),
    ],
    ["404 unknown endpoint", () => call(h.app, "GET", "/api/v1/nope")],
    [
      "400 bad limit",
      () =>
        call(h.app, "GET", "/api/v1/parties", {
          token: "alpha-token-synthetic",
          query: { limit: "0" },
        }),
    ],
    [
      "422 invalid body",
      () =>
        call(h.app, "POST", "/api/v1/parties", {
          token: "alpha-token-synthetic",
          headers: { "idempotency-key": "00000000-0000-4000-8000-000000000001" },
          payload: { id: "not-a-party-id", name: "" },
        }),
    ],
  ];

  it.each(errorPaths)("%s returns the standard envelope with X-Request-Id", async (_label, run) => {
    const res = await run();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error.code).toBe("string");
    expect(typeof res.body.error.message).toBe("string");
    expect(res.body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    // The header and the body must agree, or a client that logs only one loses
    // the correlation.
    expect(res.body.error.requestId).toBe(res.requestId);
  });

  it("reports TOKEN_EXPIRED distinctly from UNAUTHENTICATED", async () => {
    const res = await call(h.app, "GET", "/api/v1/me", { token: "alpha-token-expired" });
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });
});

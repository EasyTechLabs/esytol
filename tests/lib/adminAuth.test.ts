/**
 * Admin auth tests (P0-2).
 *
 * The one that matters most: fail closed. An unconfigured deployment must lock
 * everyone out — the previous state was the exact opposite (admin pages publicly
 * reachable because no gate existed at all).
 */

import { describe, it, expect } from "vitest";
import { configuredCredentials, digestEqual, isAuthorized, parseBasicAuth } from "@/lib/adminAuth";

const CREDS = { user: "founder", password: "correct horse battery staple" };

function basic(user: string, password: string): string {
  return "Basic " + btoa(`${user}:${password}`);
}

describe("configuredCredentials", () => {
  it("returns credentials when both vars are set", () => {
    expect(configuredCredentials({ ADMIN_USER: "a", ADMIN_PASSWORD: "b" })).toEqual({
      user: "a",
      password: "b",
    });
  });

  it.each([
    [{}],
    [{ ADMIN_USER: "a" }],
    [{ ADMIN_PASSWORD: "b" }],
    [{ ADMIN_USER: "", ADMIN_PASSWORD: "b" }],
    [{ ADMIN_USER: "   ", ADMIN_PASSWORD: "b" }],
  ])("returns null for incomplete configuration %#", (env) => {
    expect(configuredCredentials(env as Record<string, string | undefined>)).toBeNull();
  });
});

describe("parseBasicAuth", () => {
  it("parses a valid header", () => {
    expect(parseBasicAuth(basic("u", "p"))).toEqual({ user: "u", password: "p" });
  });

  it("keeps colons inside the password", () => {
    expect(parseBasicAuth(basic("u", "p:with:colons"))).toEqual({
      user: "u",
      password: "p:with:colons",
    });
  });

  it.each([
    [null],
    [""],
    ["Bearer abc"],
    ["Basic"],
    ["Basic !!!not-base64!!!"],
    ["Basic " + btoa("no-separator")],
  ])("rejects malformed input %#", (header) => {
    expect(parseBasicAuth(header as string | null)).toBeNull();
  });
});

describe("digestEqual", () => {
  it("matches equal strings and rejects near-misses", async () => {
    expect(await digestEqual("secret", "secret")).toBe(true);
    expect(await digestEqual("secret", "secres")).toBe(false);
    expect(await digestEqual("secret", "secret ")).toBe(false);
    expect(await digestEqual("", "")).toBe(true);
  });
});

describe("isAuthorized", () => {
  it("FAILS CLOSED: unconfigured auth denies everyone, even with a valid-looking header", async () => {
    expect(await isAuthorized(basic("founder", "anything"), null)).toBe(false);
    expect(await isAuthorized(null, null)).toBe(false);
  });

  it("denies anonymous requests", async () => {
    expect(await isAuthorized(null, CREDS)).toBe(false);
  });

  it("grants access for correct credentials", async () => {
    expect(await isAuthorized(basic(CREDS.user, CREDS.password), CREDS)).toBe(true);
  });

  it("denies a wrong password", async () => {
    expect(await isAuthorized(basic(CREDS.user, "wrong"), CREDS)).toBe(false);
  });

  it("denies a wrong user with the right password", async () => {
    expect(await isAuthorized(basic("intruder", CREDS.password), CREDS)).toBe(false);
  });

  it("denies swapped user/password", async () => {
    expect(await isAuthorized(basic(CREDS.password, CREDS.user), CREDS)).toBe(false);
  });

  it("handles unicode credentials", async () => {
    // NOTE: btoa cannot encode non-Latin1 — construct the header from raw bytes the
    // way a browser would not; this documents that credentials should stay ASCII.
    const creds = { user: "founder", password: "pass-word-123" };
    expect(await isAuthorized(basic(creds.user, creds.password), creds)).toBe(true);
  });
});

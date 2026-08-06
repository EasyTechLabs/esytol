/**
 * The server-side development proxy.
 *
 * Two things are being defended here. First, the gate is re-evaluated on the
 * server, so a hand-written fetch that skips the UI is refused just the same.
 * Second — and this is the one that would actually hurt — the development
 * identity never leaves the server. A credential in browser JavaScript is a
 * credential you have published.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE_DIR = join(process.cwd(), "app", "api", "vyora-dev", "parties");

const ORIGINAL = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const key of [
    "NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED",
    "NEXT_PUBLIC_VYORA_API_URL",
    "VYORA_API_DEV_IDENTITY",
    "NODE_ENV",
  ]) {
    delete (process.env as Record<string, string | undefined>)[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) (process.env as Record<string, string>)[key] = value;
  }
}

/** Re-import so the module reads the environment we just set. */
async function loadGate() {
  vi.resetModules();
  return import("@/app/api/vyora-dev/parties/forward");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Object.assign(process.env, ORIGINAL);
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the development credential never reaches the browser", () => {
  it("uses a server-only env var, with no NEXT_PUBLIC_ prefix", () => {
    const source = readFileSync(join(ROUTE_DIR, "forward.ts"), "utf8");
    expect(source).toContain("VYORA_API_DEV_IDENTITY");
    // A NEXT_PUBLIC_ identity would be inlined into the client bundle by Next.
    expect(source).not.toContain("NEXT_PUBLIC_VYORA_API_DEV_IDENTITY");
  });

  it("is never referenced from client-side code", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "party-source-remote.ts"),
      join(process.cwd(), "lib", "vyora", "party-api-config.ts"),
      join(process.cwd(), "features", "vyora", "usePartySource.ts"),
      join(process.cwd(), "features", "vyora", "PartySourceNotice.tsx"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("VYORA_API_DEV_IDENTITY");
      expect(source).not.toContain("x-vyora-dev-identity");
    }
  });

  it("attaches the identity header server-side when forwarding", async () => {
    setEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED: "true",
      NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000",
      VYORA_API_DEV_IDENTITY: "alpha",
    });

    // Typed parameters so `mock.calls` carries the argument tuple.
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { forwardPartyRead } = await loadGate();
    await forwardPartyRead("", "");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:4000/api/v1/parties");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["x-vyora-dev-identity"]).toBe("alpha");
  });
});

describe("the gate is enforced on the server, not just in the UI", () => {
  it("returns 404 when the flag is off, whatever the client believes", async () => {
    setEnv({ NODE_ENV: "development", VYORA_API_DEV_IDENTITY: "alpha" });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { forwardPartyRead } = await loadGate();
    const response = await forwardPartyRead("", "");

    expect(response.status).toBe(404);
    // Nothing was forwarded — the refusal happens before any upstream call.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 in production even with the flag enabled", async () => {
    setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED: "true",
      NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000",
      VYORA_API_DEV_IDENTITY: "alpha",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { forwardPartyRead } = await loadGate();
    const response = await forwardPartyRead("", "");

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a non-loopback API URL", async () => {
    setEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED: "true",
      NEXT_PUBLIC_VYORA_API_URL: "https://api.example.com",
      VYORA_API_DEV_IDENTITY: "alpha",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { forwardPartyRead } = await loadGate();
    expect((await forwardPartyRead("", "")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains itself when the server identity is missing", async () => {
    setEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED: "true",
      NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000",
    });

    const { forwardPartyRead } = await loadGate();
    const response = await forwardPartyRead("", "");
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("DEV_IDENTITY_MISSING");
    expect(body.error.message).toContain("never NEXT_PUBLIC_");
  });

  it("reports a 502 rather than throwing when the API is down", async () => {
    setEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED: "true",
      NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000",
      VYORA_API_DEV_IDENTITY: "alpha",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const { forwardPartyRead } = await loadGate();
    const response = await forwardPartyRead("", "");
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
  });
});

describe("the proxy is read-only", () => {
  it("exports no write handler on either route", () => {
    for (const file of [join(ROUTE_DIR, "route.ts"), join(ROUTE_DIR, "[partyId]", "route.ts")]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("export async function GET");
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(source).not.toContain(`export async function ${method}`);
      }
    }
  });

  it("forwards only read parameters, dropping anything else", async () => {
    const { READ_PARAMS } = await loadGate();
    expect([...READ_PARAMS]).toEqual(["q", "limit", "cursor", "position", "updatedSince"]);
  });
});

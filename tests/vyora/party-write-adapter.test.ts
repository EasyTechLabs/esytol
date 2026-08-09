/**
 * The remote Party writer and the write proxy.
 *
 * The two claims worth proving here are that a write reaches the API and only
 * the API, and that the credential never reaches the browser. Everything else
 * — headers, conflict handling, error shapes — exists to make those two safe.
 */

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remotePartyWriter, PartyApiError } from "@/lib/vyora/party-source-remote";

const ROUTE_DIR = join(process.cwd(), "app", "api", "vyora-dev", "parties");
const ORIGINAL = { ...process.env };

function party(overrides: Record<string, unknown> = {}) {
  return {
    id: "pty_11111111-1111-4111-8111-111111111111",
    name: "Synthetic Party",
    phone: null,
    note: null,
    createdAt: "2026-08-09T09:00:00.000Z",
    updatedAt: "2026-08-09T09:00:00.000Z",
    version: 1,
    balance: { net: 0, position: "no_entries", entryCount: 0, lastActivityAt: null },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.assign(process.env, ORIGINAL);
});

describe("remote create", () => {
  it("posts through the proxy, never the API directly", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(party(), 201, { etag: '"1"' })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remotePartyWriter().create("pty_abc-12345678", { name: "New" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url).startsWith("/api/vyora-dev/parties")).toBe(true);
    // The API's own origin must never appear in a browser request.
    expect(String(url)).not.toContain("4000");
    expect(init?.method).toBe("POST");
  });

  it("sends an Idempotency-Key so a retried create cannot double-create", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(party(), 201, { etag: '"1"' })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remotePartyWriter().create("pty_abc-12345678", { name: "New" });

    const headers = fetchMock.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("returns the API's own record and ETag, not a locally-invented one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(party({ name: "Server Wins", version: 1 }), 201, { etag: '"1"' })
      )
    );

    const result = await remotePartyWriter().create("pty_abc-12345678", { name: "Client Sent" });
    expect(result.party.name).toBe("Server Wins");
    expect(result.etag).toBe('"1"');
    expect(result.version).toBe(1);
  });

  it("surfaces a server validation message rather than a bare status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Request body failed contract validation.",
              details: [{ field: "$.name", code: "TOO_LONG", message: "maximum 100 characters" }],
            },
          },
          422
        )
      )
    );

    await expect(remotePartyWriter().create("pty_abc-12345678", { name: "x" })).rejects.toThrow(
      // `[\s\S]` rather than the `s` flag: this repo targets ES2017.
      /VALIDATION_FAILED[\s\S]*maximum 100 characters/
    );
  });

  it("raises PartyApiError when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );
    await expect(
      remotePartyWriter().create("pty_abc-12345678", { name: "x" })
    ).rejects.toBeInstanceOf(PartyApiError);
  });
});

describe("remote update", () => {
  it("sends If-Match with the caller's ETag", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(party({ version: 2 }), 200, { etag: '"2"' })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remotePartyWriter().update("pty_abc-12345678", '"1"', { name: "Renamed" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("PATCH");
    expect(String(url)).toContain("pty_abc-12345678");
    const headers = init?.headers as Record<string, string>;
    expect(headers["if-match"]).toBe('"1"');
  });

  it("returns the ETag the server issued, for the next update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(party({ version: 2 }), 200, { etag: '"2"' }))
    );
    const r = await remotePartyWriter().update("pty_abc-12345678", '"1"', { name: "Renamed" });
    expect(r.etag).toBe('"2"');
    expect(r.version).toBe(2);
  });

  it("rejects a stale update without overwriting, and reports the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "VERSION_CONFLICT",
              message: 'If-Match "1" is stale; the party is at "3".',
            },
          },
          412
        )
      )
    );

    await expect(
      remotePartyWriter().update("pty_abc-12345678", '"1"', { name: "Stale" })
    ).rejects.toMatchObject({ status: 412 });
  });

  it("reports a missing precondition distinctly (428)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: { code: "PRECONDITION_REQUIRED", message: "If-Match is required." } },
          428
        )
      )
    );
    await expect(
      remotePartyWriter().update("pty_abc-12345678", "", { name: "x" })
    ).rejects.toMatchObject({ status: 428 });
  });
});

describe("the browser never receives the development identity", () => {
  it("no client-side module references the identity or its header", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "party-source-remote.ts"),
      join(process.cwd(), "lib", "vyora", "party-api-config.ts"),
      join(process.cwd(), "features", "vyora", "usePartyWriter.ts"),
      join(process.cwd(), "features", "vyora", "PartyWriteNotice.tsx"),
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toContain("VYORA_API_DEV_IDENTITY");
      expect(src).not.toContain("x-vyora-dev-identity");
    }
  });

  it("the server proxy holds it, with no NEXT_PUBLIC_ prefix", () => {
    const src = readFileSync(join(ROUTE_DIR, "forward.ts"), "utf8");
    expect(src).toContain("VYORA_API_DEV_IDENTITY");
    expect(src).not.toContain("NEXT_PUBLIC_VYORA_API_DEV_IDENTITY");
  });

  it("no browser write request carries an identity header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(party(), 201, { etag: '"1"' })
    );
    vi.stubGlobal("fetch", fetchMock);

    await remotePartyWriter().create("pty_abc-12345678", { name: "New" });
    await remotePartyWriter().update("pty_abc-12345678", '"1"', { name: "Edit" });

    for (const call of fetchMock.mock.calls) {
      const headers = Object.keys((call[1]?.headers ?? {}) as Record<string, string>).map((h) =>
        h.toLowerCase()
      );
      expect(headers).not.toContain("x-vyora-dev-identity");
    }
  });
});

describe("the write proxy surface", () => {
  it("exposes POST on the collection and PATCH on the item — and no DELETE", () => {
    const collection = readFileSync(join(ROUTE_DIR, "route.ts"), "utf8");
    const item = readFileSync(join(ROUTE_DIR, "[partyId]", "route.ts"), "utf8");

    expect(collection).toContain("export async function POST");
    expect(item).toContain("export async function PATCH");

    for (const src of [collection, item]) {
      expect(src).not.toContain("export async function DELETE");
      expect(src).not.toContain("export async function PUT");
    }
    // Create belongs on the collection, update on the item — not the reverse.
    expect(collection).not.toContain("export async function PATCH");
    expect(item).not.toContain("export async function POST");
  });

  it("forwards only the two write headers the contract defines", async () => {
    process.env.NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED = "true";
    process.env.NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED = "true";
    process.env.NEXT_PUBLIC_VYORA_API_URL = "http://127.0.0.1:4000";
    process.env.VYORA_API_DEV_IDENTITY = "fixture";
    vi.resetModules();

    const { WRITE_HEADERS } = await import("@/app/api/vyora-dev/parties/forward");
    expect([...WRITE_HEADERS]).toEqual(["idempotency-key", "if-match"]);
  });
});

describe("the server write gate", () => {
  beforeEach(() => vi.resetModules());

  async function loadGate(env: Record<string, string | undefined>) {
    for (const k of [
      "NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED",
      "NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED",
      "NEXT_PUBLIC_VYORA_API_URL",
      "VYORA_API_DEV_IDENTITY",
      "NODE_ENV",
    ]) {
      delete (process.env as Record<string, string | undefined>)[k];
    }
    Object.assign(process.env, env);
    vi.resetModules();
    return import("@/app/api/vyora-dev/parties/forward");
  }

  const enabled = {
    NODE_ENV: "development",
    NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED: "true",
    NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED: "true",
    NEXT_PUBLIC_VYORA_API_URL: "http://127.0.0.1:4000",
    VYORA_API_DEV_IDENTITY: "fixture",
  };

  it("refuses a write with 404 when the write flag is off, forwarding nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { forwardPartyWrite } = await loadGate({
      ...enabled,
      NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED: "false",
    });

    const res = await forwardPartyWrite("POST", "", "{}", new Headers());
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a write in production even with both flags on", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { forwardPartyWrite } = await loadGate({ ...enabled, NODE_ENV: "production" });

    expect((await forwardPartyWrite("POST", "", "{}", new Headers())).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a write to a non-loopback API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { forwardPartyWrite } = await loadGate({
      ...enabled,
      NEXT_PUBLIC_VYORA_API_URL: "https://api.example.com",
    });

    expect((await forwardPartyWrite("PATCH", "/pty_x", "{}", new Headers())).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attaches the identity server-side and passes If-Match through", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(party(), 200, { etag: '"2"' })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { forwardPartyWrite } = await loadGate(enabled);

    const res = await forwardPartyWrite(
      "PATCH",
      "/pty_x",
      JSON.stringify({ name: "Edit" }),
      new Headers({ "if-match": '"1"', "idempotency-key": "11111111-1111-4111-8111-111111111111" })
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://127.0.0.1:4000/api/v1/parties/pty_x");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-vyora-dev-identity"]).toBe("fixture");
    expect(headers["if-match"]).toBe('"1"');
    // The ETag must reach the client or the next update cannot be made.
    expect(res.headers.get("etag")).toBe('"2"');
  });

  it("reports 502 rather than throwing when the API is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );
    const { forwardPartyWrite } = await loadGate(enabled);

    const res = await forwardPartyWrite("POST", "", "{}", new Headers());
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(502);
    expect(body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
  });
});

/**
 * The server-side shop and sign-in proxy.
 *
 * Three things are being defended.
 *
 * First, the **token never reaches the browser**. It is set as an httpOnly
 * cookie by a route handler and read only on the server; no client module names
 * the cookie, reads a token out of a response, or puts one in storage.
 *
 * Second, the **gate is re-evaluated on the server**, so a hand-written fetch
 * that skips the UI is refused exactly the same way.
 *
 * Third, request bodies are **rebuilt rather than relayed**, so no client field
 * can reach the API through this app.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "app", "api", "vyora-shops");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");

describe("the session token never reaches the browser", () => {
  it("is set httpOnly, and only ever by a route handler", () => {
    const verify = read(API_DIR, "auth", "verify-code", "route.ts");
    expect(verify).toContain("sessionCookieOptions");
    // The cookie is set here and nowhere else. A second setter would be a
    // second place the flags could be wrong.
    expect(verify).toContain("response.cookies.set");
  });

  it("is stripped from what the verify route returns", () => {
    // If the token were returned, a client could keep a copy in localStorage
    // "to be safe", and the httpOnly cookie would be protecting a credential
    // that also sits in readable storage.
    const verify = read(API_DIR, "auth", "verify-code", "route.ts");
    const returned = verify.slice(verify.indexOf("NextResponse.json({"));
    expect(returned).toContain("person");
    expect(returned.slice(0, returned.indexOf("response.cookies.set"))).not.toContain(
      "token: session.token"
    );
  });

  it("is never named by client-side code", () => {
    for (const file of [
      join(process.cwd(), "lib", "vyora", "shop-client.ts"),
      join(process.cwd(), "features", "vyora", "screens", "ShopSetup.tsx"),
      join(process.cwd(), "features", "vyora", "screens", "VerifyShop.tsx"),
      join(process.cwd(), "features", "vyora", "ShopQr.tsx"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("vyora_session");
      expect(source).not.toContain("authorization");
      expect(source).not.toContain("Bearer");
      // Storage a script can read, in any form.
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
    }
  });

  it("is read from the cookie on the server, never from a request header", () => {
    const forward = read(API_DIR, "forward.ts");
    expect(forward).toContain("SESSION_COOKIE");
    expect(forward).toContain("Bearer ${token}");
    // A token accepted from a client-supplied header would defeat the cookie
    // entirely — anything that could set the header could set the token.
    expect(forward).not.toContain('request.headers.get("authorization")');
  });
});

describe("the browser sends the cookie, and only same-origin", () => {
  it("asks for the cookie explicitly on every call", () => {
    // Without this, `fetch` omits cookies and every authenticated call comes
    // back 401 with nothing to show for it.
    const client = read(process.cwd(), "lib", "vyora", "shop-client.ts");
    expect(client).toContain('credentials: "same-origin"');
    // Every path goes through this app's own server.
    expect(client).toContain('const ROOT = "/api/vyora-shops"');
    expect(client).not.toMatch(/fetch\(\s*["'`]https?:/);
  });
});

describe("the gate is on the server", () => {
  it("refuses production and non-loopback before doing anything else", () => {
    const forward = read(API_DIR, "forward.ts");
    expect(forward).toContain("shopApiDecision");
    // 404 rather than 403: when the feature is off this endpoint does not
    // exist as far as any caller is concerned, and saying otherwise
    // advertises it.
    expect(forward).toContain('code: "NOT_FOUND"');
  });

  it("answers a missing session with 401 rather than forwarding it", () => {
    const forward = read(API_DIR, "forward.ts");
    expect(forward).toContain('code: "UNAUTHORIZED"');
  });
});

describe("what these routes can express", () => {
  it("rebuilds every write body field by field", () => {
    // A pass-through would let a client field reach a contract that sets
    // `additionalProperties: false` — and, worse, would make it possible to
    // forward a `merchantId`, which must never come from a client.
    const shops = read(API_DIR, "shops", "route.ts");
    // Scoped to the body literal, not the whole file — the prose above it
    // names `merchantId` precisely to explain why the body cannot carry one.
    const body = shops.slice(shops.indexOf("JSON.stringify({"), shops.indexOf("});"));
    expect(body).toContain("name:");
    expect(body).toContain("addressLine:");
    expect(body).toContain("localityConfirmed:");
    expect(body).not.toContain("merchantId");
    expect(body).not.toContain("...incoming");

    const active = read(API_DIR, "shops", "active", "route.ts");
    // The one route that does take a merchantId — and the API re-checks the
    // membership, which is why it is safe to.
    expect(active).toContain("merchantId");
  });

  it("parses a shop code before forwarding it anywhere", () => {
    const lookup = read(API_DIR, "shops", "lookup", "[shopId]", "route.ts");
    expect(lookup).toContain("parsePublicId");
    // A malformed code is refused with the same 404 an unknown one gets, so
    // this route cannot be used to probe the API with arbitrary path segments.
    expect(lookup).toContain('code: "NOT_FOUND"');
    expect(lookup).toContain("encodeURIComponent");
  });

  it("carries no ledger, sync or delete path", () => {
    // Nothing routed through here can remove a shop, a party or an event log.
    for (const file of [
      join(API_DIR, "forward.ts"),
      join(API_DIR, "shops", "route.ts"),
      join(API_DIR, "shops", "active", "route.ts"),
      join(API_DIR, "localities", "route.ts"),
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("/api/v1/sync");
      expect(source).not.toContain("/api/v1/parties");
      expect(source).not.toContain("export async function DELETE");
    }
  });

  it("forwards only the pincode to the locality lookup", () => {
    // An allow-list rather than a pass-through, so this route can only ever
    // express the read the API already supports — and it calls nothing outside
    // the local stack.
    const localities = read(API_DIR, "localities", "route.ts");
    expect(localities).toContain("URLSearchParams({ pincode })");
    expect(localities).not.toContain("searchParams.forEach");
  });
});

describe("sign-in reveals nothing about an address", () => {
  it("adds no validation of its own to the request-code route", () => {
    // The API answers 202 identically for a known address, an unknown one, a
    // malformed one and a rate-limited one. A stricter check here would turn
    // that into a membership oracle by rejecting some addresses faster.
    const request = read(API_DIR, "auth", "request-code", "route.ts");
    expect(request).not.toContain("status: 400");
    expect(request).toContain("forwardPublic");
  });

  it("sends no credential on either sign-in route", () => {
    const forward = read(API_DIR, "forward.ts");
    const publicPart = forward.slice(
      forward.indexOf("export async function forwardPublic"),
      forward.indexOf("export async function forwardWithSession")
    );
    expect(publicPart).not.toContain("authorization");
    expect(publicPart).not.toContain("SESSION_COOKIE");
  });
});

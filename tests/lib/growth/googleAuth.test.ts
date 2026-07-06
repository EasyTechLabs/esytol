// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import {
  getServiceAccount,
  hasGoogleAuth,
  buildServiceAccountJwt,
  getGoogleAccessToken,
  resetTokenCache,
  GA_SCOPE,
} from "@/lib/growth/providers/googleAuth";
import { fetchAnalytics } from "@/lib/growth/providers/analytics";

// A throwaway RSA keypair so we can sign + verify JWTs without any real secret.
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const SA = {
  type: "service_account",
  client_email: "growth@easytechlabs.iam.gserviceaccount.com",
  private_key: privateKey,
};
const NOW = new Date("2026-07-06T10:00:00Z");

const ENV_KEYS = [
  "GA4_PROPERTY_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_ACCESS_TOKEN",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  resetTokenCache();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetTokenCache();
  vi.unstubAllGlobals();
});

describe("getServiceAccount / hasGoogleAuth", () => {
  it("returns null with no credentials", () => {
    expect(getServiceAccount()).toBeNull();
    expect(hasGoogleAuth()).toBe(false);
  });

  it("parses an inline Service Account JSON", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(SA);
    const parsed = getServiceAccount();
    expect(parsed?.client_email).toBe(SA.client_email);
    expect(hasGoogleAuth()).toBe(true);
  });

  it("treats a bare GOOGLE_ACCESS_TOKEN as authenticated", () => {
    process.env.GOOGLE_ACCESS_TOKEN = "ya29.direct";
    expect(hasGoogleAuth()).toBe(true);
  });
});

describe("buildServiceAccountJwt", () => {
  it("produces an RS256 JWT with correct claims that verifies against the public key", () => {
    const jwt = buildServiceAccountJwt(SA, GA_SCOPE, NOW);
    const [h, c, sig] = jwt.split(".");

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);

    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(claims.iss).toBe(SA.client_email);
    expect(claims.scope).toBe(GA_SCOPE);
    expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
    expect(claims.exp - claims.iat).toBe(3600);
  });
});

describe("getGoogleAccessToken", () => {
  it("returns null without credentials", async () => {
    expect(await getGoogleAccessToken(GA_SCOPE, NOW)).toBeNull();
  });

  it("returns a pre-minted direct token without a network call", async () => {
    process.env.GOOGLE_ACCESS_TOKEN = "ya29.direct";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getGoogleAccessToken(GA_SCOPE, NOW)).toBe("ya29.direct");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints and caches a token from the Service Account", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(SA);
    const fetchMock = vi.fn(async (_url: unknown, _init: unknown) => {
      void _url;
      void _init;
      return new Response(JSON.stringify({ access_token: "ya29.minted", expires_in: 3600 }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await getGoogleAccessToken(GA_SCOPE, NOW)).toBe("ya29.minted");
    // second call within TTL is served from cache (no extra token exchange)
    expect(await getGoogleAccessToken(GA_SCOPE, NOW)).toBe("ya29.minted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://oauth2.googleapis.com/token");
    expect(String((init as RequestInit).body)).toContain("grant_type=urn");
  });
});

describe("fetchAnalytics — live path via Service Account", () => {
  function stubGa() {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "ya29.minted", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (u.includes("analyticsdata.googleapis.com")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        const dim = body.dimensions?.[0]?.name;
        if (dim === "pagePath") {
          return new Response(
            JSON.stringify({
              rows: [
                {
                  dimensionValues: [{ value: "/tools/emi-calculator" }],
                  metricValues: [
                    { value: "5000" },
                    { value: "3500" },
                    { value: "210000" },
                    { value: "0.35" },
                  ],
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            rows: [
              { dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "1200" }] },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("returns live, mapped Analytics data", async () => {
    process.env.GA4_PROPERTY_ID = "123456789";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(SA);
    stubGa();

    const res = await fetchAnalytics(NOW);
    expect(res.status).toBe("live");
    expect(res.data.topPages[0]).toMatchObject({
      page: "/tools/emi-calculator",
      views: 5000,
      users: 3500,
      avgEngagementSec: 42, // 210000 / 5000
      bounceRate: 0.35,
    });
    expect(res.data.sources[0].label).toBe("Organic Search");
  });

  it("falls back to sample (unchanged) when unconfigured", async () => {
    const res = await fetchAnalytics(NOW);
    expect(res.status).toBe("sample");
    expect(res.note).toMatch(/GOOGLE_SERVICE_ACCOUNT_JSON|GOOGLE_APPLICATION_CREDENTIALS/);
    expect(res.data.topPages.length).toBeGreaterThan(0);
  });

  it("falls back to error+sample when the live fetch fails", async () => {
    process.env.GA4_PROPERTY_ID = "123456789";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(SA);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500, statusText: "Server Error" }))
    );

    const res = await fetchAnalytics(NOW);
    expect(res.status).toBe("error");
    expect(res.data.topPages.length).toBeGreaterThan(0); // graceful sample fallback
  });
});

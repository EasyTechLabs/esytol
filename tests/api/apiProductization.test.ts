/**
 * API productization tests — Growth Sprint 002.
 *
 * Covers plans, identity/plan resolution (anonymous/RapidAPI/direct-key),
 * metering, the /usage + /contact endpoints, and — critically — that the public
 * calculate endpoint STILL works for anonymous callers (no breakage).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/v1/income-tax/calculate/route";
import { GET as usageGet } from "@/app/api/v1/usage/route";
import { POST as contactPost } from "@/app/api/v1/contact/route";
import { resetRateLimits } from "@/lib/api/rateLimit";
import { resetUsage, recordUsage, getUsage, monthKey } from "@/lib/api/metering";
import { resetKeyStore } from "@/lib/api/apiKeys";
import { resolveIdentity } from "@/lib/api/identity";
import { getPlan, FREE_PLAN, selfServePlans, PLANS } from "@/lib/api/plans";
import { captureLead } from "@/lib/api/leads";

const URL = "https://api.esytol.com/api/v1/income-tax/calculate";
const call = (headers: Record<string, string> = {}) =>
  POST(
    new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ income: { salary: 1800000 } }),
    })
  );

beforeEach(() => {
  resetRateLimits();
  resetUsage();
  resetKeyStore();
  delete process.env.ESYTOL_API_KEYS;
  delete process.env.RAPIDAPI_PROXY_SECRET;
});
afterEach(() => {
  delete process.env.ESYTOL_API_KEYS;
  delete process.env.RAPIDAPI_PROXY_SECRET;
});

describe("plans", () => {
  it("has 4 self-serve tiers + enterprise, free = Basic", () => {
    expect(selfServePlans().map((p) => p.id)).toEqual(["free", "pro", "ultra", "mega"]);
    expect(PLANS.at(-1)!.id).toBe("enterprise");
    expect(FREE_PLAN.priceUsd).toBe(0);
    expect(getPlan("nope").id).toBe("free"); // unknown → free, never throws
  });
});

describe("identity resolution (non-breaking)", () => {
  it("anonymous resolves to the Free plan (no key required)", () => {
    const r = resolveIdentity(new Request(URL, { method: "POST" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.identity.plan.id).toBe("free");
  });

  it("a valid direct API key resolves to its plan", () => {
    process.env.ESYTOL_API_KEYS = JSON.stringify([
      { key: "sk_test_123", plan: "ultra", principal: "acme" },
    ]);
    resetKeyStore();
    const r = resolveIdentity(
      new Request(URL, { method: "POST", headers: { "x-api-key": "sk_test_123" } })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.identity.plan.id).toBe("ultra");
      expect(r.identity.source).toBe("apiKey");
      expect(r.identity.principal).toContain("acme");
    }
  });

  it("an invalid direct API key is rejected 401", () => {
    const r = resolveIdentity(
      new Request(URL, { method: "POST", headers: { "x-api-key": "wrong" } })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("a RapidAPI request with the correct proxy secret gets its subscribed plan", () => {
    process.env.RAPIDAPI_PROXY_SECRET = "shh";
    const r = resolveIdentity(
      new Request(URL, {
        method: "POST",
        headers: {
          "x-rapidapi-proxy-secret": "shh",
          "x-rapidapi-subscription": "PRO",
          "x-rapidapi-user": "u1",
        },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.identity.plan.id).toBe("pro");
      expect(r.identity.source).toBe("rapidapi");
    }
  });

  it("a spoofed RapidAPI proxy secret is rejected 403", () => {
    process.env.RAPIDAPI_PROXY_SECRET = "shh";
    const r = resolveIdentity(
      new Request(URL, { method: "POST", headers: { "x-rapidapi-proxy-secret": "nope" } })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});

describe("calculate route — still public, now plan-aware", () => {
  it("anonymous POST still returns 200 (existing users unaffected)", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(res.headers.get("X-Usage-Plan")).toBe("free");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60"); // free plan limit
    expect(res.headers.get("X-Usage-Used")).toBe("1");
  });

  it("an invalid X-API-Key is rejected 401 (opt-in auth only)", async () => {
    const res = await call({ "x-api-key": "bogus" });
    expect(res.status).toBe(401);
  });

  it("a RapidAPI Ultra subscriber gets the Ultra rate limit (120/min)", async () => {
    process.env.RAPIDAPI_PROXY_SECRET = "shh";
    const res = await call({
      "x-rapidapi-proxy-secret": "shh",
      "x-rapidapi-subscription": "ULTRA",
      "x-rapidapi-user": "u9",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Usage-Plan")).toBe("ultra");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("120");
  });
});

describe("metering (real counts only)", () => {
  it("records and reads usage; overage computed vs plan quota", () => {
    const pro = getPlan("pro");
    for (let i = 0; i < 3; i++) recordUsage("key:acme", pro, "/x", "apiKey");
    const snap = getUsage("key:acme", pro);
    expect(snap.used).toBe(3);
    expect(snap.included).toBe(10_000);
    expect(snap.remaining).toBe(9_997);
    expect(snap.overage).toBe(0);
    expect(snap.month).toBe(monthKey());
  });
  it("enterprise (unmetered) reports null remaining, never invented", () => {
    const ent = getPlan("enterprise");
    recordUsage("key:big", ent, "/x", "apiKey");
    const snap = getUsage("key:big", ent);
    expect(snap.included).toBeNull();
    expect(snap.remaining).toBeNull();
  });
});

describe("GET /usage", () => {
  it("returns the caller's plan + real usage", async () => {
    const res = await usageGet(new Request("https://api.esytol.com/api/v1/usage"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.plan.id).toBe("free");
    expect(json.usage.used).toBe(0); // read-only, no increment
  });
});

describe("POST /contact (lead capture)", () => {
  const contact = (body: unknown) =>
    contactPost(
      new Request("https://api.esytol.com/api/v1/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  it("accepts a valid enterprise lead", async () => {
    const res = await contact({
      type: "enterprise",
      name: "Dev Lead",
      email: "dev@acme.com",
      message: "1M req/mo",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
  it("rejects an invalid email (422)", async () => {
    const res = await contact({ type: "sales", name: "X", email: "not-an-email" });
    expect(res.status).toBe(422);
    expect((await res.json()).errors[0].field).toBe("email");
  });
  it("rejects an unknown type (422)", async () => {
    const res = await contact({ type: "spam", name: "X", email: "a@b.com" });
    expect(res.status).toBe(422);
  });
  it("captureLead validates directly", () => {
    expect(captureLead({ type: "apikey", name: "N", email: "a@b.com" }, "id1").ok).toBe(true);
    expect(captureLead({ type: "apikey", name: "N", email: "bad" }, "id2").ok).toBe(false);
  });
});

/**
 * Income Tax HTTP API tests — EXPOSE-001.
 *
 * Contract + negative + observability tests that call the route handlers
 * directly (no running server), plus rate-limiter unit tests and OpenAPI
 * structural validation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { POST, OPTIONS } from "@/app/api/v1/income-tax/calculate/route";
import { GET as healthGet } from "@/app/api/v1/health/route";
import { GET as readyGet } from "@/app/api/v1/ready/route";
import { GET as versionGet } from "@/app/api/v1/version/route";
import { GET as openapiGet } from "@/app/api/v1/openapi.json/route";
import { checkRateLimit, resetRateLimits } from "@/lib/api/rateLimit";
import { buildOpenApiSpec } from "@/lib/api/openapi";
import { calculateIncomeTax } from "@/lib/incomeTax";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://api.esytol.com/api/v1/income-tax/calculate", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => resetRateLimits());

describe("POST /api/v1/income-tax/calculate", () => {
  it("computes tax and matches the engine (200)", async () => {
    const res = await post({ income: { salary: 1800000 } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.engineVersion).toBe("2.0.0");
    expect(json.assessmentYear).toBe("2026-27");
    const engine = calculateIncomeTax({
      annualSalary: 1800000,
      otherIncome: 0,
      section80C: 0,
      section80D: 0,
      hraExemption: 0,
      homeLoanInterest: 0,
      professionalTax: 0,
      otherDeductions: 0,
    });
    expect(json.result.new.totalTax).toBe(engine.new.totalTax);
    expect(json.result.new.trace.length).toBeGreaterThan(0);
  });

  it("honours the assessment year and deductions", async () => {
    const res = await post({
      assessmentYear: "2025-26",
      income: { salary: 775000 },
    });
    const json = await res.json();
    expect(json.assessmentYear).toBe("2025-26");
    expect(json.result.new.totalTax).toBe(0);
  });

  it("returns a request id and CORS headers", async () => {
    const res = await post({ income: { salary: 500000 } });
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
  });

  it("rejects malformed JSON with a clean 400 (no stack trace)", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errors[0].code).toBe("invalid_json");
  });

  it("returns structured validation errors (422) for bad input", async () => {
    const res = await post({ income: { salary: -5 } });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.errors[0].field).toBe("income.salary");
  });

  it("rejects an unsupported assessment year (422)", async () => {
    const res = await post({ assessmentYear: "1999-00", income: { salary: 100 } });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(
      json.errors.some((e: { code: string }) => e.code === "unsupported_assessment_year")
    ).toBe(true);
  });

  it("never throws on a missing body / wrong shape", async () => {
    const res = await post({});
    expect(res.status).toBe(422); // missing income.salary → validation error, not a crash
  });
});

describe("CORS preflight", () => {
  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("observability endpoints", () => {
  it("GET /health → 200 ok", async () => {
    const json = await (await healthGet()).json();
    expect(json.status).toBe("ok");
  });
  it("GET /ready → 200 ready (engine computes)", async () => {
    const res = await readyGet();
    expect(res.status).toBe(200);
    expect((await res.json()).ready).toBe(true);
  });
  it("GET /version → engine + api version + supported years", async () => {
    const json = await (await versionGet()).json();
    expect(json.engineVersion).toBe("2.0.0");
    expect(json.apiVersion).toBe("1");
    expect(json.supportedAssessmentYears).toContain("2024-25");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit then denies", () => {
    resetRateLimits();
    const cfg = { limit: 2, windowMs: 1000 };
    expect(checkRateLimit("k", cfg, 0).allowed).toBe(true);
    expect(checkRateLimit("k", cfg, 1).allowed).toBe(true);
    const third = checkRateLimit("k", cfg, 2);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });
  it("resets after the window passes", () => {
    resetRateLimits();
    const cfg = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("k2", cfg, 0).allowed).toBe(true);
    expect(checkRateLimit("k2", cfg, 500).allowed).toBe(false);
    expect(checkRateLimit("k2", cfg, 1500).allowed).toBe(true);
  });
});

describe("OpenAPI 3.1 spec", () => {
  it("GET /openapi.json returns a valid 3.1 document", async () => {
    const spec = await (await openapiGet()).json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toContain("Income Tax");
    expect(spec.paths["/income-tax/calculate"].post).toBeDefined();
    expect(spec.paths["/health"].get).toBeDefined();
    expect(spec.paths["/version"].get).toBeDefined();
  });
  it("documents every schema and the (unused) security seam", () => {
    const spec = buildOpenApiSpec() as {
      components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
      security: unknown[];
    };
    for (const s of [
      "TaxRequest",
      "TaxResponse",
      "ErrorResponse",
      "RegimeResult",
      "TraceStep",
      "Attribution",
    ]) {
      expect(spec.components.schemas[s], s).toBeDefined();
    }
    expect(spec.components.securitySchemes.ApiKeyAuth).toBeDefined();
    expect(spec.security).toEqual([]); // no auth required today
  });
});

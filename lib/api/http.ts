/**
 * HTTP API primitives — EXPOSE-001.
 *
 * Shared building blocks for every Esytol API route: request IDs, a consistent
 * JSON envelope, CORS for public consumption, and privacy-safe structured
 * logging. Reused across endpoints so the contract is uniform and no route
 * hand-rolls its own error shape.
 */

export interface ApiErrorItem {
  code: string;
  message: string;
  field?: string;
}

/** A stable, opaque request identifier (returned as X-Request-Id and logged). */
export function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Deterministic-enough fallback without Math.random (never used in practice on Node ≥ 19).
  return `req_${Date.now().toString(36)}`;
}

/** Public, read-only compute API: safe to allow any origin (no cookies/credentials). */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export interface JsonResponseInit {
  status?: number;
  requestId?: string;
  headers?: Record<string, string>;
}

/** Build a JSON Response with CORS, request-id, and no-store caching. */
export function jsonResponse(body: unknown, init: JsonResponseInit = {}): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(),
    ...(init.requestId ? { "X-Request-Id": init.requestId } : {}),
    ...init.headers,
  };
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

/** The CORS preflight response for OPTIONS. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/**
 * Structured, privacy-safe request log. **Never logs the request body** — a tax
 * API must not record incomes. Only metadata (method, path, status, timing, ids).
 */
export function logRequest(entry: {
  requestId: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  outcome: "ok" | "validation_error" | "bad_request" | "rate_limited" | "error";
  assessmentYear?: string;
}): void {
  // JSON line — captured by Vercel logs. No income/PII fields, by design.
  console.log(JSON.stringify({ level: "info", service: "income-tax-api", ...entry }));
}

/** Read + parse a JSON body, returning a typed error item instead of throwing. */
export async function readJson(
  req: Request
): Promise<{ ok: true; value: unknown } | { ok: false; error: ApiErrorItem }> {
  try {
    const value = await req.json();
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      error: { code: "invalid_json", message: "Request body is not valid JSON." },
    };
  }
}

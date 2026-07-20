/**
 * POST /api/v1/contact — Growth Sprint 002 (Conversion).
 *
 * Inbound lead capture for Contact Sales / Request Enterprise / API-key requests.
 * Public, rate-limited, no auth (a prospect has no key yet). Records the lead via
 * the lead sink seam (lib/api/leads.ts). Never stores income/PII beyond the
 * contact fields the prospect submitted.
 */

import { newRequestId, jsonResponse, preflight, readJson, logRequest } from "@/lib/api/http";
import { checkRateLimit, rateLimitHeaders, clientKey } from "@/lib/api/rateLimit";
import { captureLead, type Lead } from "@/lib/api/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/contact";
// Anti-abuse: leads are low-frequency; a tighter window than the compute API.
const LEAD_RATE = { limit: 5, windowMs: 60_000 };

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const started = Date.now();

  const rl = checkRateLimit(`lead:${clientKey(req)}`, LEAD_RATE);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    logRequest({
      requestId,
      method: "POST",
      path: PATH,
      status: 429,
      ms: Date.now() - started,
      outcome: "rate_limited",
    });
    return jsonResponse(
      {
        success: false,
        requestId,
        errors: [{ code: "rate_limited", message: "Too many requests. Try again shortly." }],
      },
      { status: 429, requestId, headers: rlHeaders }
    );
  }

  const parsed = await readJson(req);
  if (!parsed.ok) {
    return jsonResponse(
      { success: false, requestId, errors: [parsed.error] },
      { status: 400, requestId, headers: rlHeaders }
    );
  }

  const receipt = captureLead(parsed.value as Partial<Lead>, requestId);
  if (!receipt.ok) {
    logRequest({
      requestId,
      method: "POST",
      path: PATH,
      status: 422,
      ms: Date.now() - started,
      outcome: "validation_error",
    });
    return jsonResponse(
      { success: false, requestId, errors: [receipt.error] },
      { status: 422, requestId, headers: rlHeaders }
    );
  }

  logRequest({
    requestId,
    method: "POST",
    path: PATH,
    status: 200,
    ms: Date.now() - started,
    outcome: "ok",
  });
  return jsonResponse(
    {
      success: true,
      requestId,
      leadId: receipt.leadId,
      message: "Thanks — we'll be in touch within one business day.",
    },
    { status: 200, requestId, headers: rlHeaders }
  );
}

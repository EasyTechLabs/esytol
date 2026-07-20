import { computeIncomeTax, type TaxApiRequest } from "@/lib/incomeTaxApi";
import { newRequestId, jsonResponse, preflight, readJson, logRequest } from "@/lib/api/http";
import { resolveIdentity } from "@/lib/api/identity";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rateLimit";
import { recordUsage, usageHeaders } from "@/lib/api/metering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/income-tax/calculate";

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const started = Date.now();
  const done = (
    status: number,
    outcome: Parameters<typeof logRequest>[0]["outcome"],
    assessmentYear?: string
  ) =>
    logRequest({
      requestId,
      method: "POST",
      path: PATH,
      status,
      ms: Date.now() - started,
      outcome,
      assessmentYear,
    });

  // 1. Identity + plan. Anonymous callers resolve to the Free tier (no key required),
  //    so existing public users keep working. Only a bad key / spoofed gateway is rejected.
  const id = resolveIdentity(req);
  if (!id.ok) {
    done(id.status, "error");
    return jsonResponse(
      { success: false, apiVersion: "1", requestId, errors: [id.error] },
      { status: id.status, requestId }
    );
  }
  const { principal, plan, source } = id.identity;

  // 2. Plan-aware rate limiting (limit from the caller's plan).
  const rl = checkRateLimit(principal, plan.rateLimit);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    done(429, "rate_limited");
    return jsonResponse(
      {
        success: false,
        apiVersion: "1",
        requestId,
        errors: [
          { code: "rate_limited", message: "Rate limit exceeded. Retry after the reset window." },
        ],
      },
      { status: 429, requestId, headers: rlHeaders }
    );
  }

  // 3. Meter this request (real count; emits billing hooks). Never blocks the public path —
  //    monthly quota enforcement for paid tiers is handled by RapidAPI's gateway.
  const usage = recordUsage(principal, plan, PATH, source);
  Object.assign(rlHeaders, usageHeaders(usage));

  // 4. Parse the body — malformed JSON is a clean 400, never a stack trace.
  const parsed = await readJson(req);
  if (!parsed.ok) {
    done(400, "bad_request");
    return jsonResponse(
      { success: false, apiVersion: "1", requestId, errors: [parsed.error] },
      { status: 400, requestId, headers: rlHeaders }
    );
  }

  // 5. Validate + compute (the tested engine contract; never throws).
  const result = computeIncomeTax(parsed.value as TaxApiRequest, { now: new Date() });

  if (!result.ok) {
    done(422, "validation_error");
    return jsonResponse(
      { success: false, apiVersion: result.apiVersion, requestId, errors: result.errors },
      { status: 422, requestId, headers: rlHeaders }
    );
  }

  const attribution = result.result!.attribution;
  done(200, "ok", attribution.assessmentYear);
  return jsonResponse(
    {
      success: true,
      apiVersion: result.apiVersion,
      engineVersion: attribution.engineVersion,
      assessmentYear: attribution.assessmentYear,
      requestId,
      result: result.result,
    },
    { status: 200, requestId, headers: rlHeaders }
  );
}

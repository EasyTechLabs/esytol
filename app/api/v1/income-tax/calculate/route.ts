import { computeIncomeTax, type TaxApiRequest } from "@/lib/incomeTaxApi";
import { newRequestId, jsonResponse, preflight, readJson, logRequest } from "@/lib/api/http";
import { authenticate } from "@/lib/api/auth";
import { checkRateLimit, rateLimitHeaders, clientKey } from "@/lib/api/rateLimit";

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

  // 1. Authentication (public today; the seam for keys/bearer later).
  const auth = authenticate(req);
  if (!auth.authenticated) {
    done(401, "error");
    return jsonResponse(
      { success: false, apiVersion: "1", requestId, errors: [auth.error] },
      { status: 401, requestId }
    );
  }

  // 2. Rate limiting (configurable; generous default).
  const rl = checkRateLimit(clientKey(req));
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

  // 3. Parse the body — malformed JSON is a clean 400, never a stack trace.
  const parsed = await readJson(req);
  if (!parsed.ok) {
    done(400, "bad_request");
    return jsonResponse(
      { success: false, apiVersion: "1", requestId, errors: [parsed.error] },
      { status: 400, requestId, headers: rlHeaders }
    );
  }

  // 4. Validate + compute (the tested engine contract; never throws).
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

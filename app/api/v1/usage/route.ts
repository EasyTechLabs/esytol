/**
 * GET /api/v1/usage — Growth Sprint 002 (Measurement).
 *
 * Returns the CALLER'S real usage this month (never invented — an actual count
 * from the meter for this serverless instance). Marketplace customers should read
 * RapidAPI's dashboard for authoritative, global usage + billing; this endpoint
 * is the direct/self-serve view and a health check for the metering seam.
 */

import { jsonResponse, preflight, newRequestId } from "@/lib/api/http";
import { resolveIdentity } from "@/lib/api/identity";
import { getUsage, usageHeaders } from "@/lib/api/metering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

export async function GET(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const id = resolveIdentity(req);
  if (!id.ok) {
    return jsonResponse(
      { success: false, apiVersion: "1", requestId, errors: [id.error] },
      { status: id.status, requestId }
    );
  }
  const { principal, plan, source } = id.identity;
  const usage = getUsage(principal, plan);
  return jsonResponse(
    {
      success: true,
      apiVersion: "1",
      requestId,
      plan: { id: plan.id, name: plan.name, source },
      usage: {
        month: usage.month,
        used: usage.used,
        included: usage.included, // null when negotiated/unmetered
        remaining: usage.remaining, // null when unmetered
        overage: usage.overage,
      },
      note:
        source === "rapidapi"
          ? "Authoritative usage + billing live in your RapidAPI dashboard. This is a best-effort per-instance count."
          : "Best-effort per-instance count. For exact global billing use a direct plan with a durable meter, or the RapidAPI marketplace.",
    },
    { requestId, headers: usageHeaders(usage) }
  );
}

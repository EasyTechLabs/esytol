import { computeIncomeTax } from "@/lib/incomeTaxApi";
import { jsonResponse, preflight } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/**
 * Readiness: the engine can actually compute. A trivial known request must
 * succeed, or we report not-ready (so a load balancer can hold traffic).
 */
export async function GET(): Promise<Response> {
  const probe = computeIncomeTax({ income: { salary: 1000000 } });
  if (probe.ok && probe.result) {
    return jsonResponse({ ready: true });
  }
  return jsonResponse({ ready: false }, { status: 503 });
}

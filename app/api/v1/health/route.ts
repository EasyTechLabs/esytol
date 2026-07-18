import { jsonResponse, preflight } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/** Liveness: the process is up and can serve. */
export async function GET(): Promise<Response> {
  return jsonResponse({ status: "ok" });
}

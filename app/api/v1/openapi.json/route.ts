import { buildOpenApiSpec } from "@/lib/api/openapi";
import { jsonResponse, preflight } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/** The OpenAPI 3.1 document — consumable by any Swagger UI, Postman, or codegen. */
export async function GET(): Promise<Response> {
  return jsonResponse(buildOpenApiSpec());
}

/**
 * The gate and forwarder for the two sync operations.
 *
 * Separate from `vyora-shops/forward.ts` on purpose, and the difference is one
 * header: sync is **shop-scoped**, so `x-vyora-shop` has to travel with the
 * request, while every route under `vyora-shops` is person-scoped or names its
 * shop in the path.
 *
 * That header is passed through from the browser, and passing it through is
 * safe for a reason worth writing down: the API does not trust it either. It
 * looks up the caller's membership of that shop and copies the merchant id off
 * the *membership row*, answering "not a member", "no such shop" and
 * "membership ended" identically. So a browser naming somebody else's shop
 * achieves a 404 and nothing more — which is asserted in the API's own tests,
 * not assumed here.
 *
 * Everything else is the same shape and for the same reason: the session token
 * is an `httpOnly` cookie read on this server, and the browser makes a request
 * it could not make itself.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, shopApiDecision } from "@/lib/vyora/shop-session";

const SHOP_HEADER = "x-vyora-shop";

function denied(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Forward one sync call.
 *
 * The gate is the existing one: no production, loopback API only. Sync moves a
 * merchant's whole ledger, so if anything it deserves the stricter treatment,
 * and reusing the decision means there is one place to change when this stops
 * being a local-development stack.
 */
export async function forwardSync(
  method: "GET" | "POST",
  path: string,
  request: Request,
  body?: string
): Promise<NextResponse> {
  const decision = shopApiDecision();
  if (!decision.enabled) {
    // 404, not 403: as far as any caller is concerned this endpoint does not
    // exist, and saying otherwise advertises it.
    return denied(404, "NOT_FOUND", decision.reason);
  }

  const shopId = request.headers.get(SHOP_HEADER);
  if (!shopId) {
    return denied(400, "BAD_REQUEST", "No shop selected.");
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return denied(401, "UNAUTHORIZED", "Sign in to continue.");
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    [SHOP_HEADER]: shopId,
  };
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  if (body !== undefined) headers["content-type"] = "application/json";

  try {
    const upstream = await fetch(`${decision.apiUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "x-vyora-upstream-request-id": upstream.headers.get("x-request-id") ?? "",
      },
    });
  } catch (cause) {
    // 502 is deliberate: the browser's own request was fine, so this must not
    // read as a rejection of the merchant's work. The sync engine treats it as
    // retryable and the queue is left untouched.
    return denied(
      502,
      "DEPENDENCY_UNAVAILABLE",
      `Could not reach the local API at ${decision.apiUrl}. Is it running? (${(cause as Error).message})`
    );
  }
}

/**
 * Confirm which shop this browser is working in.
 *
 * The API re-checks the membership, which is the whole point: a cached shop
 * list can name a shop the person was removed from an hour ago, and the honest
 * answer then is a refusal rather than a book that silently fails to write.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../forward";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  // The **public** shop code. The contract accepts a `merchantId` in no request
  // anywhere, and rebuilding the body here is what makes it impossible for one
  // to reach the API through this app even if a client sent it.
  const incoming = (await request.json().catch(() => ({}))) as { shopId?: unknown };
  const shopId = typeof incoming.shopId === "string" ? incoming.shopId : "";

  return forwardWithSession("POST", "/api/v1/shops/active", JSON.stringify({ shopId }));
}

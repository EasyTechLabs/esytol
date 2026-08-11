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
  const incoming = (await request.json().catch(() => ({}))) as { merchantId?: unknown };
  const merchantId = typeof incoming.merchantId === "string" ? incoming.merchantId : "";

  return forwardWithSession("POST", "/api/v1/shops/active", JSON.stringify({ merchantId }));
}

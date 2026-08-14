/**
 * Send a shop a list of what you want, customer-side.
 *
 * Addressed by the shop's **public** code, because a customer holds no
 * membership and no internal identifier. No prices: pricing is the shop's.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ shopId: string }> }
): Promise<NextResponse> {
  const { shopId } = await context.params;
  return forwardWithSession(
    "POST",
    `/api/v1/shops/${encodeURIComponent(shopId)}/quotes`,
    await request.text()
  );
}

/**
 * Item list: revise.
 *
 * The version travels in the body and the API checks it, so a stale one is
 * refused rather than applied.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ quoteId: string }> }
): Promise<NextResponse> {
  const { quoteId } = await context.params;
  return forwardWithSession(
    "POST",
    `/api/v1/quotes/${encodeURIComponent(quoteId)}/revise`,
    await request.text()
  );
}

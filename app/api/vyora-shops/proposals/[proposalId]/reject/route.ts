/**
 * Answer a proposal: reject.
 *
 * The version travels in the body and the API checks it. A stale version is
 * refused rather than applied, which is what stops a person agreeing to a
 * figure the other side has already changed.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> }
): Promise<NextResponse> {
  const { proposalId } = await context.params;
  return forwardWithSession(
    "POST",
    `/api/v1/proposals/${encodeURIComponent(proposalId)}/reject`,
    await request.text()
  );
}

/** Withdraw an invitation. The row is kept and marked, never removed. */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../../../forward";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invitationId: string }> }
): Promise<NextResponse> {
  const { invitationId } = await context.params;
  return forwardWithSession(
    "POST",
    `/api/v1/shops/invitations/${encodeURIComponent(invitationId)}/cancel`
  );
}

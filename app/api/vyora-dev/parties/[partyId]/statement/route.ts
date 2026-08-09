/**
 * Development-only proxy: a party's remote statement.
 *
 * Gated by the ledger *read* decision, which sits below the party read gate —
 * see `../../forward.ts`. Read-only: no other verb is exported.
 */

import type { NextResponse } from "next/server";
import { forwardLedgerRead } from "../../forward";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ partyId: string }> }
): Promise<NextResponse> {
  const { partyId } = await context.params;
  const limit = new URL(request.url).searchParams.get("limit");
  return forwardLedgerRead(
    `/${encodeURIComponent(partyId)}/statement`,
    limit ? `?limit=${encodeURIComponent(limit)}` : ""
  );
}

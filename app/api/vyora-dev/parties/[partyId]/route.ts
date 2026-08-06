/**
 * Development-only proxy for a single party read.
 *
 * Same gate, same server-held credential, same read-only posture as the list
 * route beside it. See `../route.ts` for why the proxy exists at all.
 */

import type { NextResponse } from "next/server";
import { forwardPartyRead } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ partyId: string }> }
): Promise<NextResponse> {
  const { partyId } = await context.params;
  return forwardPartyRead(`/${encodeURIComponent(partyId)}`, "");
}

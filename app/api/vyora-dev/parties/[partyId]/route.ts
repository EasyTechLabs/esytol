/**
 * Development-only proxy for a single party read.
 *
 * Same gate, same server-held credential, same read-only posture as the list
 * route beside it. See `../route.ts` for why the proxy exists at all.
 */

import type { NextResponse } from "next/server";
import { forwardPartyRead, forwardPartyWrite } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ partyId: string }> }
): Promise<NextResponse> {
  const { partyId } = await context.params;
  return forwardPartyRead(`/${encodeURIComponent(partyId)}`, "");
}

/**
 * Update a party. Development-only, and gated separately from reads.
 *
 * `If-Match` is forwarded rather than synthesised — the API requires it, and a
 * proxy that invented one would silently defeat optimistic concurrency.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ partyId: string }> }
): Promise<NextResponse> {
  const { partyId } = await context.params;
  return forwardPartyWrite(
    "PATCH",
    `/${encodeURIComponent(partyId)}`,
    await request.text(),
    request.headers
  );
}

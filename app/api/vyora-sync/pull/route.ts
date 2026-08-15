/**
 * Read the shop's log from where this browser got to.
 *
 * `cursor` and `limit` are passed through; `deviceId` is not sent at all. A
 * cursor identifies a position in the shop's log rather than a reader
 * (ADR-0015), so a browser — which will never have a device — reads with none
 * and excludes nothing. It receives its own pushed events back, which is
 * harmless: applying an event already held is a no-op.
 */

import type { NextResponse } from "next/server";
import { forwardSync } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();

  // Named explicitly rather than forwarded wholesale. An unexpected parameter
  // reaching the API is at best ignored and at worst a 400 on a sync the
  // merchant cannot see or fix.
  const cursor = incoming.get("cursor");
  const limit = incoming.get("limit");
  if (cursor) query.set("cursor", cursor);
  if (limit) query.set("limit", limit);

  return forwardSync("GET", `/api/v1/sync/pull?${query.toString()}`, request);
}

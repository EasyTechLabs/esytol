/**
 * Development-only proxy: party list.
 *
 * See `./forward.ts` for the gate, the server-held credential, and why this
 * proxy exists instead of the browser calling the API directly.
 */

import type { NextResponse } from "next/server";
import { forwardPartyRead, forwardPartyWrite, READ_PARAMS } from "./forward";

/** Never prerender or cache: this reads a live local service. */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const incoming = new URL(request.url).searchParams;

  // Allow-list rather than pass-through, so this proxy can only ever express a
  // read the API already supports.
  const allowed = new URLSearchParams();
  for (const key of READ_PARAMS) {
    const value = incoming.get(key);
    if (value !== null) allowed.set(key, value);
  }

  const search = allowed.toString();
  return forwardPartyRead("", search ? `?${search}` : "");
}

/** Create a party. Development-only, and gated separately from reads. */
export async function POST(request: Request): Promise<NextResponse> {
  return forwardPartyWrite("POST", "", await request.text(), request.headers);
}

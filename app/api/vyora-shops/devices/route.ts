/**
 * The phones this person has signed in on.
 *
 * Person-scoped upstream, so this route forwards and nothing else. It carries
 * no shop, takes no parameters, and adds no filtering of its own — the API
 * already returns the caller's own devices and nobody else's, and a second
 * opinion here could only ever be a worse one.
 *
 * The session token stays on this server, as it does for every route under
 * `/api/vyora-shops`. The browser never holds a credential and never holds an
 * installation key — the key exists only on the phone that made it, which is
 * why the browser can list devices but could never impersonate one.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/devices");
}

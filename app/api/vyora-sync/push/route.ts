/**
 * Send this browser's queued events to the shop's log.
 *
 * The body is forwarded verbatim. In particular it carries **no `deviceId`**,
 * and this route does not add one: a browser registers no device, and the API
 * attributes each event to an eligible device of the shop (ADR-0016). A route
 * that helpfully filled the field in would be inventing attribution — the exact
 * thing that decision removed.
 */

import type { NextResponse } from "next/server";
import { forwardSync } from "../forward";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  return forwardSync("POST", "/api/v1/sync/push", request, await request.text());
}

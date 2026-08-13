/**
 * The people in this shop.
 *
 * Owner-only, enforced upstream. This route forwards and nothing else — the
 * masking of email addresses happens on the API, so a bug here cannot widen
 * what a browser receives.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/shops/members");
}

/**
 * Localities a PIN code suggests.
 *
 * The API answers from a small local table and calls nothing outside the local
 * stack — no postal service, no geocoder, no address lookup. A merchant's
 * address does not leave their own machine.
 *
 * Only `pincode` is forwarded. An allow-list rather than a pass-through, so
 * this route can only ever express the read the API already supports.
 */

import { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const pincode = new URL(request.url).searchParams.get("pincode") ?? "";

  // Checked here so a half-typed value never becomes a request. The API
  // enforces the same shape; this just stops four wasted round trips while
  // somebody types six digits.
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "A PIN code is six digits." } },
      { status: 400 }
    );
  }

  return forwardWithSession("GET", `/api/v1/localities?${new URLSearchParams({ pincode })}`);
}

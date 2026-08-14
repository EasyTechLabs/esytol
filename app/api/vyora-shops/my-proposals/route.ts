/**
 * Proposals addressed to **me**, at any shop I deal with.
 *
 * Person-scoped rather than shop-scoped, and the distinction is not cosmetic: a
 * merchant is a customer of their own wholesaler, and those requests are theirs
 * personally rather than their shop's. Named `my-proposals` here so a browser
 * cannot confuse it with the shop's own list.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/my/proposals");
}

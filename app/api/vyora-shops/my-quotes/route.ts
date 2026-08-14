/**
 * Item lists addressed to **me**, at any shop I deal with.
 *
 * Person-scoped rather than shop-scoped: a merchant is a customer of their own
 * wholesaler, and those lists are theirs personally rather than their shop's.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/my/quotes");
}

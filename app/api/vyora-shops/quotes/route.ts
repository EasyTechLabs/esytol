/**
 * The active shop's item lists.
 *
 * Shop-scoped upstream, and the shop is **not** a parameter. It comes from the
 * person's selected shop, held server-side. A browser cannot name a shop on one
 * of these requests, so it cannot read or answer another shop's list by editing
 * a URL.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/quotes");
}

export async function POST(request: Request): Promise<NextResponse> {
  // Passed through untouched. There is deliberately no total in the body — the
  // API sums the lines and the database re-checks the sum.
  return forwardWithSession("POST", "/api/v1/quotes", await request.text());
}

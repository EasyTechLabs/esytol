/**
 * The active shop's proposals.
 *
 * Shop-scoped upstream, and the shop is **not** a parameter here. It comes from
 * the person's selected shop, held server-side and changed only by
 * `POST /shops/active`. That is the whole of active-shop safety on the web: a
 * browser cannot name a shop on one of these requests, so it cannot read or
 * answer another shop's proposal by editing a URL.
 *
 * The session token stays on this server, as everywhere under
 * `/api/vyora-shops`.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/proposals");
}

export async function POST(request: Request): Promise<NextResponse> {
  // Passed through untouched. The body is the contract's
  // `CreateProposalRequest` and the API validates it — a second, drifting copy
  // of those rules here would eventually disagree with the one that counts.
  return forwardWithSession("POST", "/api/v1/proposals", await request.text());
}

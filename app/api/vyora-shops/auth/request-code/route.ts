/**
 * Ask for a sign-in code.
 *
 * The body is rebuilt from the one field the operation takes rather than
 * relayed as-is. A pass-through would let a caller add fields the contract
 * rejects — and, worse, would make this route's surface whatever the upstream
 * schema happens to be on any given day.
 */

import type { NextResponse } from "next/server";
import { forwardPublic } from "../../forward";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const incoming = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof incoming.email === "string" ? incoming.email.trim() : "";

  // Not validated further here. The API answers 202 identically for a known
  // address, an unknown one, a malformed one and a rate-limited one, and a
  // stricter check in this proxy would turn that into a membership oracle by
  // rejecting some addresses faster than others.
  return forwardPublic("/api/v1/auth/email/request-code", JSON.stringify({ email }));
}

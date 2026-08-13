/**
 * Invitations this shop has issued, and creating one.
 *
 * The create body is rebuilt from the three fields the operation takes. This
 * route adds no validation of its own beyond shape: the API answers identically
 * whether an address has an account or not, and a stricter check here would
 * turn that into a membership oracle by rejecting some inputs faster than
 * others.
 */

import type { NextResponse } from "next/server";
import { forwardWithSession } from "../forward";

export const dynamic = "force-dynamic";

const ROLES = new Set(["owner", "staff", "viewer"]);

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/shops/invitations");
}

export async function POST(request: Request): Promise<NextResponse> {
  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const body: Record<string, string> = {};
  if (typeof incoming.email === "string" && incoming.email.trim()) {
    body.email = incoming.email.trim().toLowerCase();
  }
  if (typeof incoming.personId === "string" && incoming.personId.trim()) {
    body.personId = incoming.personId.trim();
  }
  if (typeof incoming.role === "string" && ROLES.has(incoming.role)) body.role = incoming.role;

  return forwardWithSession("POST", "/api/v1/shops/invitations", JSON.stringify(body));
}

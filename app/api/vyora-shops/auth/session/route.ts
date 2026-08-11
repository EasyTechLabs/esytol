/**
 * Who this browser is signed in as, and how to stop being.
 *
 * `GET` proxies `/me` so the client can render the signed-in address without
 * ever holding the token that proves it. `DELETE` clears the cookie.
 *
 * Signing out deletes the cookie whatever the API says. A sign-out that fails
 * because the server is unreachable would leave someone signed in on a shared
 * shop computer having been told they were not — the worst possible direction
 * for that error to fall.
 */

import { NextResponse } from "next/server";
import { forwardWithSession } from "../../forward";
import { SESSION_COOKIE } from "@/lib/vyora/shop-session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return forwardWithSession("GET", "/api/v1/me");
}

export async function DELETE(): Promise<NextResponse> {
  // Best-effort: the API is told, and the result is not allowed to matter.
  await forwardWithSession("POST", "/api/v1/auth/logout", "{}").catch(() => undefined);

  const response = NextResponse.json({ status: "signed-out" });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

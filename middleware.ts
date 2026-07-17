/**
 * Edge middleware — guards every /admin route (P0-2).
 *
 * A thin adapter over `lib/adminAuth.ts`, which owns the rule. Anonymous requests
 * get 401 + a Basic challenge (the browser shows its credential prompt); correct
 * credentials pass through untouched. If ADMIN_USER / ADMIN_PASSWORD are not set
 * in the environment, access is denied for everyone — fail closed, never open.
 *
 * Public routes are untouched: the matcher scopes this middleware to /admin and
 * its children only, so it adds zero latency anywhere else.
 */

import { NextResponse, type NextRequest } from "next/server";
import { configuredCredentials, isAuthorized } from "@/lib/adminAuth";

export async function middleware(request: NextRequest) {
  const authorized = await isAuthorized(
    request.headers.get("authorization"),
    configuredCredentials()
  );
  if (authorized) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Esytol Admin", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const config = {
  // :path* matches zero or more segments, so bare /admin is covered too.
  matcher: "/admin/:path*",
};

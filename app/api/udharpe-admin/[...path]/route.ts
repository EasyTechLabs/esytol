/**
 * The administrator forwarder.
 *
 * The browser never holds the session token. It lives in an httpOnly cookie,
 * is read here on the server, and is attached to a request the browser could
 * not make itself — the same discipline the shop forwarder uses, for the same
 * reason: a credential in browser JavaScript is a credential you have
 * published.
 *
 * ## The allowlist is the control
 *
 * Every request is checked against an explicit method-and-path list. A prefix
 * match on `/api/v1/admin/` would be enough today and would silently admit
 * whatever gets added under that prefix next. The gate is re-evaluated per
 * request rather than trusted from the UI, because a hand-written `fetch` to
 * this path skips the UI entirely.
 *
 * ## 404 when the panel is off
 *
 * Not 403. As far as any caller is concerned this endpoint does not exist, and
 * saying "forbidden" advertises that an admin surface is there to be found.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminApiDecision,
  adminCookieOptions,
  mayForward,
} from "@/lib/udharpe/admin-session";

const NOT_FOUND = NextResponse.json(
  { error: { code: "NOT_FOUND", message: "No such endpoint." } },
  { status: 404 }
);

/** Paths reachable before there is a session, so the panel can obtain one. */
const UNAUTHENTICATED = new Set([
  "/api/v1/auth/email/request-code",
  "/api/v1/auth/email/verify-code",
]);

async function forward(request: Request, method: string): Promise<NextResponse> {
  const decision = adminApiDecision();
  if (!decision.enabled || !decision.apiUrl) return NOT_FOUND;

  const url = new URL(request.url);
  const path = "/" + url.pathname.replace(/^\/api\/udharpe-admin\/?/, "");
  const withQuery = path + (url.search || "");

  if (!mayForward(method, withQuery)) return NOT_FOUND;

  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  if (!token && !UNAUTHENTICATED.has(path)) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in to the admin panel first." } },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (body) headers["content-type"] = "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${decision.apiUrl}${withQuery}`, { method, headers, body });
  } catch (cause) {
    return NextResponse.json(
      {
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: `Could not reach the Udharpe API. (${(cause as Error).message})`,
        },
      },
      { status: 503 }
    );
  }

  // A capture comes back as bytes, not JSON.
  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/")) {
    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      status: upstream.status,
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  }

  const text = await upstream.text();
  const response = new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

  // A successful sign-in mints the cookie here, on the server. The token is in
  // this response body on its way past us and must not reach the browser, so
  // the body is replaced with what the panel actually needs.
  if (path === "/api/v1/auth/email/verify-code" && upstream.ok) {
    try {
      const parsed = JSON.parse(text) as { token?: string; person?: { email?: string } };
      if (parsed.token) {
        const secure = new URL(request.url).protocol === "https:";
        const safe = NextResponse.json({ ok: true, email: parsed.person?.email ?? null });
        safe.cookies.set(ADMIN_SESSION_COOKIE, parsed.token, adminCookieOptions(secure));
        return safe;
      }
    } catch {
      /* fall through and return what the API said */
    }
  }

  if (path === "/api/v1/auth/logout") {
    const cleared = NextResponse.json({ ok: true });
    cleared.cookies.set(ADMIN_SESSION_COOKIE, "", { ...adminCookieOptions(false), maxAge: 0 });
    return cleared;
  }

  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  return forward(request, "GET");
}

export async function POST(request: Request): Promise<NextResponse> {
  return forward(request, "POST");
}

/**
 * The shared forwarder behind every administrator route.
 *
 * The browser never holds the session token. It lives in an httpOnly cookie,
 * is read here on the server, and is attached to a request the browser could
 * not make itself — a credential in browser JavaScript is a credential you
 * have published.
 *
 * ## Explicit routes, not a catch-all
 *
 * This started as one `[...path]` handler that reconstructed the upstream path
 * from the URL. Next's bundler would not build it on this setup, which turned
 * out to be a favour: reconstructing a path from a request and then checking it
 * against an allowlist is two chances to disagree about what the path is, and
 * the checking half is the one holding the door. Each route now names its own
 * upstream path as a literal, so there is nothing to reconstruct and nothing to
 * get wrong.
 *
 * ## 404 when the panel is off
 *
 * Not 403. As far as any caller is concerned these endpoints do not exist, and
 * saying "forbidden" advertises that an admin surface is there to be found.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminApiDecision,
  adminCookieOptions,
  mayForward,
} from "./admin-session";

const notFound = () =>
  NextResponse.json(
    { error: { code: "NOT_FOUND", message: "No such endpoint." } },
    { status: 404 }
  );

/** Reachable before there is a session, so the panel can obtain one. */
const UNAUTHENTICATED = new Set([
  "/api/v1/auth/email/request-code",
  "/api/v1/auth/email/verify-code",
]);

export interface ForwardOptions {
  /** The upstream path, written as a literal by the calling route. */
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly request: Request;
}

export async function forwardToApi({
  path,
  method,
  request,
}: ForwardOptions): Promise<NextResponse> {
  const decision = adminApiDecision();
  if (!decision.enabled || !decision.apiUrl) return notFound();

  // The allowlist still runs. The path is a literal here, so this is belt and
  // braces rather than the control it was — but a route added later that gets
  // its path slightly wrong should fail closed rather than reach something.
  if (!mayForward(method, path)) return notFound();

  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const bare = path.split("?")[0]!;
  if (!token && !UNAUTHENTICATED.has(bare)) {
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
    upstream = await fetch(`${decision.apiUrl}${path}`, { method, headers, body });
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

  // A successful sign-in mints the cookie here. The token is in this body on
  // its way past us and must not continue to the browser, so the body is
  // replaced with what the panel actually needs.
  if (bare === "/api/v1/auth/email/verify-code" && upstream.ok) {
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

  if (bare === "/api/v1/auth/logout") {
    const cleared = NextResponse.json({ ok: true });
    cleared.cookies.set(ADMIN_SESSION_COOKIE, "", { ...adminCookieOptions(false), maxAge: 0 });
    return cleared;
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** The six review decisions, as a closed set the route can check against. */
export const APPLICATION_ACTIONS = [
  "open",
  "approve",
  "reject",
  "request-changes",
  "suspend",
  "reinstate",
] as const;

export type ApplicationAction = (typeof APPLICATION_ACTIONS)[number];

export function isApplicationAction(value: string): value is ApplicationAction {
  return (APPLICATION_ACTIONS as readonly string[]).includes(value);
}

/** Ids reaching the upstream path are checked, not trusted. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

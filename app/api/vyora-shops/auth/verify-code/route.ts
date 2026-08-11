/**
 * Exchange a code for a session, and keep the token here.
 *
 * This is the one route that turns an API response into a cookie, and the one
 * place the token exists in this app at all. What goes back to the browser is
 * the person's id and email — never the token, never its expiry as a value the
 * client could act on independently of the cookie.
 *
 * Stripping the token is not cosmetic. If it were returned, a client could keep
 * a copy in `localStorage` "to be safe", and the httpOnly cookie would then be
 * protecting a credential that also sits in readable storage.
 */

import { NextResponse } from "next/server";
import { forwardPublic } from "../../forward";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/vyora/shop-session";

export const dynamic = "force-dynamic";

interface WireSession {
  token?: unknown;
  person?: { personId?: unknown; email?: unknown };
}

export async function POST(request: Request): Promise<NextResponse> {
  const incoming = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    code?: unknown;
  };

  const body = JSON.stringify({
    email: typeof incoming.email === "string" ? incoming.email.trim() : "",
    code: typeof incoming.code === "string" ? incoming.code.trim() : "",
  });

  const upstream = await forwardPublic("/api/v1/auth/email/verify-code", body);

  // Every refusal — wrong, expired, used, superseded, out of attempts — comes
  // back as the API sent it. This route adds no distinctions of its own.
  if (upstream.status !== 200) return upstream;

  const session = (await upstream.json().catch(() => ({}))) as WireSession;
  if (typeof session.token !== "string" || !session.token) {
    return NextResponse.json(
      { error: { code: "UPSTREAM_INVALID", message: "The API returned no session." } },
      { status: 502 }
    );
  }

  const response = NextResponse.json({
    person: {
      personId: session.person?.personId ?? null,
      email: session.person?.email ?? null,
    },
  });

  // `x-forwarded-proto` rather than the request URL: behind a proxy the URL
  // this handler sees is the internal one, and marking the cookie insecure
  // because of that would send it in the clear on a deployment that terminates
  // TLS upstream.
  const isSecure =
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:";

  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(isSecure));
  return response;
}

/**
 * The gate and forwarder for Vyora sign-in and shop routes.
 *
 * Everything the browser needs from the API for onboarding goes through here,
 * for one reason: **the session token is a credential, and a credential in
 * browser JavaScript is a credential you have published.** It lives in an
 * httpOnly cookie, is read on this server, and is attached to a request the
 * browser could not make itself.
 *
 * The gate is re-evaluated per request rather than trusted from the client. A
 * client-side check is a UI affordance; this is the control, because a
 * hand-written `fetch` to these paths skips the UI entirely.
 *
 * ## What is reachable through here
 *
 * The five shop operations and the two sign-in operations. There is no ledger
 * path, no sync path, and no `DELETE` — nothing routed through here can remove
 * a shop, a party or an event log.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, shopApiDecision } from "@/lib/vyora/shop-session";

interface Denial {
  status: number;
  code: string;
  message: string;
}

function denied({ status, code, message }: Denial): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * 404, not 403, when the feature is off: as far as any caller is concerned
 * this endpoint does not exist, and saying otherwise advertises it.
 */
function gate(): { ok: true; apiUrl: string } | { ok: false; denial: Denial } {
  const decision = shopApiDecision();
  if (!decision.enabled) {
    return { ok: false, denial: { status: 404, code: "NOT_FOUND", message: decision.reason } };
  }
  return { ok: true, apiUrl: decision.apiUrl };
}

/**
 * Forward a request that does not need a session — the two sign-in operations.
 *
 * Never attaches a credential, because at this point there is none. The
 * response body is passed back untouched: `request-code` answers identically
 * for a known address, an unknown one and a rate-limited one, and rewriting it
 * here would be the one place that difference could leak.
 */
export async function forwardPublic(path: string, body: string): Promise<NextResponse> {
  const check = gate();
  if (!check.ok) return denied(check.denial);

  try {
    const upstream = await fetch(`${check.apiUrl}${path}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "x-vyora-upstream-request-id": upstream.headers.get("x-request-id") ?? "",
      },
    });
  } catch (cause) {
    return unreachable(check.apiUrl, cause);
  }
}

/**
 * Forward a request that needs the caller's session.
 *
 * A missing cookie is answered 401 here rather than sent upstream to be
 * refused. It saves a round trip, and more importantly it means "you are signed
 * out" and "the server rejected your token" are the same answer to the browser
 * — the client has one branch to write, not two that behave identically.
 */
export async function forwardWithSession(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: string
): Promise<NextResponse> {
  const check = gate();
  if (!check.ok) return denied(check.denial);

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return denied({ status: 401, code: "UNAUTHORIZED", message: "Sign in to continue." });
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    // Server-side only. This header never exists in the browser.
    authorization: `Bearer ${token}`,
  };
  if (body !== undefined) {
    // Merge Patch has its own media type, and the contract declares the PATCH
    // body under it. Sending plain JSON there is a 415 on a body the server
    // would otherwise have accepted.
    headers["content-type"] =
      method === "PATCH" ? "application/merge-patch+json" : "application/json";
  }

  try {
    const upstream = await fetch(`${check.apiUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      cache: "no-store",
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "x-vyora-upstream-request-id": upstream.headers.get("x-request-id") ?? "",
      },
    });
  } catch (cause) {
    return unreachable(check.apiUrl, cause);
  }
}

function unreachable(apiUrl: string, cause: unknown): NextResponse {
  return denied({
    status: 502,
    code: "DEPENDENCY_UNAVAILABLE",
    message: `Could not reach the local API at ${apiUrl}. Is it running? (${(cause as Error).message})`,
  });
}

/**
 * The gate and the forwarder shared by both development proxy routes.
 *
 * This exists for one reason: **the development identity is a credential, and a
 * credential in browser JavaScript is a credential you have published.**
 * `VYORA_API_DEV_IDENTITY` has no `NEXT_PUBLIC_` prefix, so Next never inlines
 * it into a client bundle; it is read here, on the server, and attached to a
 * request the browser cannot make itself.
 *
 * The gate is re-evaluated per request rather than trusted from the client. A
 * client-side check is a UI affordance; this one is the actual control, because
 * a hand-written fetch to this path bypasses the UI entirely.
 *
 * Reads only. Neither route exports POST, PATCH or DELETE, so nothing reachable
 * through this proxy can change anything — on the API or on the device.
 */

import { NextResponse } from "next/server";
import { decidePartyApi } from "@/lib/vyora/party-api-config";

const DEV_IDENTITY_ENV = "VYORA_API_DEV_IDENTITY";

interface Denial {
  status: number;
  code: string;
  message: string;
}

function denied({ status, code, message }: Denial): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

type Gate = { ok: true; apiUrl: string; identity: string } | { ok: false; denial: Denial };

/**
 * Note this reads `NODE_ENV` from the **server** process, so a production
 * deployment refuses here even if a stale `NEXT_PUBLIC_` flag was baked into
 * the client bundle at build time.
 */
export function gate(): Gate {
  const decision = decidePartyApi({
    flag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_VYORA_API_URL,
  });

  if (!decision.enabled) {
    // 404, not 403: when the feature is off this endpoint does not exist as far
    // as any caller is concerned, and saying otherwise advertises it.
    return { ok: false, denial: { status: 404, code: "NOT_FOUND", message: decision.reason } };
  }

  const identity = process.env[DEV_IDENTITY_ENV];
  if (!identity) {
    return {
      ok: false,
      denial: {
        status: 503,
        code: "DEV_IDENTITY_MISSING",
        message: `${DEV_IDENTITY_ENV} is not set on the server. Set it in .env.local (never NEXT_PUBLIC_).`,
      },
    };
  }

  return { ok: true, apiUrl: decision.apiUrl, identity };
}

/** Forward one read to the local API, or explain why it was refused. */
export async function forwardPartyRead(path: string, search: string): Promise<NextResponse> {
  const check = gate();
  if (!check.ok) return denied(check.denial);

  const target = `${check.apiUrl}/api/v1/parties${path}${search}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        // Server-side only. This header never exists in the browser.
        "x-vyora-dev-identity": check.identity,
        accept: "application/json",
      },
      cache: "no-store",
    });

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        // Lets a browser failure be correlated with the API's own log line.
        "x-vyora-upstream-request-id": upstream.headers.get("x-request-id") ?? "",
      },
    });
  } catch (cause) {
    return denied({
      status: 502,
      code: "DEPENDENCY_UNAVAILABLE",
      message: `Could not reach the local API at ${check.apiUrl}. Is it running? (${(cause as Error).message})`,
    });
  }
}

/** Query parameters a read may carry. Anything else is dropped, not forwarded. */
export const READ_PARAMS = ["q", "limit", "cursor", "position", "updatedSince"] as const;

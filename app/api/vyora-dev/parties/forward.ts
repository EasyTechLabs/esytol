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
 * Reads and two writes. `GET` (list, detail), `POST` (create) and `PATCH`
 * (update) are the entire surface. There is deliberately no `DELETE` and no
 * sync path, so nothing reachable through this proxy can remove a party or
 * move an event log.
 *
 * Nothing here ever writes to the device. A remote write goes to the API and
 * only to the API — never to local storage, and never to both.
 */

import { NextResponse } from "next/server";
import { decidePartyApi, decidePartyWrites } from "@/lib/vyora/party-api-config";

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

/**
 * The write gate: everything the read gate requires, plus the write flag.
 *
 * Re-evaluated on the server rather than trusted from the client, for the same
 * reason the read gate is. A hand-written `fetch` to this path skips the UI
 * entirely, so this is the control that actually holds.
 */
export function writeGate(): Gate {
  const decision = decidePartyWrites({
    flag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_READS_ENABLED,
    writeFlag: process.env.NEXT_PUBLIC_VYORA_API_PARTY_WRITES_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_VYORA_API_URL,
  });

  if (!decision.enabled) {
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

/** Request headers a write may carry. Everything else is dropped, not forwarded. */
export const WRITE_HEADERS = ["idempotency-key", "if-match"] as const;

/**
 * Forward one write to the local API.
 *
 * Only `POST` (create) and `PATCH` (update) are reachable. There is no `DELETE`
 * and no sync path, so nothing routed through here can remove a party or move
 * an event log.
 *
 * The upstream `ETag` is passed straight back, because the client needs it for
 * the next `If-Match` and inventing one here would break optimistic
 * concurrency in a way that only shows up as a lost edit.
 */
export async function forwardPartyWrite(
  method: "POST" | "PATCH",
  path: string,
  body: string,
  incoming: Headers
): Promise<NextResponse> {
  const check = writeGate();
  if (!check.ok) return denied(check.denial);

  const headers: Record<string, string> = {
    // Server-side only. This header never exists in the browser.
    "x-vyora-dev-identity": check.identity,
    accept: "application/json",
    "content-type": incoming.get("content-type") ?? "application/json",
  };
  for (const name of WRITE_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) headers[name] = value;
  }

  try {
    const upstream = await fetch(`${check.apiUrl}/api/v1/parties${path}`, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const out = new Headers({
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "x-vyora-upstream-request-id": upstream.headers.get("x-request-id") ?? "",
    });
    const etag = upstream.headers.get("etag");
    if (etag) out.set("etag", etag);

    return new NextResponse(await upstream.text(), { status: upstream.status, headers: out });
  } catch (cause) {
    // The write did not reach the API. The caller must treat this as "nothing
    // happened" and must not fall back to a local write.
    return denied({
      status: 502,
      code: "DEPENDENCY_UNAVAILABLE",
      message: `Could not reach the local API at ${check.apiUrl}. Is it running? (${(cause as Error).message})`,
    });
  }
}

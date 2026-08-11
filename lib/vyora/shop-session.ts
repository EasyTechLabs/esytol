/**
 * Vyora — the browser's session, and where it deliberately is not.
 *
 * ## The token never reaches browser JavaScript
 *
 * The phone keeps its session behind the Android Keystore. A browser has no
 * equivalent, and the two places a token could go in one — `localStorage` and a
 * readable cookie — are both readable by any script that ends up on the page.
 * On a Next app that means every dependency in the bundle, forever.
 *
 * So the token is set as an **httpOnly** cookie by a route handler and read
 * only on the server. The browser can prove it has a session (the cookie is
 * sent) and cannot read, copy, log or exfiltrate it. Client code that wants
 * something from the API asks this app's own server, which attaches the
 * credential.
 *
 * That is the same shape as the existing development party proxy, and for the
 * same reason — except the credential here is the *person's own session* rather
 * than a shared fixture identity, so it is held per-browser in a cookie instead
 * of per-server in an environment variable.
 *
 * ## Why this is still development-only
 *
 * `sameSite: "lax"` and a loopback-only API are enough for a local stack and
 * are not a considered answer for the public internet — there is no CSRF token
 * on the write routes, no rotation, and no revocation list. The gate below
 * refuses production outright rather than leaving that to a deployment note.
 */

import { isLoopbackUrl, DEFAULT_API_URL, type PartyApiDecision } from "./party-api-config";

/**
 * The cookie's name.
 *
 * No `NEXT_PUBLIC_` anything, and nothing about it is readable from script —
 * the name is only used server-side to find the value.
 */
export const SESSION_COOKIE = "vyora_session";

/**
 * How long the browser keeps it.
 *
 * Shorter than the API's own token lifetime on purpose: the cookie expiring
 * early means a sign-in screen, which is recoverable. A cookie outliving its
 * token means every request fails with a 401 that looks like a broken app.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: string;
  readonly maxAge: number;
}

/**
 * `secure` is off for a loopback development stack, because `http://127.0.0.1`
 * would otherwise never receive the cookie at all. It is the one property that
 * varies, and it varies with the transport rather than with a flag someone
 * could set wrongly.
 */
export function sessionCookieOptions(isSecureTransport: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureTransport,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export interface ShopApiEnv {
  readonly nodeEnv: string | undefined;
  readonly apiUrl: string | undefined;
}

/**
 * Whether this build may reach the API for sign-in and shops.
 *
 * Deliberately **not** built on `decidePartyApi`. That decision is gated by the
 * party read flag and backed by a shared fixture identity; this one is gated by
 * neither, because the credential is a real person's own session and the flow
 * exists to obtain it. Sharing a gate would have meant either exposing sign-in
 * whenever party reads were on, or requiring a fixture identity to sign in as
 * yourself — both wrong in different directions.
 *
 * What it does share is the two rules that actually protect anything: no
 * production, and loopback only.
 */
export function decideShopApi(env: ShopApiEnv): PartyApiDecision {
  if (env.nodeEnv === "production") {
    return {
      enabled: false,
      reason:
        "This is a production build. Vyora sign-in and shop setup are local-development only.",
    };
  }

  const apiUrl = env.apiUrl ?? DEFAULT_API_URL;
  if (!isLoopbackUrl(apiUrl)) {
    return {
      enabled: false,
      reason: "The API URL is not loopback. Vyora sign-in is localhost-only.",
    };
  }

  return { enabled: true, apiUrl };
}

/** Read the decision from the ambient environment. */
export function shopApiDecision(): PartyApiDecision {
  return decideShopApi({
    nodeEnv: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_VYORA_API_URL,
  });
}

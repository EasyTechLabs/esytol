/**
 * The Udharpe administrator session, and which API it may reach.
 *
 * ## Why this is separate from `lib/vyora/shop-session.ts`
 *
 * That module refuses any API URL that is not loopback, and it is right to:
 * the shop web flows were written when nothing was deployed, and a browser
 * flow that could be pointed at production by an environment variable is a
 * browser flow somebody eventually points at production by accident.
 *
 * The administrator panel genuinely has to reach the deployed API — reviewing
 * applications against a local database reviews nothing. So it gets its own
 * decision with its own rules rather than a relaxation of that one. Loosening
 * the existing gate would have widened the shop flows at the same time, for no
 * reason, and nobody reading it later would know which change was intended.
 *
 * ## The rules here
 *
 * 1. Off unless `UDHARPE_ADMIN_ENABLED` says otherwise. A panel that is on by
 *    default is on in every preview deployment and every developer's checkout.
 * 2. HTTPS, or loopback for development. Never plaintext to a remote host.
 * 3. The host must be named explicitly. There is no default production URL
 *    here, so a misconfiguration fails closed rather than reaching somewhere
 *    unintended.
 *
 * ## The token never reaches the browser
 *
 * Same discipline as the shop session: an httpOnly cookie set by a route
 * handler, read on the server, attached to a request the browser could not
 * make itself. A credential in browser JavaScript is a credential you have
 * published.
 */

export const ADMIN_SESSION_COOKIE = "udharpe_admin_session";

export interface AdminApiDecision {
  readonly enabled: boolean;
  readonly apiUrl?: string;
  readonly reason?: string;
}

export interface AdminApiEnv {
  readonly enabled?: string;
  readonly apiUrl?: string;
}

function isLoopback(url: URL): boolean {
  return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
}

export function decideAdminApi(env: AdminApiEnv): AdminApiDecision {
  if (env.enabled !== "true") {
    return {
      enabled: false,
      reason: "The Udharpe admin panel is off. Set UDHARPE_ADMIN_ENABLED=true to turn it on.",
    };
  }

  const raw = env.apiUrl?.trim();
  if (!raw) {
    return {
      enabled: false,
      reason: "UDHARPE_ADMIN_API_URL is not set. There is deliberately no default.",
    };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { enabled: false, reason: `UDHARPE_ADMIN_API_URL is not a URL: ${raw}` };
  }

  if (url.protocol !== "https:" && !isLoopback(url)) {
    return {
      enabled: false,
      reason: "The admin API must be https, or loopback for development.",
    };
  }

  return { enabled: true, apiUrl: raw.replace(/\/$/, "") };
}

export function adminApiDecision(): AdminApiDecision {
  return decideAdminApi({
    enabled: process.env.UDHARPE_ADMIN_ENABLED,
    apiUrl: process.env.UDHARPE_ADMIN_API_URL,
  });
}

/**
 * Cookie options for the administrator session.
 *
 * `sameSite: "strict"` rather than the usual `lax`: nothing should navigate
 * into an administrative action from another site, and an admin panel is
 * exactly the surface where a cross-site GET that happens to be a state change
 * would matter most.
 */
export function adminCookieOptions(isSecureTransport: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    secure: isSecureTransport,
    path: "/",
    // Shorter than a shopkeeper's session. An administrator leaving a panel
    // open on a shared machine is a realistic way for this to go wrong.
    maxAge: 60 * 60 * 8,
  };
}

/**
 * The only API paths the browser may reach through the admin forwarder.
 *
 * An allowlist rather than a prefix match. `/api/v1/admin/` as a prefix would
 * have been enough today and would silently admit whatever is added under that
 * prefix next — including, one day, something that should never have been
 * reachable from a browser at all.
 */
export const ADMIN_FORWARDABLE = [
  { method: "GET", pattern: /^\/api\/v1\/admin\/applications$/ },
  {
    method: "POST",
    pattern:
      /^\/api\/v1\/admin\/applications\/[0-9a-f-]{36}\/(open|approve|reject|request-changes|suspend|reinstate)$/,
  },
  { method: "GET", pattern: /^\/api\/v1\/admin\/disputes$/ },
  { method: "POST", pattern: /^\/api\/v1\/admin\/disputes\/[0-9a-f-]{36}\/decide$/ },
  { method: "GET", pattern: /^\/api\/v1\/admin\/audit(\?.*)?$/ },
  { method: "GET", pattern: /^\/api\/v1\/admin\/captures\/[0-9a-f-]{36}$/ },
  // Sign-in, so the panel can obtain a session at all.
  { method: "POST", pattern: /^\/api\/v1\/auth\/email\/request-code$/ },
  { method: "POST", pattern: /^\/api\/v1\/auth\/email\/verify-code$/ },
  { method: "POST", pattern: /^\/api\/v1\/auth\/logout$/ },
] as const;

export function mayForward(method: string, path: string): boolean {
  return ADMIN_FORWARDABLE.some((r) => r.method === method && r.pattern.test(path));
}

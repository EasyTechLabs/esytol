/**
 * Authentication abstraction — EXPOSE-001.
 *
 * The API requires **no authentication today** (a public compute API). This
 * module exists so API keys, bearer tokens, or enterprise auth can be added
 * later *without changing any route* — a route calls `authenticate(req)` and
 * reacts to the result; swapping the authenticator swaps the policy.
 *
 * EXPOSE-001 ships only the public authenticator. No auth product, no keys.
 */

import type { ApiErrorItem } from "./http";

export interface AuthResult {
  authenticated: boolean;
  /** Who the caller is. "public" until keys/bearer are introduced. */
  principal: string;
  /** The scheme that authenticated them. */
  scheme: "none" | "apiKey" | "bearer";
  /** Present only when authentication fails. */
  error?: ApiErrorItem;
}

export type Authenticator = (req: Request) => AuthResult;

/** The current, default policy: everyone is allowed, as an anonymous public caller. */
export const publicAuthenticator: Authenticator = () => ({
  authenticated: true,
  principal: "public",
  scheme: "none",
});

/**
 * A future API-key authenticator, provided as the extension seam (NOT wired in).
 * When keys are introduced (EXPOSE-002+), set `authConfig.authenticator` to this
 * (or a bearer variant) and no route changes.
 */
export function apiKeyAuthenticator(validKeys: ReadonlySet<string>): Authenticator {
  return (req: Request): AuthResult => {
    const key = req.headers.get("x-api-key");
    if (key && validKeys.has(key)) {
      return { authenticated: true, principal: `key:${key.slice(0, 6)}…`, scheme: "apiKey" };
    }
    return {
      authenticated: false,
      principal: "anonymous",
      scheme: "apiKey",
      error: { code: "unauthorized", message: "A valid X-Api-Key header is required." },
    };
  };
}

/** The active authenticator. Swap this field to change policy platform-wide. */
export const authConfig: { authenticator: Authenticator } = {
  authenticator: publicAuthenticator,
};

export function authenticate(req: Request): AuthResult {
  return authConfig.authenticator(req);
}

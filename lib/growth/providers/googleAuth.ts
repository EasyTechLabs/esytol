/**
 * Google authentication for the growth providers.
 *
 * Supports two credential styles, resolved in this order:
 *   1. GOOGLE_ACCESS_TOKEN — a pre-minted OAuth access token (backwards compatible).
 *   2. Service Account — a JSON key provided inline via GOOGLE_SERVICE_ACCOUNT_JSON,
 *      or as a file path via GOOGLE_APPLICATION_CREDENTIALS. A short-lived access
 *      token is minted by signing a JWT (RS256) with the account's private key and
 *      exchanging it at Google's token endpoint.
 *
 * Uses only Node built-ins (crypto, fs) — no external dependency. The Service
 * Account JSON is read at runtime from the environment and is never committed.
 */

import crypto from "node:crypto";
import fs from "node:fs";

export const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** Reads the Service Account key from inline JSON or a file path, if present. */
export function getServiceAccount(): ServiceAccount | null {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let raw: string | null = null;
  if (inline && inline.trim().startsWith("{")) {
    raw = inline;
  } else if (filePath && fs.existsSync(filePath)) {
    raw = fs.readFileSync(filePath, "utf8");
  }
  if (!raw) return null;

  try {
    const json = JSON.parse(raw) as Partial<ServiceAccount>;
    if (json.client_email && json.private_key) {
      return { client_email: json.client_email, private_key: json.private_key };
    }
  } catch {
    return null;
  }
  return null;
}

/** True when either a direct access token or a Service Account is configured. */
export function hasGoogleAuth(): boolean {
  return Boolean(process.env.GOOGLE_ACCESS_TOKEN) || getServiceAccount() !== null;
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** Builds and RS256-signs the JWT assertion for the token exchange. */
export function buildServiceAccountJwt(sa: ServiceAccount, scope: string, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + 3600;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp,
    })
  );
  const signingInput = `${header}.${claims}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  // Env-provided keys may carry literal "\n"; file-provided keys have real newlines.
  const pem = sa.private_key.replace(/\\n/g, "\n");
  const signature = signer.sign(pem).toString("base64url");
  return `${signingInput}.${signature}`;
}

// Module-level token cache (keyed by scope) — avoids re-minting on every request
// within a warm serverless instance.
let cached: { token: string; exp: number; scope: string } | null = null;

/** Resets the token cache (used in tests). */
export function resetTokenCache(): void {
  cached = null;
}

/**
 * Returns a Google OAuth access token for the given scope, or null when no
 * credentials are configured. Throws only on an actual auth failure (which the
 * calling provider catches and turns into a graceful sample fallback).
 */
export async function getGoogleAccessToken(
  scope: string,
  now: Date = new Date()
): Promise<string | null> {
  const direct = process.env.GOOGLE_ACCESS_TOKEN;
  if (direct) return direct;

  const sa = getServiceAccount();
  if (!sa) return null;

  const nowSec = Math.floor(now.getTime() / 1000);
  if (cached && cached.scope === scope && cached.exp - 60 > nowSec) {
    return cached.token;
  }

  const assertion = buildServiceAccountJwt(sa, scope, now);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${res.statusText}`);

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Google token response missing access_token");

  cached = { token: json.access_token, exp: nowSec + (json.expires_in ?? 3600), scope };
  return json.access_token;
}

/**
 * Admin authentication — the single implementation of the /admin access rule.
 *
 * Consumed by `middleware.ts` (the only place that should enforce it). Pure and
 * framework-free so it is unit-testable without the edge runtime, mirroring the
 * engine/UI split used everywhere else in this repo.
 *
 * Design decisions:
 *
 * - **HTTP Basic auth against server-side env vars** (`ADMIN_USER`,
 *   `ADMIN_PASSWORD`). One founder, no user database, no PII, no session state,
 *   no login page to build or maintain — and it composes with the browser's own
 *   credential prompt. This deliberately does NOT introduce user accounts: the
 *   platform's privacy position ("no accounts, nothing leaves your browser")
 *   applies to visitors, not to the owner's admin door.
 *
 * - **Fail closed.** If the env vars are not configured, NOBODY gets in — not
 *   everybody. An unconfigured production deploy is locked, never open. This is
 *   the opposite of the failure mode that exposed /admin/growth publicly.
 *
 * - **Digest-then-compare.** Credentials are compared via SHA-256 digests with a
 *   constant-time byte comparison, so the comparison cannot leak prefix length
 *   through timing. `crypto.subtle` is available in both the edge runtime and
 *   Node ≥ 20.
 */

export interface AdminCredentials {
  user: string;
  password: string;
}

/** The configured credentials, or null when auth is (deliberately or not) unset. */
export function configuredCredentials(
  env: Record<string, string | undefined> = process.env
): AdminCredentials | null {
  const user = env.ADMIN_USER?.trim();
  const password = env.ADMIN_PASSWORD?.trim();
  if (!user || !password) return null;
  return { user, password };
}

/** Parse an `Authorization: Basic …` header. Returns null for anything malformed. */
export function parseBasicAuth(header: string | null): AdminCredentials | null {
  if (!header || !header.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

/** Constant-time equality via SHA-256 digests (prefix timing cannot leak). */
export async function digestEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(da);
  const bytesB = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

/**
 * The verdict: does this Authorization header grant admin access?
 *
 * False when auth is unconfigured (fail closed), when the header is absent or
 * malformed, and when either credential is wrong. Both comparisons always run, so
 * a wrong username costs the same time as a wrong password.
 */
export async function isAuthorized(
  header: string | null,
  credentials: AdminCredentials | null
): Promise<boolean> {
  if (!credentials) return false;
  const supplied = parseBasicAuth(header);
  if (!supplied) return false;
  const [userOk, passwordOk] = await Promise.all([
    digestEqual(supplied.user, credentials.user),
    digestEqual(supplied.password, credentials.password),
  ]);
  return userOk && passwordOk;
}

/**
 * JWT teaching engine — the educational layer of the JWT Decoder (TOOL-004).
 *
 * The decode (lib/dev/parse.parseJwt) and HS256 verification (lib/dev/crypto.
 * verifyJwtHs256) already exist and are tested — this module does NOT re-implement
 * them. It turns a decoded token into an *explanation*: what each header/claim means,
 * human-readable timestamps, expiry/not-before status, and technically-correct
 * security notes.
 *
 * Honesty rules baked in:
 *  - Decoding is never called "verification". A signature is only "verified" when
 *    verifyJwtHs256 actually ran and matched.
 *  - `alg: none` is flagged as unsigned/unauthenticated (the classic JWT pitfall).
 *  - Asymmetric algorithms are explained as un-verifiable here (no public key), never
 *    silently ignored.
 */

// ─── Algorithm classification ────────────────────────────────────────────────

export type AlgFamily = "hmac" | "rsa" | "ecdsa" | "eddsa" | "none" | "unknown";

export function algFamily(alg: unknown): AlgFamily {
  if (typeof alg !== "string") return "unknown";
  const a = alg.toUpperCase();
  if (a === "NONE") return "none";
  if (a.startsWith("HS")) return "hmac";
  if (a.startsWith("RS") || a.startsWith("PS")) return "rsa";
  if (a.startsWith("ES")) return "ecdsa";
  if (a === "EDDSA") return "eddsa";
  return "unknown";
}

/** Only HS256 can be verified in-browser here (matches lib/dev/crypto.verifyJwtHs256). */
export function isVerifiableHere(alg: unknown): boolean {
  return alg === "HS256";
}

// ─── Claim dictionaries (RFC 7515 / 7519) ────────────────────────────────────

interface ClaimMeta {
  label: string;
  description: string;
}

const HEADER_CLAIMS: Record<string, ClaimMeta> = {
  alg: { label: "Algorithm", description: "The signing / MAC algorithm (RFC 7515 §4.1.1)." },
  typ: { label: "Type", description: 'The token media type, usually "JWT" (RFC 7519 §5.1).' },
  cty: {
    label: "Content Type",
    description: "Media type of a nested JWT payload (RFC 7519 §5.2).",
  },
  kid: {
    label: "Key ID",
    description: "A hint indicating which key signed the token (RFC 7515 §4.1.4).",
  },
  jku: {
    label: "JWK Set URL",
    description: "URL of the signer's public keys as a JWK Set (RFC 7515 §4.1.2).",
  },
  jwk: {
    label: "JSON Web Key",
    description: "The public key used to sign, embedded as a JWK (RFC 7515 §4.1.3).",
  },
  x5u: { label: "X.509 URL", description: "URL of the X.509 certificate chain (RFC 7515 §4.1.5)." },
  x5c: { label: "X.509 Chain", description: "The X.509 certificate chain (RFC 7515 §4.1.6)." },
  x5t: {
    label: "X.509 Thumbprint",
    description: "SHA-1 thumbprint of the signing certificate (RFC 7515 §4.1.7).",
  },
  crit: {
    label: "Critical",
    description: "Extensions that a recipient must understand (RFC 7515 §4.1.11).",
  },
};

const PAYLOAD_CLAIMS: Record<string, ClaimMeta> = {
  iss: { label: "Issuer", description: "Who issued the token (RFC 7519 §4.1.1)." },
  sub: {
    label: "Subject",
    description: "Who the token is about — typically the user ID (RFC 7519 §4.1.2).",
  },
  aud: { label: "Audience", description: "Who the token is intended for (RFC 7519 §4.1.3)." },
  exp: {
    label: "Expiration Time",
    description: "The token must NOT be accepted at or after this time (RFC 7519 §4.1.4).",
  },
  nbf: {
    label: "Not Before",
    description: "The token must NOT be accepted before this time (RFC 7519 §4.1.5).",
  },
  iat: { label: "Issued At", description: "When the token was issued (RFC 7519 §4.1.6)." },
  jti: {
    label: "JWT ID",
    description: "A unique identifier for the token, to prevent replay (RFC 7519 §4.1.7).",
  },
};

const TIME_CLAIMS = new Set(["exp", "nbf", "iat"]);

export interface ClaimExplanation {
  key: string;
  label: string;
  description: string;
  value: unknown;
  /** For NumericDate claims (exp/nbf/iat): the ISO time the seconds value represents. */
  time?: string;
  known: boolean;
}

function isNumericDate(key: string, value: unknown): value is number {
  return TIME_CLAIMS.has(key) && typeof value === "number" && Number.isFinite(value);
}

function explain(
  obj: Record<string, unknown>,
  dict: Record<string, ClaimMeta>
): ClaimExplanation[] {
  return Object.entries(obj).map(([key, value]) => {
    const meta = dict[key];
    return {
      key,
      label: meta?.label ?? key,
      description:
        meta?.description ??
        "Custom (private) claim — application-specific, not defined by the JWT spec.",
      value,
      time: isNumericDate(key, value) ? new Date(value * 1000).toISOString() : undefined,
      known: Boolean(meta),
    };
  });
}

export function explainHeader(header: Record<string, unknown>): ClaimExplanation[] {
  return explain(header, HEADER_CLAIMS);
}

export function explainPayload(payload: Record<string, unknown>): ClaimExplanation[] {
  return explain(payload, PAYLOAD_CLAIMS);
}

// ─── Expiry / not-before analysis ────────────────────────────────────────────

export interface TemporalStatus {
  hasExp: boolean;
  expiresAt?: Date;
  expired?: boolean;
  msUntilExpiry?: number;
  hasNbf: boolean;
  notBefore?: Date;
  notYetValid?: boolean;
  hasIat: boolean;
  issuedAt?: Date;
}

export function analyzeTemporal(
  payload: Record<string, unknown>,
  now: number = Date.now()
): TemporalStatus {
  const status: TemporalStatus = { hasExp: false, hasNbf: false, hasIat: false };
  if (typeof payload.exp === "number") {
    status.hasExp = true;
    status.expiresAt = new Date(payload.exp * 1000);
    status.msUntilExpiry = payload.exp * 1000 - now;
    status.expired = status.msUntilExpiry <= 0;
  }
  if (typeof payload.nbf === "number") {
    status.hasNbf = true;
    status.notBefore = new Date(payload.nbf * 1000);
    status.notYetValid = payload.nbf * 1000 > now;
  }
  if (typeof payload.iat === "number") {
    status.hasIat = true;
    status.issuedAt = new Date(payload.iat * 1000);
  }
  return status;
}

/** "in 2 days" / "3 hours ago" — a signed, human relative time. */
export function relativeTime(ms: number): string {
  const past = ms < 0;
  const s = Math.round(Math.abs(ms) / 1000);
  const units: [number, string][] = [
    [31557600, "year"],
    [2629800, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  if (s < 1) return "now";
  for (const [secs, name] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      const label = `${n} ${name}${n === 1 ? "" : "s"}`;
      return past ? `${label} ago` : `in ${label}`;
    }
  }
  return past ? "just now" : "in a moment";
}

// ─── Security notes ──────────────────────────────────────────────────────────

export type Severity = "critical" | "warning" | "info" | "ok";

export interface SecurityNote {
  severity: Severity;
  title: string;
  detail: string;
}

/**
 * Technically-correct security analysis. `verified` is passed only when an actual
 * HS256 verification has run (true/false); leave it undefined when no verification
 * was attempted — this function never *implies* verification.
 */
export function securityNotes(
  header: Record<string, unknown>,
  temporal: TemporalStatus,
  verified?: boolean
): SecurityNote[] {
  const notes: SecurityNote[] = [];
  const alg = header.alg;
  const family = algFamily(alg);

  // Always true, and the most common misconception.
  notes.push({
    severity: "info",
    title: "Decoding is not encryption",
    detail:
      "A JWT's header and payload are Base64url-encoded, not encrypted — anyone holding the token can read them. Never put secrets (passwords, keys, PII you must protect) in a JWT payload.",
  });

  switch (family) {
    case "none":
      notes.push({
        severity: "critical",
        title: 'Algorithm is "none" — the token is unsigned',
        detail:
          'The header declares alg: "none", meaning there is no signature to check. A server that accepts such a token performs no verification at all — this is the classic JWT "alg:none" vulnerability. Treat this token as completely unauthenticated.',
      });
      break;
    case "hmac":
      notes.push({
        severity: "info",
        title: `Signed with HMAC (${String(alg)})`,
        detail: isVerifiableHere(alg)
          ? "HMAC uses a single shared secret for both signing and verifying. Paste the secret below to verify the signature here, entirely in your browser."
          : `HMAC uses a shared secret. This tool verifies HS256 only, so ${String(
              alg
            )} cannot be checked here — but the signature is symmetric, so anyone with the secret can verify it.`,
      });
      break;
    case "rsa":
    case "ecdsa":
    case "eddsa":
      notes.push({
        severity: "warning",
        title: `Signed with an asymmetric algorithm (${String(alg)})`,
        detail:
          "Asymmetric signatures are verified with the issuer's PUBLIC KEY, which is not contained in the token. Without that key this tool cannot verify the signature — and decoding the token tells you nothing about whether it is authentic. Fetch the issuer's public key (often from its JWKS endpoint) and verify server-side.",
      });
      break;
    default:
      notes.push({
        severity: "warning",
        title: "Unrecognised algorithm",
        detail: `The header's alg value (${JSON.stringify(
          alg
        )}) is not a standard JWT algorithm. Do not trust a token whose algorithm you cannot identify.`,
      });
  }

  if (temporal.expired) {
    notes.push({
      severity: "warning",
      title: "This token has expired",
      detail: `The exp claim is in the past (${temporal.expiresAt?.toISOString()}). A correct server will reject it.`,
    });
  } else if (!temporal.hasExp) {
    notes.push({
      severity: "info",
      title: "No expiry (exp) claim",
      detail:
        "This token has no exp claim, so it never expires on its own. Long-lived tokens are risky if leaked — prefer short lifetimes plus refresh tokens.",
    });
  }

  if (temporal.notYetValid) {
    notes.push({
      severity: "warning",
      title: "This token is not valid yet",
      detail: `The nbf (not-before) claim is in the future (${temporal.notBefore?.toISOString()}). It should be rejected until then.`,
    });
  }

  if (verified === true) {
    notes.push({
      severity: "ok",
      title: "Signature verified (HS256)",
      detail:
        "The signature matches the secret you provided. This confirms integrity and authenticity for the HS256 secret given.",
    });
  } else if (verified === false) {
    notes.push({
      severity: "warning",
      title: "Signature did not match",
      detail:
        "The HS256 signature does not match the secret you provided. Either the secret is wrong or the token was altered.",
    });
  }

  return notes;
}

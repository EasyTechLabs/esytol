# JWT Decoder & Verifier — Tool Documentation

> **Category:** Security · **Slug:** `jwt-decoder` · **Route:** `/tools/jwt-decoder`
> **Status:** ✅ Live · **Last Updated:** 2026-07-18
> **Engine:** `lib/security/jwtInsights.ts` (reuses `lib/dev/parse.parseJwt` + `lib/dev/crypto.verifyJwtHs256`) · **UI:** `features/tools/jwt-decoder/JwtDecoder.tsx`

The build record for the JWT Decoder & Verifier — the Security category's fourth tool.
It is a **teaching tool**: it decodes a token _and_ explains it, honestly.

---

## 1. Problem

Developers decode JWTs constantly while debugging auth — but most online decoders (a) send the
token to a server, (b) only Base64-decode it, and (c) blur the crucial line between _decoding_ and
_verifying_. Esytol needs a decoder that educates: explain every field, show expiry, verify HS256
locally, and state — precisely and correctly — what a token does and does not prove.

## 2. Existing reusable code

- **`lib/dev/parse.parseJwt`** (DEVELOPER-001) — already splits and Base64url-decodes header/payload/
  signature into a typed `JwtParts`. **The decode was not re-implemented.**
- **`lib/dev/crypto.verifyJwtHs256`** — already verifies HS256 signatures via Web Crypto and honestly
  reports non-HS256 as un-verifiable. **The verification was not re-implemented.**
- **`lib/dev/files.downloadText`**, **`EverydayInput`**, **`DevToolLayout`**, **`CopyButton`**,
  **DeveloperTrust**, the `security` domain routing, and the SEO framework — reused unchanged.

## 3. Architecture reuse

The only new logic is the **teaching layer**, `lib/security/jwtInsights.ts`, which imports the
decoded shape and turns it into explanations, timestamps, and security notes. It changes no shared
lib. This is exactly the intended composition: decode + verify already existed, so the sprint added
understanding, not plumbing.

## 4. Implementation

`lib/security/jwtInsights.ts` (pure, injectable clock):

- `algFamily` / `isVerifiableHere` — classify HS/RS/PS/ES/EdDSA/none; only HS256 is verifiable here.
- `explainHeader` / `explainPayload` — label every RFC 7515/7519 claim; mark unknown ones "custom";
  attach ISO time to `exp`/`nbf`/`iat` (NumericDate).
- `analyzeTemporal` — expiry/not-before/issued-at status + countdown.
- `relativeTime` — signed human duration ("in 2 days" / "3 hours ago").
- `securityNotes` — technically-correct notes: **alg:none = critical/unsigned**, **asymmetric = can't
  verify without the public key**, decode ≠ encryption, expired/no-exp/not-yet-valid, and a verified
  note **only when an actual HS256 check passed** (`verified` is undefined until then).

UI (`JwtDecoder.tsx`):

- Paste a token (or load the **playground sample** — the canonical jwt.io HS256 token, which verifies
  with `your-256-bit-secret`).
- Header + Payload cards: pretty JSON + per-claim explanations + timestamps.
- Live **expiry countdown** banner (ticks each second when an `exp` exists).
- Signature card: for HS256, a secret input + **Verify** (real Web Crypto check); for other algs, an
  explanation of why it can't be verified in the browser.
- **Security analysis** list (severity + text label, colour-independent).
- Copy decoded JSON, Download `.json`.

## 5. Shared improvements

None to shared libs — parse/verify/files were already the right shape. The reusable teaching engine
lives in `lib/security/jwtInsights.ts` for any future auth tool to use.

## 6. Tests

- **Engine (`tests/lib/security/jwtInsights.test.ts`, 15):** alg classification; claim labelling
  (known + custom) + NumericDate ISO; temporal analysis (expired/valid-countdown/nbf/absent);
  `relativeTime`; and the security-note correctness suite — **alg:none critical**, **asymmetric
  needs public key**, **HS256 offers but never claims verification without a check**, verified only
  when it actually passed, always "decoding ≠ encryption", expired/no-exp handling.
- **UI (`tests/features/jwt-decoder/JwtDecoder.test.tsx`, 6):** decode header/payload with
  explanations; **verify a correct HS256 signature** (real); wrong secret reported honestly with **no
  false "verified"**; alg:none flagged + no secret input offered; malformed-token error; always warns
  decoding ≠ encryption.

## 7. Documentation

This file + the in-app DeveloperTrust surface (how it works, decode≠verify, HS256-only, alg:none;
references RFC 7519/7515/7518 + OWASP JWT cheat sheet) + a 6-item registry FAQ.

## 8. Registry updates

**New** registry entry `jwt-decoder` (Security category), best-in-class description + 12 keywords +
6 FAQs, related tools (Hash, UUID, Password, Base64, JSON). `toolStatus` guardrail updated.

## 9. ProductFactory updates

Sprint record `Sprints/TOOL-004-JwtDecoder/README.md`; registry row 47; CurrentState (27 live tools,
Security 4); Metrics.

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — JWT Decoder & Verifier).

## 11. Verification / quality checklist

- [x] Production UI, responsive, dark-mode follows platform theme.
- [x] Accessibility: labelled input, `role="alert"`/`status` for errors + verify result, security
      list labelled, severity conveyed by **text label + colour** (colour-independent), keyboard-operable.
- [x] SEO: metadata, canonical, OG/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb),
      6-item FAQ, related tools.
- [x] Security/privacy: **token + secret never leave the browser** (no network); **never implies
      verification** that didn't happen; alg:none = critical; asymmetric = honestly un-verifiable;
      "decoding ≠ encryption" always shown. OWASP-aligned.
- [x] Reuse: parseJwt + verifyJwtHs256 + downloadText + layout/trust/SEO reused; no duplicated logic;
      no TODOs/placeholders/dead code.
- [x] Performance: synchronous decode; verify is one async Web Crypto call; countdown interval cleaned
      up on unmount; no heavy deps.
- [x] i18n-ready; zero-login.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## Honest limitations

- Only **HS256** signatures are verifiable in-browser; RS/PS/ES/EdDSA need the issuer's public key and
  are explained, not faked.
- The tool decodes — it never claims a token is authentic on decoding alone.
- The playground sample is the public jwt.io test token, not a real credential.
- Dark mode follows the platform theme (the site is light-only platform-wide today).

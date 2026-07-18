/**
 * Developer-tool trust data — PLATFORM-003.
 *
 * The developer-category analogue of content/methodology.ts. Finance tools are
 * judged on regulator-cited methodology; developer tools are judged on where the
 * work happens (browser vs server), what is retained, the standard they
 * implement, and their limits. Same idea — a trust surface beside the tool —
 * with fields that fit the domain instead of contorting finance ones.
 *
 * Keyed by tool slug, exactly like getMethodology(). Rendered by DeveloperTrust.
 */

export interface StandardRef {
  label: string;
  url?: string;
}

export interface DevStandard {
  /** Where the tool runs. V1 developer tools are all "client". */
  processing: "client" | "server";
  /** One line on data retention — for client tools, that nothing is retained. */
  dataRetention: string;
  /** Plain-language "how it works". */
  howItWorks: string;
  /** Honest limits — encoding≠encryption, engine quirks, size caveats. */
  limitations: string[];
  /** Standards / RFCs the tool implements. Clickable when a url is present. */
  references: StandardRef[];
  /** Who maintains the tool. */
  maintainedBy: string;
}

const MAINTAINER = "EasyTechLabs Engineering";

const CLIENT_ONLY =
  "Nothing you paste, type, or drop is uploaded, stored, or logged. All processing happens in your browser and the data never leaves your device — close the tab and it is gone.";

export const DEV_STANDARDS: Record<string, DevStandard> = {
  "json-formatter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Your input is parsed with the browser's native JSON parser and re-serialised with your chosen indentation (2, 4, tab, or minified); optional key-sorting produces canonical output. Invalid JSON is reported with the line and column plus a plain-English explanation of the likely cause. Beyond parsing, a lightweight tokenizer scans the raw text for duplicate keys and integers outside JavaScript's safe range — signals that JSON.parse erases — and computes statistics (objects, arrays, properties, depth, value types) for the tree view.",
    limitations: [
      "Formatting normalises whitespace and (optionally) key order; it never changes values, so numbers keep their exact JSON representation.",
      "The interactive tree view is limited for very large documents (tens of thousands of values) to stay responsive; formatting and validation still work at any size.",
      "Comments and trailing commas are not valid JSON and are reported as errors — this is a strict RFC 8259 parser, not JSON5.",
    ],
    references: [
      {
        label: "RFC 8259 — The JSON Data Interchange Format",
        url: "https://www.rfc-editor.org/rfc/rfc8259",
      },
      {
        label: "ECMA-404 — The JSON Data Interchange Syntax",
        url: "https://ecma-international.org/publications-and-standards/standards/ecma-404/",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "base64-encoder": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Text is encoded to UTF-8 bytes and then to Base64, so non-ASCII characters (₹, é, emoji) survive a round trip. Decoding reverses this and accepts both standard and URL-safe input, restoring padding automatically. An optional URL-safe mode swaps +/ for -_ and drops padding.",
    limitations: [
      "Base64 is encoding, not encryption — anyone can decode a Base64 string. It provides no confidentiality.",
      "Base64 grows data by roughly one third; it is for safe transport over text channels, not compression.",
      "Decoding invalid Base64 (wrong length or non-alphabet characters) is reported as an error rather than producing garbage.",
    ],
    references: [
      {
        label: "RFC 4648 — The Base16, Base32, and Base64 Data Encodings",
        url: "https://www.rfc-editor.org/rfc/rfc4648",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "url-encoder": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Component mode uses encodeURIComponent to percent-encode reserved characters (& ? = / #), which is correct for query-parameter and path-segment values. Full mode uses encodeURI, preserving URL structure for encoding a whole URL. Decoding reverses either mode and flags malformed percent-sequences.",
    limitations: [
      "Component mode escapes URL-reserved characters; full mode deliberately does not — choose the mode that matches whether you are encoding a value or a whole URL.",
      "A lone '%' or an invalid '%zz' sequence cannot be decoded and is reported as an error.",
      "Percent-encoding operates on UTF-8 bytes, matching modern browsers and the WHATWG URL standard.",
    ],
    references: [
      {
        label: "RFC 3986 — Uniform Resource Identifier (URI): Generic Syntax",
        url: "https://www.rfc-editor.org/rfc/rfc3986",
      },
      { label: "WHATWG URL Standard", url: "https://url.spec.whatwg.org/" },
    ],
    maintainedBy: MAINTAINER,
  },
  "jwt-decoder": {
    processing: "client",
    dataRetention:
      "Your token and any secret you enter to verify it are processed entirely in your browser and are never uploaded, stored, or logged. A JWT often contains identity data — decoding it here keeps it on your device.",
    howItWorks:
      "The token's three Base64url segments (header.payload.signature) are decoded to JSON in your browser. Each registered claim is explained, and the exp/nbf/iat timestamps are shown as human-readable dates with a live expiry countdown. For HS256 tokens you can paste the shared secret to verify the signature locally with the Web Crypto API (HMAC-SHA256). Decoding never verifies a signature — the tool states this plainly, flags alg:\"none\" as unsigned, and explains why RS256/ES256 tokens need the issuer's public key.",
    limitations: [
      "Decoding is not verification, and a JWT is Base64url-encoded, not encrypted — anyone with the token can read the payload. Never store secrets in it.",
      "Only HS256 signatures can be verified here; asymmetric algorithms (RS/PS/ES/EdDSA) require the issuer's public key, which is not in the token.",
      'A token with alg:"none" is unsigned — it carries no signature to check and must never be trusted as authenticated.',
    ],
    references: [
      { label: "RFC 7519 — JSON Web Token (JWT)", url: "https://www.rfc-editor.org/rfc/rfc7519" },
      {
        label: "RFC 7515 — JSON Web Signature (JWS)",
        url: "https://www.rfc-editor.org/rfc/rfc7515",
      },
      {
        label: "RFC 7518 — JSON Web Algorithms (JWA)",
        url: "https://www.rfc-editor.org/rfc/rfc7518",
      },
      {
        label: "OWASP — JWT security cheat sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "uuid-generator": {
    processing: "client",
    dataRetention:
      "Every UUID is generated on your device and is never uploaded, stored, or logged. Names you enter for v3/v5 and UUIDs you paste to validate stay in your browser.",
    howItWorks:
      "Random UUIDs (v4, and the random parts of v1/v7) use the Web Crypto API — the same secure source as crypto.randomUUID(), never Math.random. Time-based v1 and v7 embed a timestamp; v1 uses a random node ID with the multicast bit set, so it never leaks your MAC address. Name-based v3 (MD5) and v5 (SHA-1) hash the namespace and name with the shared crypto library, so the same inputs always produce the same UUID. The validator reads the version and variant bits directly and, for v1/v7, reconstructs the embedded timestamp.",
    limitations: [
      "v1 here uses a privacy-safe random node instead of a hardware MAC address — the standard permits this, but it means the node field is not tied to a machine.",
      "v3 uses MD5 and v5 uses SHA-1; both are fine for deriving identifiers but should not be treated as secure hashes. Prefer v5 over v3, and v7 for new time-ordered IDs.",
      "A UUID is an identifier, not a secret — v4 is unguessable, but do not use any UUID as a security token or password.",
    ],
    references: [
      {
        label: "RFC 9562 — Universally Unique IDentifiers (UUIDs)",
        url: "https://www.rfc-editor.org/rfc/rfc9562",
      },
      { label: "RFC 4122 — A UUID URN Namespace", url: "https://www.rfc-editor.org/rfc/rfc4122" },
      {
        label: "MDN — Crypto.randomUUID()",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "hash-generator": {
    processing: "client",
    dataRetention:
      "Your text and files are hashed entirely on your device — nothing is uploaded, stored, or logged. Files are read into memory only to compute the digest and are never sent anywhere.",
    howItWorks:
      "SHA-1, SHA-256, and SHA-512 are computed with the Web Crypto API (SubtleCrypto), your platform's native, audited implementation. MD5 uses a small pure-JavaScript implementation (Web Crypto does not offer it). Files are hashed as raw bytes, so a checksum matches the one published by the file's author. HMAC mode combines your message and a secret key into a keyed hash for authentication. Paste an expected hash into the verify box to confirm a download's integrity.",
    limitations: [
      "MD5 and SHA-1 are broken against collision attacks — use them only for non-security checksums and legacy compatibility. For integrity and security, use SHA-256 or SHA-512.",
      "A hash proves integrity, not confidentiality: it is not encryption and cannot be reversed to recover the input.",
      "In-browser file hashing is capped at 5 MB so a large file cannot hang the tab; larger files are best hashed with a native tool.",
    ],
    references: [
      {
        label: "FIPS 180-4 — Secure Hash Standard (SHA-1/2)",
        url: "https://csrc.nist.gov/pubs/fips/180-4/upd1/final",
      },
      {
        label: "RFC 1321 — The MD5 Message-Digest Algorithm",
        url: "https://www.rfc-editor.org/rfc/rfc1321",
      },
      {
        label: "RFC 2104 — HMAC: Keyed-Hashing for Message Authentication",
        url: "https://www.rfc-editor.org/rfc/rfc2104",
      },
      {
        label: "MDN — SubtleCrypto.digest()",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "password-generator": {
    processing: "client",
    dataRetention:
      "Every password is generated on your own device and is never uploaded, stored, logged, or transmitted. There is no account and no history — close the tab and it is gone.",
    howItWorks:
      "Randomness comes from the Web Crypto API (crypto.getRandomValues), your operating system's cryptographically secure source — never Math.random. Each character or word is chosen with rejection sampling, so there is no modulo bias and every option is equally likely. Passphrase mode picks words from a 256-word list (8 bits of entropy per word). Strength is reported as real entropy — the password length times log2 of the character-pool size, or the word count times log2 of the list size — not a guessed score.",
    limitations: [
      "The crack-time estimate assumes an offline attacker making 100 billion guesses per second against a weak hash; a well-salted, slow hash (bcrypt/argon2) is far harder, so treat it as a conservative worst case.",
      "A password is only as safe as where you store it — use a password manager and never reuse a password across sites.",
      "Entropy measures resistance to guessing the exact output; it does not protect against phishing, keyloggers, or a breached website.",
    ],
    references: [
      {
        label: "MDN — Crypto.getRandomValues()",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues",
      },
      {
        label: "NIST SP 800-63B — Digital Identity (Authenticator) Guidelines",
        url: "https://pages.nist.gov/800-63-3/sp800-63b.html",
      },
      {
        label: "EFF — Diceware passphrases",
        url: "https://www.eff.org/dice",
      },
    ],
    maintainedBy: MAINTAINER,
  },
};

export function getDevStandard(slug: string): DevStandard | undefined {
  return DEV_STANDARDS[slug];
}

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
  "xml-formatter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "A controlled, single-pass tokenizer parses your XML into a node tree, checks well-formedness (balanced/nested tags, quoted and unique attributes, a single root, terminated comments/CDATA/PIs/DOCTYPE) and reports the line and column of any problem. Formatting re-serialises the tree with your chosen indentation (or minified), preserving names, attributes, text, CDATA, comments, and entity references exactly. A summary collects the declaration, DOCTYPE, namespaces, processing instructions, entity references, and duplicate attributes. The tokenizer is used deliberately instead of a DOM parser.",
    limitations: [
      "This validates *well-formedness*, not *validity* against a DTD or XML Schema — schema validation is out of scope.",
      "Formatting normalises inter-element whitespace and attribute quoting; it never changes element names, attribute values, text, or entity references.",
      "The interactive tree view is limited for very large documents (many thousands of elements); formatting and validation are not.",
    ],
    references: [
      { label: "XML 1.0 (Fifth Edition)", url: "https://www.w3.org/TR/xml/" },
      { label: "XML Namespaces 1.0", url: "https://www.w3.org/TR/xml-names/" },
      {
        label: "OWASP — XML External Entity (XXE) Prevention",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  // ─── Encoding & Escape family (PLATFORM-005) — one trust model, one engine ───
  "html-entity-encoder": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Encoding replaces the five HTML-significant characters (& < > \" ') with their named entities so text renders literally instead of being parsed as markup. Decoding resolves named, decimal (&#38;), and hexadecimal (&#x26;) entities back to characters. Both directions are pure string transforms that run in your browser.",
    limitations: [
      "Encoding covers the HTML-significant characters; it does not convert every character to a named entity (that is unnecessary and less readable).",
      "HTML-encoding is context-sensitive: it protects HTML body and attribute contexts, but URL and JavaScript contexts need their own encoding. Use it with framework auto-escaping and a CSP.",
    ],
    references: [
      {
        label: "WHATWG HTML — Named character references",
        url: "https://html.spec.whatwg.org/multipage/named-characters.html",
      },
      {
        label: "OWASP — Cross Site Scripting Prevention",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "hex-converter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Encoding converts text to UTF-8 bytes and writes each byte as two lowercase hexadecimal digits (space-separated for readability). Decoding accepts spaced, continuous, or 0x-prefixed hex, validates the digits, and reconstructs the UTF-8 bytes back to text. Pure and byte-accurate.",
    limitations: [
      "Hexadecimal is a representation, not encryption — it provides no confidentiality.",
      "Decoding requires an even number of hex digits (two per byte) and only 0–9 / a–f; anything else is reported as an error rather than producing garbage.",
    ],
    references: [
      { label: "RFC 4648 — Base16 (hex) encoding", url: "https://www.rfc-editor.org/rfc/rfc4648" },
      {
        label: "MDN — TextEncoder",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "binary-converter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Encoding converts text to UTF-8 bytes and writes each byte as an 8-bit binary group (space-separated). Decoding accepts spaced or continuous bits, validates that the length is a multiple of 8, and reconstructs the bytes back to text. Pure and byte-accurate.",
    limitations: [
      "This converts text characters to their binary byte representation, not decimal numbers to binary.",
      "Decoding requires a multiple of 8 bits and only 0/1; anything else is reported as an error.",
    ],
    references: [
      {
        label: "MDN — TextEncoder",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder",
      },
      { label: "The Unicode Standard — UTF-8", url: "https://www.unicode.org/versions/latest/" },
    ],
    maintainedBy: MAINTAINER,
  },
  "unicode-escape-converter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Encoding writes every character as a \\uXXXX escape using its UTF-16 code units, so an astral character such as an emoji becomes a surrogate pair (two escapes). Decoding resolves \\uXXXX and \\xXX escapes back to characters and reassembles surrogate pairs. Pure string transforms.",
    limitations: [
      "Emoji and other characters above U+FFFF are represented as a surrogate pair (two \\uXXXX escapes) — this is how JavaScript string literals work.",
      "Only \\uXXXX and \\xXX escapes are interpreted on decode; other backslash escapes are handled by the Backslash String Escaper.",
    ],
    references: [
      {
        label: "ECMAScript — String literals & escape sequences",
        url: "https://tc39.es/ecma262/#sec-literals-string-literals",
      },
      { label: "The Unicode Standard", url: "https://www.unicode.org/versions/latest/" },
    ],
    maintainedBy: MAINTAINER,
  },
  "string-escaper": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Escaping turns raw text into a safe string-literal body: a backslash becomes \\\\, then newlines, carriage returns, tabs, null bytes, and double quotes become their \\-escapes. Unescaping interprets those sequences plus \\b \\f \\v \\' \\/ and \\uXXXX / \\xXX; an unknown escape is kept literal. Pure string transforms.",
    limitations: [
      "This escapes a single string value, not a whole document — for JSON use the JSON Formatter.",
      "An unrecognised escape sequence is preserved exactly rather than dropped, so no information is lost.",
    ],
    references: [
      {
        label: "ECMAScript — String literals & escape sequences",
        url: "https://tc39.es/ecma262/#sec-literals-string-literals",
      },
      { label: "RFC 8259 — JSON (string escapes)", url: "https://www.rfc-editor.org/rfc/rfc8259" },
    ],
    maintainedBy: MAINTAINER,
  },
  "csv-json-converter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "CSV → JSON: a single-pass RFC 4180 tokenizer parses your text (auto-detecting the delimiter when asked), handling quoted fields, escaped quotes, delimiters and newlines inside quotes, and Unicode, and reports the row and column of any problem. The header row names the JSON keys (duplicates are made unique) and each row becomes an object; optional type inference converts obvious numbers, booleans, and null. JSON → CSV: nested objects are flattened with dot notation, columns take a stable first-seen order, and every cell is quoted only when it must be. A cell that a spreadsheet could read as a formula is neutralised so it stays plain text. Everything is pure and runs in your browser.",
    limitations: [
      "Type inference is off by default (every cell is a string, which is lossless). When on, leading-zero values, very large integers, and anything ambiguous are deliberately kept as strings.",
      "JSON → CSV flattens objects with dot notation; arrays and remaining structure are written as compact JSON inside a cell so columns stay stable — it is not a full relational normalisation.",
      "The table preview renders the first rows for responsiveness; the full data is always in the output and download. The JSON tree is limited only for very large documents.",
    ],
    references: [
      {
        label: "RFC 4180 — Common Format for CSV Files",
        url: "https://www.rfc-editor.org/rfc/rfc4180",
      },
      { label: "RFC 8259 — JSON", url: "https://www.rfc-editor.org/rfc/rfc8259" },
      {
        label: "OWASP — CSV Injection",
        url: "https://owasp.org/www-community/attacks/CSV_Injection",
      },
    ],
    maintainedBy: MAINTAINER,
  },
  "json-diff-viewer": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "Both documents are parsed with the browser's native JSON parser and validated independently (with line/column and a plain-English reason on failure). The parsed values are then compared structurally — recursively over object keys and array indices — into a diff tree that marks each node added, removed, changed, or type-changed, collapsing identical branches. The same comparison produces an RFC 6902 JSON Patch (add/remove/replace) that transforms the left document into the right one. Statistics count added/removed/modified/unchanged nodes and the maximum depth of the differences.",
    limitations: [
      "Arrays are compared by index (element 0 vs 0, 1 vs 1, …); a reordered array shows the shifted elements as changed rather than moved. This is the standard, predictable behaviour for a JSON diff.",
      "The interactive diff tree renders lazily and can filter to changed-only nodes; extremely large documents remain responsive, but very deep nesting is compared with a safety cap.",
      "The RFC 6902 patch is generated for the index-aligned diff (array additions append, removals are emitted highest-index-first) — apply it with any standard JSON Patch library.",
    ],
    references: [
      { label: "RFC 8259 — JSON", url: "https://www.rfc-editor.org/rfc/rfc8259" },
      { label: "RFC 6902 — JSON Patch", url: "https://www.rfc-editor.org/rfc/rfc6902" },
      { label: "RFC 6901 — JSON Pointer", url: "https://www.rfc-editor.org/rfc/rfc6901" },
    ],
    maintainedBy: MAINTAINER,
  },
  "json-yaml-converter": {
    processing: "client",
    dataRetention: CLIENT_ONLY,
    howItWorks:
      "JSON is parsed with the browser's native parser; YAML with js-yaml. The parsed value is serialised to the other format — JSON with your chosen indentation, YAML with clean 2-space indentation. Conversion is lossless for standard data. YAML constructs JSON cannot represent are resolved to plain values: aliases expand to a copy of their anchored value, merge keys (`<<:`) are merged in (own keys win), and a multi-document stream becomes a JSON array. A raw-text scan surfaces each of these, plus duplicate keys and unsafe integers, so nothing changes silently. Statistics and the tree view reuse the JSON insight engine.",
    limitations: [
      "JSON cannot express YAML references, so aliases are expanded (repeated values are duplicated) and merge keys are flattened — the output is self-contained rather than a faithful re-serialisation of the YAML graph.",
      "Custom/non-standard YAML tags cannot be represented in JSON; the resolved value is kept and the tag is dropped (reported as a warning).",
      "The interactive tree view is limited for very large documents (tens of thousands of values); conversion and validation are not.",
    ],
    references: [
      { label: "RFC 8259 — JSON", url: "https://www.rfc-editor.org/rfc/rfc8259" },
      { label: "YAML 1.2 Specification", url: "https://yaml.org/spec/1.2.2/" },
      { label: "js-yaml", url: "https://github.com/nodeca/js-yaml" },
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

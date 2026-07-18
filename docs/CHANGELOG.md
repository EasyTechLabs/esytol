# Esytol — Tool Changelog

> A running log of tools shipped to Esytol, newest first. One entry per tool.
> For sprint-level history see the ProductFactory registry; for finance-engine rule
> changes see `docs/IncomeTaxChangelog.md`.

---

## 2026-07-18 — 🧮 CSV ↔ JSON Converter (new tool · Developer category)

Convert between CSV and JSON in your browser, both directions — 100% client-side, nothing uploaded, and
**CSV-injection safe**. Route: `/tools/csv-json-converter`.

- **CSV → JSON** — header detection (duplicates made unique), **auto** or custom delimiter (comma /
  semicolon / tab / pipe), quote + escaped-quote + multiline + Unicode handling, empty values, blank-line
  skipping, and optional **type inference** (numbers / booleans / null; leading-zero and big-int values
  stay strings — lossless).
- **JSON → CSV** — array of objects (or a single object), **nested-object flattening** with dot notation,
  arrays serialised as JSON in a cell, **stable first-seen column order**, missing fields → empty cells,
  minimal RFC 4180 quoting.
- **Validation** — friendly errors with **row & column** (unterminated quote, invalid quoting; JSON errors
  explained), plus notes for inconsistent columns and renamed headers.
- **Explorer** — a lazy, searchable **table preview**, a reused **JSON tree**, and the raw output; statistics
  (rows, columns, empty cells, max width, characters, file size).
- **Security** — formulas are never executed; on JSON → CSV, cells starting with `= + - @` (tab, CR) are
  neutralised so a spreadsheet can't run them (OWASP CSV-injection guidance; toggleable). `__proto__`
  column names are guarded against prototype pollution.
- **New reusable engine** — `lib/dev/csv.ts` (`parseCsvRows` with row/column errors, `detectDelimiter`,
  `inferCellValue`, `csvToJson`/`jsonToCsv`) is the platform's tabular-data primitive; a future TSV
  converter or table viewer reuses it. Editor/result/validation/layout + JSON validation + `JsonTree`
  reused unchanged.

**+42 tests** (35 engine — incl. injection safety, round-trip, and a 5,000-row document — + 7 UI) →
1,766 total. Docs: `docs/CsvJsonConverter.md`.

## 2026-07-18 — 📐 XML Formatter & Validator (new tool · Developer category)

Format, minify, validate, and explore XML — 100% client-side, nothing uploaded, and **XXE-safe by
construction**. Route: `/tools/xml-formatter`.

- **Formatting** — pretty-print (2-space / 4-space / tab) or **minify**; all content preserved exactly.
- **Validation** — real-time well-formedness with **line & column** and a friendly reason (mismatched/
  unclosed tag, unquoted or duplicate attribute, multiple roots, unterminated comment/CDATA/PI/DOCTYPE).
- **Explorer** — a lazy, searchable **tree view** of the element hierarchy (attributes, text, comments,
  CDATA, PIs) with expand/collapse all and match highlighting.
- **Statistics** — elements, attributes, text nodes, max depth, characters, lines.
- **Summary / warnings** — XML declaration, DOCTYPE (with the XXE-safe note), namespace list, entity
  references (kept literal), processing instructions, and duplicate attributes.
- **Security** — a new controlled tokenizer, **not DOMParser**: never resolves external entities (XXE),
  never evaluates a DTD, never expands entities (billion-laughs stays literal), never touches the
  network. Proven by tests, not just claimed.
- **New reusable engine** — `lib/dev/xml.ts` (`parseXmlDocument` → node tree + metadata, `formatXml`,
  `analyzeXml`) is the platform's XML primitive; a future **XML Diff** / **XPath tester** reuses it.
  Editor/result/validation/layout + the lazy-tree-with-search pattern reused unchanged.

**+26 tests** (20 engine — incl. XXE & billion-laughs safety and a 5,000-element document — + 6 UI) →
1,723 total. Docs: `docs/XmlFormatter.md`.

## 2026-07-18 — 🔀 JSON Diff Viewer (new tool · Developer category)

Compare two JSON documents and see exactly what changed — a structural diff, 100% client-side,
nothing uploaded. Route: `/tools/json-diff-viewer`.

- **Structural diff** — added / removed / changed / type-changed nodes, recursing objects and arrays
  and collapsing identical branches (ignores formatting, unlike a line diff).
- **Two views** — a colour-coded **unified** diff tree (changed shown as left → right) and a
  **side-by-side** view of both documents; both with a text badge per change (colour-independent).
- **Navigate** — expand/collapse all, **changed-only** filter, **search + highlight**, and
  **jump to next/previous difference**.
- **Statistics** — added, removed, modified, unchanged, total nodes, max depth.
- **RFC 6902 JSON Patch** — copy or download a standard add/remove/replace patch that transforms the
  left document into the right one.
- **Independent validation** of both inputs with line/column + friendly errors.
- **Safe** — no eval, prototype-pollution-guarded, depth-guarded for deeply nested input.
- **New reusable engine** — `lib/dev/jsonDiff.ts` works on parsed JS values, so a future **YAML Diff**
  / XML Diff / config diff reuses it (`parseYaml` → `diffValues`). Statistics + side-by-side reuse
  `jsonInsights` + `JsonTree` (TOOL-005) unchanged.

**+22 tests** (15 engine — incl. a patch applier proving left → right, array-tail removals, depth &
prototype-pollution guards — + 7 UI) → 1,697 total. Docs: `docs/JsonDiffViewer.md`.

## 2026-07-18 — 🔄 JSON ↔ YAML Converter (new tool · Developer category)

A bidirectional, lossless JSON ↔ YAML converter — 100% client-side, nothing uploaded. Route:
`/tools/json-yaml-converter`.

- **Both directions** — JSON → YAML and YAML → JSON, with a one-click **Swap** that round-trips.
- **Formatting** — JSON output as 2/4-space or minified; clean 2-space YAML; optional sort-keys.
- **Real-time validation** — line/column + friendly explanations (JSON: trailing comma, comment,
  single quotes…; YAML: the parser's reason at the exact mark).
- **Honest about YAML** — detects and _reports_ multi-document streams (→ JSON array), anchors &
  aliases (expanded), **merge keys `<<:` (resolved — js-yaml 4 leaves them literal, so the engine
  flattens them, own keys winning)**, and custom tags — nothing is silently changed.
- **Warnings** — duplicate keys and unsafe integers on the JSON side (reused `scanJson`).
- **Explorer + stats** — the reused searchable **tree view** and JSON statistics (objects, arrays,
  scalars, properties, depth, output size).
- **Reuse** — statistics + tree come from `lib/dev/jsonInsights` + `JsonTree` (TOOL-005) unchanged.
  New shared libs: `lib/dev/jsonYaml.ts` (converter), `lib/dev/yamlInsights.ts` (feature scan), and
  `lib/dev/yaml.ts` extended (line/column, multi-document).

**+26 tests** (18 engine incl. round-trips/anchors/merge/multi-doc + circular-ref & prototype-
pollution guards + 8 UI) → 1,675 total. Docs: `docs/JsonYamlConverter.md`.

## 2026-07-18 — 📋 JSON Formatter & Validator v2.0.0 (major upgrade · Developer category)

Upgraded the Developer category's flagship formatter from a solid pretty-printer into a
best-in-class validator + inspector. Still 100% client-side — no JSON is ever uploaded.

- **Human-friendly errors** — real-time validation now shows the line/column **and a plain-English
  reason**: trailing comma, comment, single quotes, unquoted key, NaN/Infinity, Python `True/False`.
- **JSON statistics** — characters, lines, objects, arrays, properties, max nesting depth, and value
  types (strings/numbers/booleans/nulls).
- **Duplicate-key detection** — finds keys that `JSON.parse` silently drops, with line numbers
  (compares decoded keys, so unicode-escaped duplicates are caught).
- **Unsafe-integer warnings** — flags integers beyond `Number.MAX_SAFE_INTEGER` that lose precision.
- **Interactive tree view** — lazy, collapsible, with Expand all / Collapse all and **search across
  keys and values** (match count + highlight, auto-expands matches). Capped for very large documents.
- Retains pretty-print (2/4/tab), minify, sort-keys, syntax-highlighted editor, copy, download,
  upload, sample — all reused from the shared Developer Experience layer.
- **Reuse** — the format engine (`lib/dev/jsonFormat`), editor, result viewer, and validation UI are
  unchanged; the new logic is `lib/dev/jsonInsights.ts` + `JsonTree.tsx`.

Registry bumped to v2.0.0 (name → "JSON Formatter & Validator", 12 keywords, 6 FAQs, related Security
tools). **+25 tests** (18 engine incl. the duplicate-key/big-int/error-explanation suites + 7 tree UI)
→ 1,649 total. Docs: `docs/JsonFormatter.md`.

## 2026-07-18 — 🎫 JWT Decoder & Verifier (new tool · Security category)

The Security category's fourth tool — a **teaching** decoder, not just a decoder. Route:
`/tools/jwt-decoder`.

- **Decodes** the header and payload and **explains every field** (RFC 7515/7519 claims labelled;
  custom claims marked as such).
- **Human-readable timestamps** for `iat`/`nbf`/`exp` and a **live expiry countdown**.
- **HS256 signature verification** — paste the shared secret to verify locally via Web Crypto.
- **Technically-correct security analysis** — flags `alg:"none"` as unsigned (critical), explains why
  RS256/ES256/EdDSA can't be verified without the issuer's public key, warns on expiry, and always
  notes that a JWT is encoded, **not encrypted**. **Never implies verification that did not happen.**
- **Playground** sample, copy/download decoded JSON, malformed-token detection.
- **Private** — the token and any secret never leave the browser.
- **Reuse** — decode reuses `parseJwt` (`lib/dev/parse`) and verification reuses `verifyJwtHs256`
  (`lib/dev/crypto`); no decode/verify logic was re-implemented. The new teaching layer is
  `lib/security/jwtInsights.ts`.

**+21 tests** (15 engine — including the security-note correctness suite — + 6 UI) → 1,624 total.
Docs: `docs/JwtDecoder.md`.

## 2026-07-18 — 🆔 UUID Generator (new tool · Security category)

The Security category's third tool, completing the password/hash/UUID cluster. Route:
`/tools/uuid-generator`.

- **Every practical version** — v1 (time-based, **privacy-safe random node** — never a MAC),
  v3 (MD5 name-based), v4 (random), v5 (SHA-1 name-based), v7 (time-ordered, RFC 9562).
- **Bulk** generation (1 / 10 / 50 / 100 / 1000), per-UUID copy, **Copy all**, **Download .txt**,
  **Download .csv**, uppercase and hyphen toggles, Regenerate, Clear.
- **Namespaces** for v3/v5 — DNS, URL, OID, X500, or a custom namespace UUID + name input.
- **Validate mode** — paste any UUID to check the format and see its version, variant, and (for
  v1/v7) the embedded timestamp; recognises the Nil and Max UUIDs.
- **Secure & private** — random parts use the Web Crypto API (never Math.random); everything runs
  in the browser, nothing uploaded. Honest caveats (v1 node, MD5/SHA-1, "not a secret").
- **Reuse** — the v3/v5 hashing reuses `hashBytes` from `lib/dev/crypto.ts` (added in TOOL-002);
  no shared lib needed changing. Category moved to **security** to join the cluster.

**+27 tests** (19 engine incl. authoritative Python v3/v5 vectors + timestamp round-trips, 8 UI)
→ 1,603 total. Docs: `docs/UUIDGenerator.md`.

## 2026-07-18 — 🔏 Hash Generator (new tool · Security category)

The Security category's second tool, and a showcase of platform reuse — the hash
algorithms already lived (tested) in `lib/dev/crypto.ts`, so this sprint added only the
new capability and UI. Route: `/tools/hash-generator`.

- **Three modes** — **Text** (live MD5/SHA-1/SHA-256/SHA-512), **File** (checksums of a
  dropped/selected file's raw bytes), and **HMAC** (keyed hash with a secret, SHA-256/1/512).
- **Checksum verification** — paste an expected hash to confirm a download's integrity; the
  matching digest highlights green with an "authentic" status.
- **Uppercase-hex toggle**, one-click copy per digest.
- **Private by design** — 100% client-side (Web Crypto + pure MD5); text, files, and secrets
  never leave the browser. Honest MD5/SHA-1 "broken for security" warnings.
- **Reuse, not duplication** — extended the shared libs: `hashBytes`/`hashAllBytes` added to
  `lib/dev/crypto.ts` (byte/file hashing; the string API now delegates to them), and
  `readBinaryFile` added to `lib/dev/files.ts`. No algorithm was rewritten.
- Accessible (tablist, labelled inputs, keyboard-operable drop zone, status not colour-only),
  responsive, zero-login, fast.

**+13 tests** (7 crypto vectors incl. an HMAC-SHA256 vector + 6 UI) → 1,576 total.
Docs: `docs/HashGenerator.md`.

## 2026-07-18 — 🔑 Password Generator (new tool · Security category)

The platform's first interactive **Security** tool and its first globally-targeted
(non-India-specific) utility. Route: `/tools/password-generator`.

- **Cryptographically secure** — randomness from the Web Crypto API
  (`crypto.getRandomValues`) with rejection sampling for zero modulo bias. Never
  `Math.random`.
- **Two modes** — random-character passwords (length 4–128, character-set toggles,
  exclude look-alikes, require one of each type) and **Diceware-style passphrases**
  (3–12 words from a 256-word list, separator, capitalise, add number).
- **Honest strength** — a live strength meter driven by real **entropy (bits)** plus a
  conservative offline **crack-time** estimate that states its attacker assumption.
- **Bulk generate** (1/5/10/20), one-click copy, instant regenerate.
- **Private by design** — 100% client-side; nothing is uploaded, stored, or logged.
- Accessible (labelled controls, `aria-live` output, `progressbar` strength, keyboard-
  operable, strength not colour-only), mobile-responsive, zero-login, and fast (5 kB page,
  no heavy deps).
- Ships the reusable **Security category surface** (domain routing + DeveloperTrust +
  `secureRandomInt`) that the coming `hash-generator` and `uuid-generator` will reuse.

Engine `lib/security/password.ts` (+ `lib/security/wordlist.ts`); UI
`features/tools/password-generator/`. **+33 tests (27 engine + 6 UI)** → 1,563 total.
Docs: `docs/PasswordGenerator.md`.

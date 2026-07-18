# Hash Generator — Tool Documentation

> **Category:** Security · **Slug:** `hash-generator` · **Route:** `/tools/hash-generator`
> **Status:** ✅ Live · **Last Updated:** 2026-07-18
> **Engine:** `lib/dev/crypto.ts` (extended) + `lib/dev/files.ts` (extended) · **UI:** `features/tools/hash-generator/HashGenerator.tsx`

The build record for the Hash Generator — the Security category's second tool. Notable
for **maximal reuse**: the algorithms already existed and were tested; this sprint added
only the file/checksum capability, HMAC exposure, and the UI.

---

## 1. Problem

Developers and IT users constantly need to hash a string (SHA-256 of a value), verify a
downloaded file's checksum, or compute an HMAC to sign a request. Many online hash tools
**upload** your data to a server — unacceptable for secrets or private files.

## 2. Why users search for it

"sha256 online", "md5 generator", "checksum calculator", "hmac generator" are high-volume,
evergreen, worldwide developer queries — needed whenever verifying a download, debugging an
API signature, or storing a checksum.

## 3. Existing reusable code discovered

- **`lib/dev/crypto.ts`** — already implemented `hash`, `hashAll` (MD5/SHA-1/256/512) and
  `hmac` via SubtleCrypto + a pure MD5. **No algorithm was rewritten.**
- **`lib/dev/files.ts`** — `readTextFile`, `downloadText`, clipboard helpers.
- **`features/everyday/EverydayInput`** — the lightweight labelled textarea with sample/paste/
  upload/copy/clear (no heavy editor).
- **`features/dev/DevToolLayout`**, **`features/tool/CopyButton`**, **DeveloperTrust**, the
  `security` domain routing, and the SEO/metadata framework — all reused unchanged.

## 4. Architecture reuse plan

Reuse everything above; **extend** two shared libs rather than duplicate:

- `lib/dev/crypto.ts`: add `hashBytes` / `hashAllBytes` (byte-oriented) and route the existing
  string `hash`/`hashAll` through them — one implementation per algorithm, no duplication.
- `lib/dev/files.ts`: add `readBinaryFile` (raw bytes, size-capped) for checksums.
  These additions are generic and reusable by any future tool (e.g. a file-integrity tool).

## 5. New reusable components

None new at the component layer — the tool is composed entirely from shared platform pieces.
The reusable **logic** additions live in the shared libs (`hashBytes`, `hashAllBytes`,
`readBinaryFile`), exactly where the coding standards require.

## 6. Implementation

Three modes in one client component:

- **Text** — live MD5/SHA-1/SHA-256/SHA-512 of typed/pasted text (async, updates on change).
- **File** — drag-drop or pick a file → checksums of its **raw bytes** (never decoded), with a
  size cap and a friendly drop zone.
- **HMAC** — message + secret key + algorithm (SHA-256/1/512) → keyed hash.
  Plus an **uppercase-hex** toggle and a **"Verify a checksum"** box that highlights which digest
  a pasted expected-hash matches (green row + "✓ authentic" / "✗ no match").

## 7. Tests

- **Engine (`tests/lib/dev/cryptoHash.test.ts`, 7):** published vectors for empty + "abc"
  (MD5/SHA-1/SHA-256/SHA-512), byte↔string agreement, `hashAllBytes` all-lowercase-hex,
  avalanche, and an HMAC-SHA256 RFC-style vector (`key`/"The quick brown fox…"), determinism +
  secret sensitivity. (The string API stays covered by `devShared.test.ts`.)
- **UI (`tests/features/hash-generator/HashGenerator.test.tsx`, 6):** correct text digests;
  verify-match highlight; mismatch; uppercase toggle; HMAC computation; File-mode drop zone.

## 8. Documentation

This file + the in-app DeveloperTrust surface (how it works, MD5/SHA-1 broken-for-security
warning, references: FIPS 180-4, RFC 1321, RFC 2104, MDN SubtleCrypto) + a 6-item registry FAQ.

## 9. Registry updates

`hash-generator` flipped live (status removed), best-in-class description + 12 keywords + 6 FAQs,
`checksum`/`hmac` tags added. Routes to the Developer trust surface via the existing `security`
domain tag. `toolStatus` guardrail test updated (moved to live).

## 10. ProductFactory updates

Sprint record `Sprints/TOOL-002-HashGenerator/README.md`; registry row 45; CurrentState (25 live
tools, Security 2); Metrics (tests, catalogue).

## 11. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — Hash Generator).

## 12. Quality checklist

- [x] Production UI, responsive (single-column stack), dark-mode follows platform theme.
- [x] Accessibility: `role="tablist"`/`tab`, labelled inputs, `aria-live` outputs, keyboard-operable
      drop zone (`role="button"`, Enter/Space), status via `role="status"`/`alert`, not colour-only
      (text "match"/"no match" labels).
- [x] SEO: metadata, canonical, OpenGraph/Twitter, Schema.org (SoftwareApplication + FAQ +
      Breadcrumb via ToolMetadata), 6-item FAQ.
- [x] Security: **Web Crypto** for SHA family; **no insecure randomness**; all input validated
      (size cap, safe empty states); output escaped by React; **nothing uploaded**; honest
      MD5/SHA-1 warnings (OWASP-aligned).
- [x] Reuse: zero duplicated logic; shared libs extended, not forked. No TODOs/placeholders/dead code.
- [x] Performance: async hashing, no heavy deps, ~small page; File capped at 5 MB.
- [x] i18n-ready (no hard-coded locale logic); zero-login.
- [x] Error handling: unreadable/oversized files → clear message; empty states show placeholders.

## 13. Final verification

`format:check` · `lint` · `type-check` · full test suite · `next build` — all green.
`/tools/hash-generator` prerendered static; sitemap includes it.

## Honest limitations

- MD5 and SHA-1 are shown for legacy checksums only; the UI and trust surface state they are
  broken for security. Use SHA-256/512 for integrity.
- In-browser file hashing is capped at 5 MB (shared `DEFAULT_MAX_FILE_BYTES`) so a huge file
  cannot hang the tab.
- Dark mode follows the platform theme (the site is light-only platform-wide today).

# Developer Experience Layer — DEVELOPER-001

> **Purpose:** The shared infrastructure every Developer-category tool reuses, so a new tool is only its transformation logic — the editor, validation, output, parsing, encoding, crypto, files, and layout already exist.
> **Status:** Shipped (JSON Formatter, Base64, URL migrated onto it)
> **Owner:** Principal Platform Architect (EasyTechLabs)
> **Last Updated:** 2026-07-18
> **Related:** [Platform003DeveloperCategory](Platform003DeveloperCategory.md) · [DeveloperExperience standards](#developer-standards)

## What a new tool needs after this

```tsx
export function MyTool() {
  const [input, setInput] = useState("");
  const { result, ms } = useMemo(() => timed(() => myEngine(input)), [input]);
  return (
    <DevToolLayout
      controls={/* options */}
      input={<EditorPanel value={input} onChange={setInput} language="json" />}
      validation={<ValidationStatus validation={result.validation} />}
      output={<ResultViewer value={result.output} processingMs={ms} />}
      examples={[/* ... */]}
      onExample={setInput}
    />
  );
}
```

Everything else — the editor, toolbar, file handling, metrics, copy/download,
validation rendering, layout, and the trust surface — is shared platform code.

## The layer

### Part 1 — CodeEditor (`features/dev/CodeEditor.tsx`)

CodeMirror 6 behind a stable interface (`value / onChange / language / readOnly /
dark / placeholder / minHeight / ariaLabel`). Languages: JSON, JWT (JSON
highlight), XML, YAML, SQL, JavaScript, HTML, CSS, plain text. Line numbers,
fold gutter, bracket matching, undo history, line wrapping, `Tab` indent.

**Why CodeMirror, not Monaco.** The platform ships a strict CSP (`default-src
'self'`, no external scripts, no `blob:` workers) and a lightweight ethos.
Monaco needs a CDN loader (or self-hosted `vs/` assets) and web-workers, which
would force CSP relaxations and add several MB. CodeMirror stays fully inside
the existing CSP — no CDN, no workers, all same-origin — at ~10% of the weight,
and it is hidden behind our own `CodeEditor` interface, so a future swap to
Monaco would touch one file, not any tool.

### Part 2 — ResultViewer (`features/dev/ResultViewer.tsx`)

Read-only output with copy, download, and live **character / line / byte** counts
plus **processing time**. Pretty/minify is the tool's concern (it owns the
transform); the viewer renders whatever string it is given.

### Part 3 — ValidationStatus (`features/dev/ValidationStatus.tsx`)

One rendering of the shared `Validation` model (`lib/dev/validation`): **valid /
warning / error / info**, with `role="alert"` on errors and optional
line/column. Every tool's validation looks identical.

### Part 4 — Parsing (`lib/dev/parse.ts`, `lib/dev/yaml.ts`)

`parseJson`, `parseJwt`, `parseUrl`, `parseCsv` (RFC 4180-ish), `parseXml`
(DOMParser well-formedness), `parseBase64`, and `parseYaml`/`toYaml`. Each
returns `{ ok, value, validation }`. YAML lives in its own module so `js-yaml`
is only bundled by tools that use it.

### Part 5 — Encoding (`lib/dev/encode.ts`)

`encodeBase64`/`decodeBase64`, `encodeUrl`/`decodeUrl` (re-exported — one
implementation each), plus `encodeHex`/`decodeHex`, `encodeUnicode`/
`decodeUnicode`, `encodeHtml`/`decodeHtml`. All UTF-8 safe and reversible.

### Part 6 — Cryptography (`lib/dev/crypto.ts`)

`hash` (SHA-1/256/512 via Web Crypto; MD5 via a pure impl), `hashAll`, `hmac`,
and `verifyJwtHs256`. All client-side. MD5 is offered for checksums/legacy only
and labelled as never-for-security. JWT verification supports HS256 and declines
RS/ES **honestly** rather than faking a verdict.

### Part 7 — File support (`lib/dev/files.ts`, `EditorPanel`)

`readTextFile` (UTF-8, size-capped at 5 MB by default), `downloadText`,
`copyText`, `pasteText`. Drag-and-drop and the hidden file input live in
`EditorPanel`; clipboard helpers fail soft when the browser blocks access.

### Part 8 — DevToolLayout (`features/dev/DevToolLayout.tsx`)

The canonical arrangement: **controls → (input + validation | output) →
examples → privacy**. The spec's "standards" step is the `DeveloperTrust`
surface rendered once by `ToolLayout` beneath the content, so it is never
duplicated. Slots keep it reusable across one-input, mode-toggle, and
multi-output tools.

### EditorPanel (`features/dev/EditorPanel.tsx`)

The input editor with the category-wide toolbar — **Sample, Paste, Upload,
Format, Copy, Download, Clear, Dark, Full screen** — and drag-and-drop.

## Developer Standards

Every developer tool, current and future, must hold to these:

1. **Client-side always.** Pure browser transforms; nothing is uploaded. Server
   processing is allowed only when impossible client-side, and must be declared
   in the tool's `DeveloperTrust` surface.
2. **Reuse the layer.** No tool re-implements an editor, output panel,
   validation UI, parser, encoder, hash, or file handler. If something is
   missing, add it to the shared layer, not to the tool.
3. **Errors are data.** Engines return `{ ok, error }` / `{ ok, validation }`;
   the UI shows a clean message, never a thrown exception.
4. **Determinism.** Same input + options → same output. Generators (UUID) that
   produce fresh values by design say so.
5. **Honesty.** No faked results (e.g. non-HS256 JWT verification is declined,
   not guessed); limitations are stated, not hidden.

## RFC / standards references

Per-tool references live in `content/devStandards.ts` and render in each tool's
trust surface. Core references: **RFC 8259**/ECMA-404 (JSON), **RFC 4648**
(Base64/Hex), **RFC 3986** + WHATWG URL (URL), **RFC 4180** (CSV), **RFC 7519**
(JWT), **RFC 2104** (HMAC), **RFC 1321** (MD5), **RFC 3174**/FIPS 180-4 (SHA).

## Privacy

Every tool runs entirely in the browser. Input never leaves the device — no
upload, no server round-trip, no logging, no analytics of content. `readTextFile`
reads dropped/uploaded files locally; `downloadText` writes locally via a Blob.
The privacy line is shown on every tool and in the trust surface.

## Performance

- Transforms are pure functions timed with `timed()`; processing time is shown.
- Base64 encoding is chunked (32 KB) to avoid call-stack overflow on large input.
- A 1M-character Base64 round-trip and a 20k-element JSON format each complete
  well under budget (pinned by tests).
- The CodeMirror chunk (~210 KB gzipped-ish) is route-split: only Developer tool
  pages load it; Finance pages are unaffected.
- File reads are size-capped (5 MB default) with an honest over-limit message.

## Browser support

Modern evergreen browsers (Chromium, Firefox, Safari). Requirements: `TextEncoder`/
`TextDecoder`, `crypto.subtle` (Web Crypto — secure context / HTTPS), `URL`,
`DOMParser`, Clipboard API (copy/paste fail soft when unavailable or blocked).
No IE support.

## Limitations

- **JWT verification:** HS256 only in V1 (symmetric). RS/ES256 (asymmetric)
  needs key handling and is declined honestly, not faked.
- **MD5:** checksums/legacy interop only — never for security.
- **XML:** well-formedness validation (DOMParser), not schema/DTD validation.
- **YAML:** parsing via js-yaml's safe loader; custom tags are not evaluated.
- **Web Crypto** requires a secure context; on `http://` (non-localhost) hashing
  is unavailable and reported rather than silently wrong.
- **File size:** 5 MB default cap for in-browser processing; larger files are
  refused with a clear message rather than freezing the tab.

## Tests

`tests/lib/dev/devShared.test.ts` (encoders round-trip, parsers, crypto against
published vectors — MD5/SHA/HMAC/JWT), `devEngines.test.ts` (JSON/Base64/URL
engines), `devLargeClipboard.test.ts` (1M-char input, performance budgets, file
cap, clipboard fail-soft), `tests/features/dev/devComponents.test.tsx`
(validation, result metrics, editor toolbar + upload, layout examples, and an
axe accessibility pass). CodeEditor is mocked in component tests for
determinism; the real CodeMirror engine is exercised by the production build.

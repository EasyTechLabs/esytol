# Encoding & Escape Family — Platform Documentation

> **Category:** Developer · **Sprint:** PLATFORM-005 (a _platform_ sprint — the shared engine matters
> more than any one tool) · **Status:** ✅ Live · **Last Updated:** 2026-07-19
> **Engine:** `lib/dev/codec.ts` (+ primitives in `lib/dev/encode.ts`) · **UI:** `features/dev/EncoderDecoderTool.tsx`

A cohesive family of five reversible encoder/decoder tools built on **one** engine, **one** UI
component, and **one** test harness. The goal was not five tools — it was the reusable platform that
makes the sixth, seventh, and eighth encoder nearly free.

---

## 1. What was built

| Tool                          | Route                             | Codec id    |
| ----------------------------- | --------------------------------- | ----------- |
| HTML Entity Encoder / Decoder | `/tools/html-entity-encoder`      | `html`      |
| Hex Converter                 | `/tools/hex-converter`            | `hex`       |
| Binary Converter              | `/tools/binary-converter`         | `binary`    |
| Unicode Escape Converter      | `/tools/unicode-escape-converter` | `unicode`   |
| Backslash String Escaper      | `/tools/string-escaper`           | `backslash` |

All five are the **same** `EncoderDecoderTool` component with a different codec id.

## 2. The platform (three layers, all under `lib/dev` / `features/dev`)

1. **Primitives — `lib/dev/encode.ts`** (extended, not duplicated). Already held Base64/URL/Hex/Unicode/
   HTML codecs; this sprint added `encodeBinary`/`decodeBinary` and `encodeBackslash`/`decodeBackslash`.
   Every transform is pure, deterministic, UTF-8/byte-accurate, and returns the shared `CodecResult`.
2. **Engine — `lib/dev/codec.ts`** (new). A `Codec` descriptor (labels, verbs, encode/decode, samples,
   note) and a `CODECS` registry that composes the primitives — no transform is reimplemented. A tool is
   a registry id.
3. **UI — `features/dev/EncoderDecoderTool.tsx`** (new). Given a codec id it renders the entire tool:
   encode/decode tablist, the shared `EditorPanel` + `ResultViewer` + `ValidationStatus`, live
   processing via `metrics.timed`, examples, and the privacy note. ~120 lines, shared by all five tools.

Each tool page is **three lines of body**: `<EncoderDecoderTool codecId="…" />`.

## 3. Reuse

| Layer                                 | Source                                       | Shared?                       |
| ------------------------------------- | -------------------------------------------- | ----------------------------- |
| Editor / result / validation / layout | DEVELOPER-001                                | reused unchanged              |
| Encoding primitives                   | `lib/dev/encode.ts`                          | extended (2 new), rest reused |
| Codec engine                          | `lib/dev/codec.ts`                           | shared by all 5               |
| Tool UI                               | `EncoderDecoderTool.tsx`                     | shared by all 5               |
| Tests                                 | one engine suite + one parametrised UI suite | shared by all 5               |
| Trust surface / SEO / metadata        | DeveloperTrust + registry                    | shared framework              |

**Per-tool unique code:** one registry entry (data) + one 3-line page + one codec descriptor. Every tool
reuses **~95%** of the infrastructure — well above the 80% bar.

## 4. Security (Security Engineer lens)

- **No network, no eval, no DOM injection** — pure string transforms; output is rendered as text.
- **HTML codec is an XSS-relevant control** — encoding escapes the significant characters; the trust
  surface documents that encoding is context-sensitive (use with framework auto-escaping + CSP).
- **Decoders never produce garbage** — hex/binary validate their alphabet and length and return a clear
  error; an unknown backslash escape is kept literal rather than dropped.

## 5. Accessibility (Accessibility Engineer lens)

Direction is a real `role="tablist"` with `role="tab"` + `aria-selected`; the input is labelled;
validation errors use `role="alert"` (via `ValidationStatus`); colour is never the only signal.

## 6. Performance (Performance Engineer lens)

Every transform is a single O(n) pass; results are memoised on input/mode; pages are 3 lines so bundles
stay tiny (~2–3 kB of tool code over the shared chunk). No new dependencies.

## 7. Tests

- **Engine (`tests/lib/dev/codec.test.ts`):** a round-trip loop over **every** codec (ASCII, Unicode,
  punctuation, whitespace), a check that each declared sample encodes/decodes correctly, and per-codec
  exact-output + error-handling tests.
- **UI (`tests/features/encoder-decoder/EncoderDecoderTool.test.tsx`):** a `describe.each` over every
  codec proving encode, decode, and accessibility through the one shared component, plus validation-error
  cases. **Adding a codec adds a loop row — no new test file.**

## 8. SEO

Every tool has its own metadata, canonical, OpenGraph, Twitter cards, Schema.org (SoftwareApplication +
FAQ + Breadcrumb), and a 4-item FAQ — all generated from its registry entry, so SEO scales with the
registry.

## 9. Platform ROI

- **This sprint:** 5 production tools for the cost of ~1 engine + 1 UI + 1 test harness.
- **Every future encoder** (ROT13, Base32, Morse, HTML-numeric, URL-component, quoted-printable, punycode,
  a TSV/`\t` variant…) is **one registry entry + one 3-line page + one test row** — hours, not a sprint.
- Base64 and URL (DEVELOPER-001) could migrate onto this same shell to delete their bespoke UIs (left
  untouched this sprint to avoid churn on shipped tools).

## 10. Honest limitations

- HTML encoding covers the significant characters (not every character → named entity, by design).
- Unicode escapes use UTF-16 code units, so astral characters (emoji) become a surrogate pair.
- These tools escape/encode a value; whole-document JSON/XML live in their own formatters.

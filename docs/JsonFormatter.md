# JSON Formatter & Validator — Tool Documentation

> **Category:** Developer · **Slug:** `json-formatter` · **Route:** `/tools/json-formatter`
> **Status:** ✅ Live (v2.0.0 — TOOL-005 upgrade) · **Last Updated:** 2026-07-18
> **Engine:** `lib/dev/jsonFormat.ts` (format) + `lib/dev/jsonInsights.ts` (analysis, new) · **UI:** `features/tools/json-formatter/{JsonFormatter,JsonTree}.tsx`

The build record for the JSON Formatter & Validator upgrade — from a solid formatter into a
best-in-class validator + inspector, strengthening the Developer category.

---

## 1. Problem

Developers, QA, DevOps, students, and API engineers format and validate JSON constantly — but most
online tools upload the data, give cryptic parser errors, and stop at pretty-printing. Esytol needs
a formatter that stays 100% local, explains _why_ JSON is invalid, surfaces the things a plain parse
hides (duplicate keys, precision-losing integers), shows statistics, and lets you explore large
documents in a searchable tree.

## 2. Repository reuse discovered

- **`lib/dev/jsonFormat.ts`** — the format/validate engine (pretty/minify/indent/sortKeys, error
  location). Reused **unchanged**.
- **`features/dev/EditorPanel`** (CodeMirror editor — syntax highlighting, sample/paste/upload/
  format/copy/download, dark toggle, auto-resize), **`ResultViewer`**, **`ValidationStatus`** (color-
  independent valid/error with line/column), **`DevToolLayout`**, **`lib/dev/metrics.timed`**,
  **`lib/dev/validation`** — all reused unchanged.
- **DeveloperTrust**, the developer domain routing, and the SEO/metadata framework — reused.

## 3. Architecture reuse

No shared engine changed. The upgrade adds **one new analysis module** (`lib/dev/jsonInsights.ts`)
and **one new component** (`JsonTree.tsx`), and composes them into the existing formatter alongside
the reused editor/result/validation. The editor, format engine, and validation UI are untouched.

## 4. Implementation

`lib/dev/jsonInsights.ts` (pure):

- `analyzeJson(value)` → statistics: objects, arrays, properties, strings, numbers, booleans, nulls,
  **max nesting depth**, total values.
- `scanJson(input)` → a single-pass tokenizer that finds **duplicate keys** (which `JSON.parse`
  silently drops — reported with line/column, comparing _decoded_ keys so `a` == `a`) and
  **integers beyond `Number.MAX_SAFE_INTEGER`** (which lose precision). Correctly ignores braces/
  commas/`//` inside string values.
- `explainJsonError(input, rawMessage)` → human, actionable reasons: trailing comma, comment, single
  quotes, unquoted key, NaN/Infinity/undefined, Python `True/False/None` — else a cleaned generic
  hint. Strips string contents first so it never false-positives on `//` inside a string.
- `countJsonMatches(value, query)` → key/value search-match count for the tree.

UI:

- **`JsonFormatter.tsx`** — reused editor (input) + reused result viewer (formatted, side-by-side),
  real-time validation with the **human error** + line/column, a **statistics** panel (10 metrics), a
  **warnings** panel (duplicate keys, unsafe integers), and a Formatted/Tree explorer. Indent
  (2/4/tab/minify) + sort-keys reused from before.
- **`JsonTree.tsx`** — lazy, collapsible tree (collapsed branches render nothing → responsive),
  **Expand all / Collapse all**, **search** across keys and values with match count and `<mark>`
  highlighting (auto-expands matching branches), typed/colored scalars, accessible `tree`/`treeitem`/
  `group` roles, keyboard-operable toggles.

## 5. Shared improvements

`lib/dev/jsonInsights.ts` is a reusable dev-lib addition — a future YAML/JSON-diff/XML tool can reuse
`analyzeJson`, `scanJson`, and `explainJsonError`. No existing shared code needed changing (a sign the
DEVELOPER-001 layer was well-factored).

## 6. Tests

- **Engine (`tests/lib/dev/jsonInsights.test.ts`, 18):** statistics + depth; duplicate-key scanner
  (locations, cross-object non-dupes, array/value strings ignored, **unicode-escaped duplicates**,
  strings-with-braces not fooled); **unsafe-integer** detection (ignores safe ints, floats, numbers in
  strings); every **error explanation** (trailing comma/comment/single-quote/unquoted/NaN/Python) +
  **no false positive on `//` in a string** + generic fallback; `countJsonMatches`.
- **UI (`tests/features/json-formatter/JsonTree.test.tsx`, 7):** accessible tree semantics; lazy
  hiding of deep values; Expand all / Collapse all; search match-count + highlight; deep-match
  auto-expand; array indices + typed scalars.
- The format engine stays covered by `tests/lib/dev/devEngines.test.ts`; the CodeMirror editor is not
  unit-tested (jsdom limitation) — consistent with the other developer tools.

## 7. Documentation

This file + the enhanced DeveloperTrust surface (how it works incl. duplicate/big-int scan; RFC 8259

- ECMA-404 references) + a 6-item registry FAQ (errors, tree, duplicate keys, big numbers, large files).

## 8. Registry updates

`json-formatter` upgraded to **v2.0.0**: name → "JSON Formatter & Validator", richer description, 12
keywords (json validator/lint/checker/parser/tree viewer/minify…), 6 FAQs, related tools now include
the Security cluster (JWT, Hash, UUID). `index.test.ts` name assertion updated.

## 9. ProductFactory updates

Sprint record `Sprints/TOOL-005-JsonFormatter/README.md`; registry row 48; CurrentState + Metrics
(test counts; live-tool count unchanged — this is an upgrade of an existing tool).

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — JSON Formatter & Validator v2.0.0).

## 11. Verification / quality checklist

- [x] Everything client-side — **no JSON is ever uploaded**; safe native `JSON.parse` (**no eval**).
- [x] Human-friendly errors with line/column; duplicate-key + big-int detection; statistics; tree +
      search; downloadable/copyable output; upload/paste/sample/clear (via the reused editor).
- [x] Huge-input safety: the interactive tree is capped (>15,000 values → a clear notice); formatting
      and stats still work at any size; collapsed tree branches render nothing.
- [x] Accessibility: color-independent validation (icon + label), `tree`/`treeitem`/`group` roles,
      keyboard-operable toggles, labelled search, `tabular-nums` stats.
- [x] SEO: metadata, canonical, OG/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb),
      6-item FAQ, related tools.
- [x] Reuse: editor/result/validation/layout/format-engine reused; no duplicated logic; no
      TODOs/placeholders/dead code.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## Honest limitations

- The interactive tree is limited for very large documents (>15,000 values) to keep the tab
  responsive; formatting and validation are not limited.
- Duplicate keys and big integers are **valid** JSON — reported as warnings, not errors.
- Dark mode: the editor/result have their own dark toggle (reused); the rest follows the platform
  theme (light-only platform-wide today).

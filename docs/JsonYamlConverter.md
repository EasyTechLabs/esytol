# JSON ↔ YAML Converter — Tool Documentation

> **Category:** Developer · **Slug:** `json-yaml-converter` · **Route:** `/tools/json-yaml-converter`
> **Status:** ✅ Live (DEVELOPER-002) · **Last Updated:** 2026-07-18
> **Engines:** `lib/dev/jsonYaml.ts` (convert) + `lib/dev/yaml.ts` (extended) + `lib/dev/yamlInsights.ts` (new) · reuses `lib/dev/jsonInsights.ts` · **UI:** `features/tools/json-yaml-converter/JsonYamlConverter.tsx`

The build record for the JSON ↔ YAML Converter — the Developer category's fifth tool, and a
showcase of reusing the TOOL-005 JSON insight/tree work for a second format.

---

## 1. Problem

Developers, DevOps, and API/config engineers move constantly between JSON (APIs) and YAML (configs,
CI, Kubernetes) — but online converters upload your data, only go one way, or silently mangle YAML
features (anchors, merge keys, multi-document streams). Esytol needs a converter that is 100% local,
lossless, bidirectional, and **honest about every transformation it performs**.

## 2. Existing reusable assets discovered

- **`lib/dev/yaml.ts`** — `parseYaml`/`toYaml` (js-yaml). Reused and extended.
- **`lib/dev/jsonFormat.ts`** — `formatJson` (validate + line/column). Reused for JSON validation.
- **`lib/dev/jsonInsights.ts`** (TOOL-005) — `analyzeJson` (statistics), `scanJson` (duplicate keys +
  unsafe integers), `explainJsonError` (friendly reasons). **All reused unchanged.**
- **`features/tools/json-formatter/JsonTree.tsx`** (TOOL-005) — the searchable tree. **Reused as-is**
  (it takes a parsed value — JSON and YAML parse to the same JS shape).
- **`EditorPanel`, `ResultViewer`, `ValidationStatus`, `DevToolLayout`, `CopyButton`,
  `metrics.timed`, `validation`, DeveloperTrust, SEO framework** — all reused unchanged.

## 3. Architecture reuse

The tool is composed from the above. JSON↔YAML both parse to plain JS, so `analyzeJson` and
`JsonTree` work on either side with zero changes — the single biggest reuse win of the sprint.

## 4. New shared platform capabilities

Added to the shared dev libraries (so future YAML tools inherit them):

- **`lib/dev/yaml.ts` extended** — `parseYaml` now returns **line/column** from the YAMLException
  mark; new **`parseYamlAll`** handles multi-document streams; `toYaml` gained `indent`/`sortKeys`/
  `noRefs` options.
- **`lib/dev/yamlInsights.ts` (new)** — `scanYaml` detects **anchors, aliases, merge keys,
  multi-document streams, and custom tags** from raw text and returns informational notes.
- **`lib/dev/jsonYaml.ts` (new)** — the reusable conversion engine (`convert`/`jsonToYaml`/
  `yamlToJson`), including **correct YAML merge-key (`<<:`) resolution** — js-yaml 4 leaves `<<`
  literal, so the engine flattens merges (own keys win). Any future YAML/config tool can reuse these.

## 5. Implementation

- **Conversion** both directions; JSON output as 2/4-space or minified; clean 2-space YAML.
- **Validation** real-time, with line/column and friendly explanations (JSON: trailing comma /
  comment / single quote / …; YAML: the parser's reason at the exact mark).
- **Warnings** — JSON input: duplicate keys, unsafe integers (via `scanJson`). YAML input:
  multi-document, anchors/aliases, merge keys, custom tags (via `scanYaml`).
- **Explorer** — the reused `JsonTree` (expand/collapse all, search, highlight) on the parsed value.
- **Statistics** — objects, arrays, scalars, properties, max depth, output chars/lines/size.
- **Editing** — paste, upload, download, copy, sample docs, **swap direction** (feeds the output
  back in for a one-click round-trip), sort keys.

## 6. Tests

- **Engine (`tests/lib/dev/jsonYaml.test.ts`, 18):** JSON→YAML; **lossless round-trips both ways**;
  unicode (₹ é 😀); invalid JSON/YAML with location + friendly reason; **anchors/aliases expansion**;
  **merge-key resolution** (own keys win); **multi-document → JSON array**; indent/minify/sort-keys;
  and the `scanYaml` feature detector (multi-doc, anchors, aliases, merge keys, custom vs standard
  tags, no false-positive on `&`/`#` in strings/comments).
- **UI (`tests/features/json-yaml-converter/JsonYamlConverter.test.tsx`, 8):** direction tabs;
  JSON→YAML and YAML→JSON; merge-key/alias resolution in the output; multi-document note; statistics;
  friendly error with location; **swap round-trip**. (EditorPanel/ResultViewer mocked, as for other
  dev tools whose CodeMirror editor is not jsdom-drivable.)

## 7. Documentation

This file + the DeveloperTrust surface (how it works incl. anchors/merge/multi-doc handling; RFC 8259,
YAML 1.2, js-yaml references) + a 6-item registry FAQ.

## 8. Registry updates

New `json-yaml-converter` (Developer category), 10 keywords, 6 FAQs, related dev tools. Tagged
`json`/`yaml`/`developer`/`formatter` so it routes to the Developer trust surface (deliberately **not**
`converter`, which is an Everyday-domain tag). `toolStatus` guardrail updated.

## 9. ProductFactory updates

Sprint record `Sprints/DEVELOPER-002/README.md`; registry row 49; CurrentState (28 live tools,
Developer 4); Metrics.

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — JSON ↔ YAML Converter).

## 11. Verification / quality checklist

- [x] 100% client-side — **no uploads, no network, no telemetry of document contents**; safe native
      parse (**no eval**).
- [x] Lossless round-trips; YAML features JSON can't hold are **resolved and reported**, never
      silently changed.
- [x] Huge-input safety: the tree is capped (>15,000 values); conversion/validation are not.
- [x] Accessibility: `tablist`/`tab` (direction + view), labelled editors, `role="alert"`/`status`,
      colour-independent validation + notes (icon/label + colour), keyboard-operable.
- [x] SEO: metadata, canonical, OG/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb),
      6-item FAQ, related tools.
- [x] Reuse: JSON insights + tree + editor/result/validation reused; no duplicated logic; no
      TODOs/placeholders/dead code.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## 12. Platform improvements delivered

`parseYamlAll` + YAML line/column + `scanYaml` + the `jsonYaml` conversion engine (with merge-key
resolution) are all in the shared dev libraries — a future **YAML Formatter/Validator**, **JSON
Diff**, or **`.env`/TOML converter** starts from these, not from scratch.

## 13. Lessons (reduce the cost of future developer tools)

- **Parse-to-JS is the universal interchange.** Because YAML and JSON both parse to plain JS, the
  entire TOOL-005 stats + tree layer was reused with zero changes — new _formats_ are cheap once one
  format's inspector exists.
- **js-yaml 4 does not resolve `<<` merge keys.** It leaves a literal `"<<"` key; a great converter
  must resolve it itself (own keys winning). Captured in the engine + tests so no future YAML tool
  rediscovers it.
- **Detect features from raw text, report them, resolve deterministically.** Anchors/aliases/merge/
  multi-doc are invisible after parsing; a raw-text scan + honest notes is what separates a real
  converter from a lossy one.

## Honest limitations

- Aliases are expanded (repeated values duplicated) and merge keys flattened — output is
  self-contained, not a faithful re-serialisation of the YAML reference graph.
- Custom/non-standard YAML tags cannot be represented in JSON; the resolved value is kept, the tag
  dropped (reported as a warning).
- Dark mode: the editor/result have their own dark toggle (reused); the rest follows the platform
  theme (light-only platform-wide today).

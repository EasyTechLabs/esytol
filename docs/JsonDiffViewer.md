# JSON Diff Viewer — Tool Documentation

> **Category:** Developer · **Slug:** `json-diff-viewer` · **Route:** `/tools/json-diff-viewer`
> **Status:** ✅ Live (DEVELOPER-003) · **Last Updated:** 2026-07-18
> **Engine:** `lib/dev/jsonDiff.ts` (new, reusable) · reuses `lib/dev/jsonInsights.ts` + `JsonTree.tsx` · **UI:** `features/tools/json-diff-viewer/{JsonDiffViewer,DiffTree}.tsx`

The build record for the JSON Diff Viewer — the Developer category's sixth tool, and the first
consumer of a **format-agnostic diff engine** that future YAML/XML/config/API diffs will reuse.

---

## 1. Problem

Developers, QA, and API engineers constantly need to see _what changed_ between two JSON documents —
an API response before/after, a config change, a fixture update. Line-based diffs are noisy for JSON
(reformatting shows as changes); online tools upload your data. Esytol needs a **structural** diff
that ignores formatting, is 100% local, and exports a standard patch.

## 2. Existing reusable assets discovered

Searched the repo first — **no diff utility existed** and no diff library was in `package.json`.
Reused: `lib/dev/jsonFormat.ts` (validate + line/column), `lib/dev/jsonInsights.ts`
(`explainJsonError`, `analyzeJson` — used to count subtree node sizes for statistics),
`features/tools/json-formatter/JsonTree.tsx` (the side-by-side trees), `EditorPanel`,
`ValidationStatus`, `CopyButton`, `metrics.timed`, `files.downloadText`, DeveloperTrust, SEO.

## 3. Architecture reuse

Statistics reuse `analyzeJson().totalValues` to count added/removed/unchanged subtree sizes; the
side-by-side view reuses `JsonTree` on each document. The dual-editor + independent validation reuse
the shared editor/validation exactly as the other JSON tools do.

## 4. New shared platform capabilities

**`lib/dev/jsonDiff.ts` (new, reusable)** — operates on **parsed JS values**, so it is format-
agnostic (a future YAML/XML/config/API diff parses to JS, then calls it):

- `diffValues(left, right)` → a diff tree (`added` / `removed` / `changed` / `type-changed` /
  `unchanged`), recursing objects and arrays, collapsing identical branches for performance.
- `diffStats(root)` → added / removed / modified / unchanged / total / maxDepth.
- `toJsonPatch(root)` → an **RFC 6902 JSON Patch** (RFC 6901 pointer escaping; array removals emitted
  highest-index-first so it applies cleanly).
- `collectDiffPaths` / `pathToPointer` / `isIdentical` — helpers for jump-to-diff and UI.

## 5. Implementation

- **Two inputs** (left/right), each with paste/upload/sample and **independent validation** (line/
  column + friendly reason).
- **Statistics** — added, removed, modified, unchanged, total, max depth.
- **Unified view** (`DiffTree`) — colour-coded (added/removed/changed/type), **changed → shown as
  left → right**, expand/collapse-all, **"changed only"** filter, **search + highlight**, and
  **jump to next/previous difference**. Lazy: collapsed branches render nothing; colour is never the
  only signal (every changed row has a text badge).
- **Side-by-side view** — the two documents rendered with the reused `JsonTree`.
- **Output** — an **RFC 6902 JSON Patch** you can **copy** or **download**; it transforms left → right.
- **Identical detection** — a clear "no differences" state.

## 6. Tests

- **Engine (`tests/lib/dev/jsonDiff.test.ts`, 15):** every kind (added/removed/changed/type-changed/
  unchanged); nested objects + arrays; array tail add/remove; unicode; **statistics** (incl. counting
  whole added/removed subtrees); the **RFC 6902 patch** with a **tiny applier that proves the patch
  transforms left → right**, pointer escaping (`~`,`/`), and highest-index-first array removals;
  `collectDiffPaths`; and safety — **no stack overflow on 1,000-deep input**, **no prototype
  pollution** from a `__proto__` key.
- **UI (`tests/features/json-diff-viewer/JsonDiffViewer.test.tsx`, 7):** statistics appear when both
  valid; identical detection; unified diff renders "changed"; RFC 6902 patch + copy; unified ↔
  side-by-side toggle (two trees); a deeply-nested change is visible by default (the review fix);
  friendly validation error on one side (and no stats until both valid). (EditorPanel mocked.)

## 7. Documentation

This file + the DeveloperTrust surface (how it works incl. structural comparison + RFC 6902 patch;
RFC 8259 / 6902 / 6901 references) + a 6-item registry FAQ.

## 8. Registry updates

New `json-diff-viewer` (Developer category), 10 keywords, 6 FAQs, related dev tools. Tagged
`json`/`diff`/`developer`/`formatter` → Developer trust surface. `toolStatus` guardrail updated.

## 9. ProductFactory updates

Sprint record `Sprints/DEVELOPER-003/README.md` (with the Final Release Report); registry row 50;
CurrentState (29 live tools, Developer 5); Metrics.

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — JSON Diff Viewer).

## 11. Verification / quality checklist

- [x] 100% client-side — **no uploads, no network**; safe native parse (**no eval**);
      **prototype-pollution-safe** (read-only traversal, tested with a `__proto__` key);
      **depth-guarded** (no stack overflow on deep input).
- [x] Structural diff, statistics, unified + side-by-side, search + jump, RFC 6902 patch export.
- [x] Performance: identical branches collapsed; lazy tree; changed-only filter; efficient recursion.
- [x] Accessibility: `tree`/`treeitem`/`group` roles, labelled search, prev/next buttons, colour +
      text badges (colour-independent), keyboard-operable.
- [x] SEO: metadata, canonical, OG/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb),
      6-item FAQ, related tools (JSON Formatter, JSON ↔ YAML).
- [x] Reuse: no duplicated logic; the diff engine is a new shared lib; no TODOs/placeholders/dead code.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## 12. Platform improvements delivered

`lib/dev/jsonDiff.ts` is a **format-agnostic** diff/patch engine (works on any parsed JS value). A
future **YAML Diff** is `parseYaml` → `diffValues`; an **XML Diff** or **config diff** is the same
pattern. The tool contributes the reusable primitive the mission asked for.

## 13. Lessons (reduce the cost of future developer tools)

- **Diff on parsed values, not text** — one engine serves every format that parses to JS; the tool is
  just the editors + a renderer over the diff tree.
- **Prove the patch, don't assert its shape** — the strongest patch test applies the generated patch
  and checks it reproduces the right document; that catches array-index and pointer-escaping bugs a
  shape assertion misses.
- **Array diffs are index-based by default** — reordering shows as changes; documenting this up front
  avoids a "bug" report and sets up a future move-detecting mode.

## Honest limitations

- Arrays compare by index (reordered elements show as changed, not moved).
- The RFC 6902 patch targets the index-aligned diff; apply with a standard library.
- Dark mode: the editors have their own dark toggle (reused); the rest follows the platform theme.

# XML Formatter & Validator — Tool Documentation

> **Category:** Developer · **Slug:** `xml-formatter` · **Route:** `/tools/xml-formatter`
> **Status:** ✅ Live (DEVELOPER-004) · **Last Updated:** 2026-07-18
> **Engine:** `lib/dev/xml.ts` (new, reusable) · **UI:** `features/tools/xml-formatter/{XmlFormatter,XmlTree}.tsx`

The build record for the XML Formatter & Validator — the Developer category's seventh tool, and the
platform's first XML engine (reusable by a future XML Diff / XPath tester).

---

## 1. Problem

Developers work with XML constantly (configs, SOAP/RSS, SVG, Office/OpenXML) and need to format,
minify, and validate it. Many online XML tools upload your data, and — worse for a validator — parse
with a DOM parser that can resolve **external entities (XXE)** or expand internal entities
(billion-laughs). Esytol needs an XML tool that is 100% local **and safe by construction**.

## 2. Existing reusable assets discovered

`lib/dev/parse.ts` has a DOMParser-based `parseXml` (well-formedness only). Reused unchanged:
`EditorPanel`, `ResultViewer`, `ValidationStatus`, `DevToolLayout`, `metrics.timed`, `validation`,
`files` (via EditorPanel's upload/download), DeveloperTrust, the SEO framework, and the search/
highlight + lazy-tree patterns from `JsonTree`/`DiffTree`.

## 3. Architecture reuse

Deliberate decision: **the tool does not use DOMParser.** DOMParser can expand internal entities
(billion-laughs) and, in some environments, resolve external ones (XXE); its errors are also browser-
specific. Instead the tool uses a new **controlled tokenizer** that is XXE-safe by construction and
gives better, line/column errors. The editor/result/validation UI is reused exactly as the JSON tools.

## 4. New shared platform capabilities

**`lib/dev/xml.ts` (new, reusable)** — a single-pass XML tokenizer/parser:

- `parseXmlDocument(input)` → an `XmlNode[]` tree (element / text / comment / cdata / pi /
  declaration / doctype) + a well-formedness `Validation` (line/column) + **metadata**: declaration,
  DOCTYPE, namespaces, processing instructions, entity references (kept literal), duplicate attributes.
- `formatXml(input, { indent, minify })` → pretty-print (2/4/tab) or minify, preserving all content.
- `analyzeXml(nodes)` → elements, attributes, text nodes, comments, CDATA, max depth.
- **XXE-safe by construction**: never resolves external entities, never evaluates a DTD, never expands
  entities, never touches the network. A future XML Diff or XPath tester reuses this engine.

## 5. Implementation

- **Formatting** — pretty (2/4/tab) or **minify**; content preserved exactly.
- **Validation** — real-time well-formedness with **line & column** and a friendly reason (mismatched/
  unclosed tag, unquoted/duplicate attribute, multiple roots, unterminated comment/CDATA/PI/DOCTYPE).
- **Explorer** — a lazy, searchable **tree view** (element hierarchy, attributes, text, comments,
  CDATA, PIs) with expand/collapse all and highlight.
- **Statistics** — elements, attributes, text nodes, max depth, characters, lines.
- **Summary / warnings** — XML declaration, DOCTYPE (with the XXE-safe note), namespace list, entity
  references (literal), processing instructions, and duplicate attributes.
- **Editing** — paste, upload, download, copy, clear, sample (via the reused editor + result viewer).

## 6. Tests

- **Engine (`tests/lib/dev/xml.test.ts`, 20):** pretty/inline/minify; declaration/comment/CDATA/PI
  preservation; self-closing + attributes; unicode; validation errors with line/column (mismatched,
  unclosed, unquoted attr, multiple roots); metadata (declaration, DOCTYPE, namespaces, PIs, entities,
  duplicate attributes); **XXE safety** (an external-entity `&xxe;` payload stays literal — no file
  contents ever appear) and **billion-laughs** (nested entity stays a single literal reference); stats;
  a 5,000-element document; and tree shape.
- **UI (`tests/features/xml-formatter/XmlFormatter.test.tsx`, 6):** pretty-print; statistics; friendly
  validation error (and no stats when invalid); tree view; the DOCTYPE/XXE-safe warning + literal
  entity; minify toggle. (EditorPanel/ResultViewer mocked, as for other dev tools.)

## 7. Documentation

This file + the DeveloperTrust surface (how it works, the tokenizer-not-DOMParser choice, XXE note;
XML 1.0 / XML Namespaces / OWASP XXE references) + a 6-item registry FAQ.

## 8. Registry updates

New `xml-formatter` (Developer category), 10 keywords, 6 FAQs, related dev tools. Tagged
`xml`/`formatter`/`validator`/`developer` → Developer trust surface. `toolStatus` guardrail updated.

## 9. ProductFactory updates

Sprint record `Sprints/DEVELOPER-004/README.md` (with the Final Release Report); registry row 51;
CurrentState (30 live tools, Developer 6); Metrics.

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — XML Formatter & Validator).

## 11. Verification / quality checklist

- [x] 100% client-side — **no uploads, no network**; **XXE-safe by construction** (no external-entity
      resolution, no DTD evaluation, no entity expansion; tested); **no eval**.
- [x] Format/minify, validation with line/column, tree + search, statistics, namespace/DOCTYPE/entity
      summary, upload/download/copy/clear/sample.
- [x] Huge-input safety: the tree is capped (>15,000 elements); formatting/validation are not; O(n) parse.
- [x] Accessibility: `tree`/`treeitem`/`group` roles, labelled search, colour-independent validation +
      notes (icon/label + colour), keyboard-operable.
- [x] SEO: metadata, canonical, OG/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb),
      6-item FAQ, related tools (JSON Formatter, JSON ↔ YAML, JSON Diff).
- [x] Reuse: editor/result/validation/layout reused; the XML engine is a new shared lib; no duplicated
      logic; no TODOs/placeholders/dead code.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## 12. Platform improvements delivered

`lib/dev/xml.ts` is the platform's XML primitive: a safe tokenizer/parser + formatter + stats. A
future **XML Diff** is `parseXmlDocument` → (map to a comparable shape) → `jsonDiff.diffValues`; an
**XPath tester** builds on the same node tree.

## 13. Lessons (reduce the cost of future developer tools)

- **For a validator, control the parser.** A DOM parser is a security liability (XXE / entity
  expansion) and gives browser-specific errors. A small controlled tokenizer is safer _and_ produces
  better line/column messages — worth the code.
- **Safety is testable.** The XXE and billion-laughs tests assert that a hostile payload's file
  contents never appear and entities never expand — a regression guard, not a claim.
- **One tree pattern, many formats.** The lazy-render + search + highlight pattern (JsonTree → DiffTree
  → XmlTree) is now proven across three node shapes; the next tree tool is a small variation.

## Honest limitations

- Validates **well-formedness**, not validity against a DTD/XML Schema.
- Entity references are kept literal (never expanded) — intentional for safety.
- Dark mode: the editor/result have their own dark toggle (reused); the rest follows the platform theme.

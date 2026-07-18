# CSV ↔ JSON Converter — Tool Documentation

> **Category:** Developer · **Slug:** `csv-json-converter` · **Route:** `/tools/csv-json-converter`
> **Status:** ✅ Live (DEVELOPER-005) · **Last Updated:** 2026-07-18
> **Engine:** `lib/dev/csv.ts` (new, reusable) · **UI:** `features/tools/csv-json-converter/{CsvJsonConverter,CsvTable}.tsx`

The build record for the CSV ↔ JSON Converter — the Developer category's seventh tool, and the
platform's first tabular-data engine (reusable by a future TSV tool, table viewer, or importer).

---

## 1. Problem

CSV and JSON are the two formats every developer moves data between — exports, API payloads,
spreadsheets, config. Online converters routinely upload your data, mishandle quotes/delimiters, and —
dangerously — produce CSV that lets a spreadsheet **execute a formula** from an untrusted cell (CSV
injection). Esytol needs a converter that is 100% local, correct on the hard cases (quotes, multiline,
Unicode, ragged rows), and safe by default.

## 2. Existing reusable assets discovered

`lib/dev/parse.ts` has a small `parseCsv` (string[][], no location errors) used by other callers —
left untouched. Reused unchanged: `formatJson` + `explainJsonError` (JSON validation with line/column
and friendly reasons), `EditorPanel`, `ResultViewer`, `ValidationStatus`, `DevToolLayout`,
`metrics.timed`, `validation`, the `JsonTree` explorer, DeveloperTrust, and the SEO framework. The UI
mirrors the JSON ↔ YAML Converter (DEVELOPER-002) — same bidirectional shell, swap, and stats panel.

## 3. Architecture reuse

The tool is the CSV analogue of the JSON ↔ YAML Converter: a new engine plus reused shell. JSON-side
validation reuses `formatJson`/`explainJsonError` verbatim (no JSON parser reimplemented); the JSON
tree reuses `JsonTree`. Only the CSV parsing/serialising/flattening/stats and the table preview are new.

## 4. New shared platform capabilities

**`lib/dev/csv.ts` (new, reusable):**

- `parseCsvRows(input, delimiter)` → `string[][]` with **row/column error tracking** (RFC 4180: quoted
  fields, escaped quotes, delimiters/newlines in quotes, CRLF/LF, empty values, Unicode; reports
  unterminated quotes and text-after-closing-quote).
- `detectDelimiter(input)` → picks comma/semicolon/tab/pipe by cross-line consistency (quote-aware).
- `inferCellValue(raw)` → booleans/null/safe numbers; keeps leading-zero, big-int, and ambiguous
  values as strings (lossless by default).
- `csvToJson` / `jsonToCsv` / `convertCsvJson` → the two directions with a common result shape
  (`output`, `validation`, `value` for the tree, `table` for the preview, `stats`, `warnings`).
- **Safe by construction:** never uploads/fetches; never evaluates a cell; on JSON→CSV, formula-injection
  cells (`=`, `+`, `-`, `@`, tab, CR) are neutralised (OWASP); `__proto__` column names are guarded.
- Reusable by a future TSV converter, table viewer, or spreadsheet importer.

## 5. Implementation

- **CSV → JSON** — header detection (duplicates made unique, blanks filled), custom **or auto**
  delimiter, quote/escaped-quote/empty/multiline/Unicode handling, optional type inference, blank-line
  skipping, ragged-row warnings, missing cells → empty values.
- **JSON → CSV** — array of objects (or a single object wrapped), **dot-notation flattening** of nested
  objects, arrays serialised as JSON in a cell, **stable first-seen column order**, missing fields →
  empty cells, minimal RFC 4180 quoting, formula-injection protection (toggle).
- **Formatting** — pretty (2/4-space) or minified JSON; clean CRLF CSV.
- **Validation** — friendly errors with **row & column** (unterminated quote, invalid quoting; JSON
  errors via `explainJsonError`); inconsistent columns and sanitised cells surfaced as notes.
- **Explorer** — **Table preview** (lazy, searchable, first 200 rows) + **JSON tree** (reused) + raw output.
- **Statistics** — rows, columns, empty cells, max width, characters, file size.
- **Editing** — paste, upload, download, copy, clear, sample datasets, **swap direction** (round-trips).

## 6. Tests

- **Engine (`tests/lib/dev/csv.test.ts`, 35):** delimiters (custom + auto-detect + consistency),
  quotes, escaped quotes, empty values, CRLF, Unicode, unterminated-quote + invalid-quoting locations;
  type inference (incl. leading-zero and big-int kept as strings); header detection, ragged rows,
  duplicate/blank headers, no-header `column_N`, `__proto__` guard; JSON→CSV flattening, stable order +
  missing fields, quoting, arrays-as-JSON, injection neutralise/off, single-object + empty-object; stats,
  **round-trip**, and a **5,000-row** document.
- **UI (`tests/features/csv-json-converter/CsvJsonConverter.test.tsx`, 7):** CSV→JSON with header, type
  inference toggle, statistics, table preview, friendly error (no stats when invalid), JSON→CSV +
  injection note, and swap. (EditorPanel/ResultViewer mocked.)

## 7. Documentation

This file + the DeveloperTrust surface (how it works, limitations; RFC 4180 / RFC 8259 / OWASP
CSV-Injection references) + a 6-item registry FAQ.

## 8. Registry updates

New `csv-json-converter` (Developer), 10 keywords, 6 FAQs, related dev tools. Tagged
`csv`/`json`/`developer`/`formatter` → Developer trust surface. `toolStatus` guardrail updated.

## 9. ProductFactory updates

Sprint record `Sprints/DEVELOPER-005/README.md` (with the Final Release Report); registry row 52;
CurrentState (31 live tools, Developer 7); Metrics.

## 10. CHANGELOG updates

New entry in `docs/CHANGELOG.md` (2026-07-18 — CSV ↔ JSON Converter).

## 11. Verification / quality checklist

- [x] 100% client-side — **no uploads, no network**; **CSV-injection safe** (formulas neutralised, never
      executed); `__proto__` column guard; no eval.
- [x] Both directions, delimiter auto-detect, header/quote/multiline/Unicode handling, type inference,
      flattening, stable columns, stats, table + tree explorer, upload/download/copy/clear/sample/swap.
- [x] Large-file safety: O(n) parse, no `Math.max(...spread)`; table preview capped; tree capped.
- [x] Accessibility: real `<table>` with caption + `scope`, labelled search + selects, colour-independent
      notes, keyboard-operable.
- [x] SEO: metadata, canonical, OG/Twitter, Schema.org (SoftwareApplication + FAQ + Breadcrumb), 6-item
      FAQ, related tools (JSON Formatter, JSON ↔ YAML, XML Formatter).
- [x] Reuse: editor/result/validation/layout + JSON validation + JsonTree reused; CSV engine is new; no
      duplicated logic; no TODOs/placeholders/dead code.
- [x] `format:check` · `lint` · `type-check` · full test suite · `next build` — all green.

## 12. Platform improvements delivered

`lib/dev/csv.ts` is the platform's tabular-data primitive: a location-aware RFC 4180 parser, delimiter
detection, type inference, dot-notation flattening, and CSV-injection-safe serialisation. A future
**TSV converter** is `convertCsvJson` with `delimiter: "\t"`; a **table viewer** reuses `parseCsvRows` +
`CsvTablePreview`.

## 13. Lessons (reduce the cost of future developer tools)

- **The bidirectional-converter shell is now a pattern.** JSON↔YAML → CSV↔JSON reused the same
  direction/swap/stats/explorer scaffold; a new converter is mostly its engine.
- **Security lives in the serialiser.** CSV injection is a _write_-side problem — neutralise on output,
  make it a toggle, and surface a note; the parser stays faithful.
- **Faithful parser, opinionated caller.** `parseCsvRows` never drops blank lines or renames columns;
  `csvToJson` does. Keeping the low-level primitive faithful makes it reusable.

## Honest limitations

- Type inference is off by default (lossless strings); when on, ambiguous/leading-zero/big-int values
  stay strings.
- JSON→CSV flattens objects (dot notation) and writes arrays/remaining structure as JSON in a cell — not
  a full relational normalisation.
- The table preview renders the first rows for responsiveness; the full data is always in the output and
  download.

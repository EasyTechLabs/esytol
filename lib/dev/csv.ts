/**
 * CSV ↔ JSON engine — the reusable CSV layer (DEVELOPER-005).
 *
 * A controlled, single-pass RFC 4180 tokenizer with line/column error tracking, plus a JSON→CSV
 * serialiser with dot-notation flattening and stable column ordering. It is **safe by construction**:
 *  - never uploads or fetches anything (pure, deterministic functions),
 *  - never evaluates a cell — a spreadsheet formula (`=`, `+`, `-`, `@`, tab, CR) is treated as plain
 *    text, and on JSON→CSV such a cell is neutralised (CSV-injection protection, OWASP) so opening the
 *    file in Excel/Sheets can never execute it.
 *
 * The richer `parseCsvRows` here (location-aware errors, quote validation) complements the small
 * `parseCsv` in lib/dev/parse.ts (which other callers use); it is reusable by a future TSV tool,
 * table viewer, or spreadsheet importer.
 */

import { formatJson } from "./jsonFormat";
import { explainJsonError } from "./jsonInsights";
import { type Validation, valid, error } from "./validation";

export type CsvDirection = "csv2json" | "json2csv";
export type JsonIndent = "2" | "4" | "minify";

export interface CsvOptions {
  /** Field separator. Undefined → auto-detect (csv2json) / "," (json2csv). */
  delimiter?: string;
  /** csv2json: treat the first row as column names (default true). */
  hasHeader?: boolean;
  /** csv2json: convert numbers/booleans/null from text (default false — keep everything a string). */
  inferTypes?: boolean;
  /** csv2json: JSON output indentation. */
  jsonIndent?: JsonIndent;
  /** json2csv: neutralise formula-injection cells (default true). */
  sanitizeInjection?: boolean;
}

export interface CsvWarning {
  severity: "info" | "warning";
  title: string;
  detail: string;
}

export interface CsvStats {
  /** Data rows (excludes the header). */
  rows: number;
  columns: number;
  emptyCells: number;
  /** Longest single cell, in characters. */
  maxWidth: number;
  characters: number;
  bytes: number;
}

export interface CsvTable {
  header: string[];
  rows: string[][];
}

export interface CsvConvertResult {
  ok: boolean;
  output: string;
  validation: Validation;
  /** Parsed JS value (the JSON side) — for the tree view. `undefined` on failure. */
  value?: unknown;
  /** The CSV side (header + rows) — for the table preview. `undefined` on failure. */
  table?: CsvTable;
  stats?: CsvStats;
  warnings: CsvWarning[];
  /** The delimiter used (detected or supplied). */
  delimiter: string;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

export interface CsvParseError {
  message: string;
  line: number;
  column: number;
}

export interface CsvParseResult {
  ok: boolean;
  rows: string[][];
  error?: CsvParseError;
}

/** The delimiters we auto-detect between, in preference order. */
const DELIMITERS = [",", ";", "\t", "|"];

/**
 * RFC 4180 CSV parser with line/column error tracking. Handles quoted fields, escaped quotes (`""`),
 * delimiters and newlines inside quotes, CRLF/LF, empty values, and Unicode. Reports unterminated
 * quotes and text after a closing quote (invalid quoting) with a location. Faithful — it does not
 * drop blank lines (callers decide); use `skipBlankRows` for that.
 */
export function parseCsvRows(input: string, delimiter = ","): CsvParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = input.length;
  if (n === 0) return { ok: true, rows };

  const advance = (): void => {
    if (input[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  };

  // One field is read per pass; the row terminates only on a line break or end-of-input — so a
  // trailing delimiter (a,b,) correctly yields a trailing empty field.
  for (;;) {
    let field = "";

    if (input[i] === '"') {
      // Quoted field.
      const qLine = line;
      const qCol = col;
      advance(); // opening quote
      let closed = false;
      while (i < n) {
        const ch = input[i];
        if (ch === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            advance();
            advance();
          } else {
            advance(); // closing quote
            closed = true;
            break;
          }
        } else {
          field += ch;
          advance();
        }
      }
      if (!closed) {
        return {
          ok: false,
          rows,
          error: {
            message: 'A quoted value is never closed — add the missing double-quote (").',
            line: qLine,
            column: qCol,
          },
        };
      }
      // After a closing quote only a delimiter, a line break, or end-of-input is valid.
      if (i < n && input[i] !== delimiter && input[i] !== "\n" && input[i] !== "\r") {
        return {
          ok: false,
          rows,
          error: {
            message: `Unexpected text after a closing quote — a quoted value must end at the ${describeDelimiter(
              delimiter
            )} or line break. Escape a literal quote inside the value by doubling it ("").`,
            line,
            column: col,
          },
        };
      }
    } else {
      // Unquoted field — read to the next delimiter or line break (a quote here is kept literal).
      while (i < n && input[i] !== delimiter && input[i] !== "\n" && input[i] !== "\r") {
        field += input[i];
        advance();
      }
    }

    row.push(field);

    if (i >= n) {
      // End of input mid-row — finalise the row we were building.
      rows.push(row);
      break;
    }
    if (input[i] === delimiter) {
      advance();
      continue; // another field on the same row
    }
    // Line break: consume CRLF or a lone LF/CR, then end the row.
    if (input[i] === "\r") {
      advance();
      if (i < n && input[i] === "\n") advance();
    } else {
      advance(); // "\n"
    }
    rows.push(row);
    row = [];
    if (i >= n) break; // a trailing newline does not create an empty row
  }

  return { ok: true, rows };
}

function describeDelimiter(d: string): string {
  if (d === "\t") return "tab";
  if (d === ",") return "comma";
  if (d === ";") return "semicolon";
  if (d === "|") return "pipe";
  return `"${d}"`;
}

/** A row that is a single empty cell is a blank line — drop those. */
function skipBlankRows(rows: string[][]): string[][] {
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/**
 * Auto-detect the delimiter from the first few lines: the candidate that appears most consistently
 * (same count on each non-empty line), preferring more occurrences. Falls back to comma.
 */
export function detectDelimiter(input: string): string {
  const sample = input
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 10);
  if (sample.length === 0) return ",";

  let best = ",";
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = sample.map((line) => countOutsideQuotes(line, d));
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    // Consistency: how many lines share the (non-zero) modal count.
    const first = counts[0];
    const consistent = counts.every((c) => c === first) && first > 0;
    const score = total + (consistent ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      count++;
    }
  }
  return count;
}

// ─── Type inference ──────────────────────────────────────────────────────────

/**
 * Infer a JS value from a CSV cell: booleans, null, and safe numbers; everything else stays a string.
 * Leading-zero strings ("007", "0123"), empty cells, and integers beyond the safe range are kept as
 * strings so no data is silently corrupted.
 */
export function inferCellValue(raw: string): unknown {
  if (raw === "") return "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (!Number.isFinite(num)) return raw;
    // Keep big integers as strings to avoid precision loss.
    if (Number.isInteger(num) && Math.abs(num) > Number.MAX_SAFE_INTEGER) return raw;
    return num;
  }
  return raw;
}

// ─── CSV → JSON ────────────────────────────────────────────────────────────────

function jsonIndentValue(indent: JsonIndent): number {
  return indent === "minify" ? 0 : Number(indent);
}

export function csvToJson(input: string, options: CsvOptions = {}): CsvConvertResult {
  const hasHeader = options.hasHeader ?? true;
  const inferTypes = options.inferTypes ?? false;
  const delimiter = options.delimiter ?? detectDelimiter(input);
  const warnings: CsvWarning[] = [];

  if (input.trim() === "")
    return { ok: false, output: "", validation: error("Empty input"), warnings, delimiter };

  const parsed = parseCsvRows(input, delimiter);
  if (!parsed.ok && parsed.error) {
    return {
      ok: false,
      output: "",
      validation: {
        ...error("Invalid CSV", parsed.error.message),
        line: parsed.error.line,
        column: parsed.error.column,
      },
      warnings,
      delimiter,
    };
  }

  const allRows = skipBlankRows(parsed.rows);
  if (allRows.length === 0)
    return { ok: false, output: "", validation: error("No data rows found"), warnings, delimiter };

  let header: string[];
  let dataRows: string[][];
  if (hasHeader) {
    header = dedupeHeader(allRows[0], warnings);
    dataRows = allRows.slice(1);
  } else {
    // Reduce, not Math.max(...spread) — spreading a huge array as arguments overflows the stack.
    const width = allRows.reduce((max, r) => (r.length > max ? r.length : max), 0);
    header = Array.from({ length: width }, (_, k) => `column_${k + 1}`);
    dataRows = allRows;
  }

  // Inconsistent-column detection (non-fatal — real CSV is often ragged).
  const ragged = dataRows.filter((r) => r.length !== header.length).length;
  if (ragged > 0)
    warnings.push({
      severity: "warning",
      title: `${ragged} row${ragged === 1 ? "" : "s"} with a different column count`,
      detail: `The header has ${header.length} column${
        header.length === 1 ? "" : "s"
      }; some rows have more or fewer cells. Missing cells become empty values and any extra cells are dropped.`,
    });

  const cell = (v: string): unknown => (inferTypes ? inferCellValue(v) : v);
  const value = dataRows.map((r) => {
    const obj: Record<string, unknown> = {};
    for (let k = 0; k < header.length; k++) setKey(obj, header[k], cell(r[k] ?? ""));
    return obj;
  });

  const output = JSON.stringify(value, null, jsonIndentValue(options.jsonIndent ?? "2"));
  const table: CsvTable = { header, rows: dataRows };
  const stats = computeStats(header, dataRows, input);

  return {
    ok: true,
    output,
    validation: valid(
      `Converted CSV → JSON (${dataRows.length} row${dataRows.length === 1 ? "" : "s"})`
    ),
    value,
    table,
    stats,
    warnings,
    delimiter,
  };
}

/** Ensure column names are unique (a duplicate becomes `name_2`, `name_3`, …) and non-empty. */
function dedupeHeader(raw: string[], warnings: CsvWarning[]): string[] {
  const seen = new Map<string, number>();
  let renamed = 0;
  let blank = 0;
  const out = raw.map((name, k) => {
    let key = name === "" ? `column_${k + 1}` : name;
    if (name === "") blank++;
    if (seen.has(key)) {
      renamed++;
      const next = (seen.get(key) ?? 1) + 1;
      seen.set(key, next);
      key = `${key}_${next}`;
    } else {
      seen.set(key, 1);
    }
    return key;
  });
  if (renamed > 0)
    warnings.push({
      severity: "info",
      title: `${renamed} duplicate column name${renamed === 1 ? "" : "s"} renamed`,
      detail:
        "JSON object keys must be unique, so repeated column names were suffixed (name_2, name_3, …).",
    });
  if (blank > 0)
    warnings.push({
      severity: "info",
      title: `${blank} blank column name${blank === 1 ? "" : "s"} filled`,
      detail: "Empty header cells were named column_N so every field has a key.",
    });
  return out;
}

/**
 * Assign a key as a genuine own data property — via defineProperty for `__proto__` so a `__proto__`
 * column name becomes real data instead of mutating the object's prototype (prototype-pollution guard).
 */
function setKey(target: Record<string, unknown>, key: string, value: unknown): void {
  if (key === "__proto__") {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}

// ─── JSON → CSV ────────────────────────────────────────────────────────────────

export function jsonToCsv(input: string, options: CsvOptions = {}): CsvConvertResult {
  const delimiter = options.delimiter ?? ",";
  const sanitize = options.sanitizeInjection ?? true;
  const warnings: CsvWarning[] = [];

  if (input.trim() === "")
    return { ok: false, output: "", validation: error("Empty input"), warnings, delimiter };

  const f = formatJson(input, { indent: "2" });
  if (!f.ok) {
    return {
      ok: false,
      output: "",
      validation: {
        ...error("Invalid JSON", explainJsonError(input, f.error)),
        line: f.line ?? undefined,
        column: f.column ?? undefined,
      },
      warnings,
      delimiter,
    };
  }

  const value: unknown = JSON.parse(input);
  // Accept an array of records, or a single record (wrapped into one row).
  const records = Array.isArray(value) ? value : [value];
  if (records.length === 0) {
    return {
      ok: true,
      output: "",
      validation: valid("Converted JSON → CSV (empty)"),
      value,
      table: { header: [], rows: [] },
      stats: computeStats([], [], ""),
      warnings,
      delimiter,
    };
  }

  // Flatten each record to a flat map of dot-notation columns → string cells.
  const flatRows = records.map((r) => flattenRecord(r));

  // Stable column ordering: first-seen order across all rows (deterministic, preserves natural order).
  const header: string[] = [];
  const seen = new Set<string>();
  for (const fr of flatRows)
    for (const key of Object.keys(fr))
      if (!seen.has(key)) {
        seen.add(key);
        header.push(key);
      }

  let injected = 0;
  const bodyRows = flatRows.map((fr) =>
    header.map((col) => {
      let v = fr[col] ?? "";
      if (sanitize && isInjectionRisk(v)) {
        v = "'" + v;
        injected++;
      }
      return v;
    })
  );

  if (injected > 0)
    warnings.push({
      severity: "info",
      title: `${injected} cell${injected === 1 ? "" : "s"} neutralised against formula injection`,
      detail:
        "Cells starting with =, +, -, @, tab, or carriage return were prefixed with an apostrophe so a spreadsheet cannot execute them as formulas (OWASP CSV-injection guidance). Turn off protection to keep the raw text.",
    });

  const lines = [header, ...bodyRows].map((cells) =>
    cells.map((c) => quoteCsvField(c, delimiter)).join(delimiter)
  );
  const output = lines.join("\r\n");
  const stats = computeStats(header, bodyRows, output);

  return {
    ok: true,
    output,
    validation: valid(
      `Converted JSON → CSV (${bodyRows.length} row${bodyRows.length === 1 ? "" : "s"})`
    ),
    value,
    table: { header, rows: bodyRows },
    stats,
    warnings,
    delimiter,
  };
}

/**
 * Flatten one record into dot-notation string cells. Nested objects recurse (a.b.c); arrays and any
 * remaining structure are serialised as compact JSON so columns stay stable. A non-object record
 * (scalar or array) is placed under a single `value` column.
 */
function flattenRecord(record: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    out.value = scalarToCell(record);
    return out;
  }
  const walk = (val: unknown, prefix: string): void => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length === 0) {
        // A nested empty object keeps its column (empty); a top-level empty record yields no columns.
        if (prefix !== "") out[prefix] = "";
        return;
      }
      for (const [k, v] of entries) walk(v, prefix ? `${prefix}.${k}` : k);
    } else {
      out[prefix] = scalarToCell(val);
    }
  };
  walk(record, "");
  return out;
}

function scalarToCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val) || typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/** A cell that a spreadsheet might interpret as a formula. */
function isInjectionRisk(value: string): boolean {
  return /^[=+\-@\t\r]/.test(value);
}

/** Quote a field if it contains the delimiter, a quote, a line break, or edge whitespace. */
function quoteCsvField(value: string, delimiter: string): string {
  const needsQuote =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim();
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

// ─── Statistics ────────────────────────────────────────────────────────────────

function computeStats(header: string[], dataRows: string[][], csvText: string): CsvStats {
  let emptyCells = 0;
  let maxWidth = 0;
  for (const h of header) if (h.length > maxWidth) maxWidth = h.length;
  for (const row of dataRows) {
    for (const cell of row) {
      if (cell === "") emptyCells++;
      if (cell.length > maxWidth) maxWidth = cell.length;
    }
  }
  return {
    rows: dataRows.length,
    columns: header.length,
    emptyCells,
    maxWidth,
    characters: csvText.length,
    bytes: new TextEncoder().encode(csvText).length,
  };
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function convertCsvJson(
  input: string,
  direction: CsvDirection,
  options: CsvOptions = {}
): CsvConvertResult {
  return direction === "csv2json" ? csvToJson(input, options) : jsonToCsv(input, options);
}

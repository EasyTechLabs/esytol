/**
 * JSON ↔ YAML conversion engine (DEVELOPER-002).
 *
 * Composes the existing, tested primitives — no parser is reimplemented:
 *  - JSON side: `formatJson` (validate + line/column) + `explainJsonError` (friendly reasons).
 *  - YAML side: `parseYamlAll` (multi-document, line/column) + `toYaml` (clean serialisation).
 *
 * Never loses valid data: standard JSON values round-trip JSON → YAML → JSON exactly, and
 * YAML → JSON → YAML preserves the resolved value. The parsed value is returned so the tool can
 * reuse `analyzeJson` (stats) and `JsonTree` (explorer) without parsing again.
 *
 * Pure and deterministic; nothing touches the network, DOM, or storage.
 */

import { formatJson } from "./jsonFormat";
import { explainJsonError } from "./jsonInsights";
import { parseYamlAll, toYaml } from "./yaml";
import { type Validation, valid, error } from "./validation";

export type Direction = "json2yaml" | "yaml2json";
export type JsonIndent = "2" | "4" | "minify";

export interface ConvertOptions {
  /** JSON output indentation (yaml2json only). */
  jsonIndent?: JsonIndent;
  /** YAML output indentation (json2yaml only). */
  yamlIndent?: number;
  sortKeys?: boolean;
}

export interface ConvertResult {
  ok: boolean;
  output: string;
  validation: Validation;
  /** The parsed JS value — for statistics and the tree view. `undefined` on failure. */
  value?: unknown;
  /** Number of YAML documents parsed (yaml2json); 1 for JSON input. */
  documentCount: number;
}

function jsonIndentValue(indent: JsonIndent): number {
  return indent === "minify" ? 0 : Number(indent);
}

/** JSON → YAML: validate JSON (friendly errors + location), then serialise to clean YAML. */
export function jsonToYaml(input: string, options: ConvertOptions = {}): ConvertResult {
  if (input.trim() === "")
    return { ok: false, output: "", validation: error("Empty input"), documentCount: 1 };

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
      documentCount: 1,
    };
  }

  const value = JSON.parse(input);
  const y = toYaml(value, { indent: options.yamlIndent ?? 2, sortKeys: options.sortKeys });
  if (!y.ok) return { ok: false, output: "", validation: y.validation, documentCount: 1 };

  return {
    ok: true,
    output: y.output,
    validation: valid("Converted JSON → YAML"),
    value,
    documentCount: 1,
  };
}

/**
 * YAML → JSON: parse (multi-document aware, friendly errors + location), then serialise to JSON.
 * A multi-document stream becomes a JSON array (one element per document).
 */
export function yamlToJson(input: string, options: ConvertOptions = {}): ConvertResult {
  if (input.trim() === "")
    return { ok: false, output: "", validation: error("Empty input"), documentCount: 0 };

  const p = parseYamlAll(input);
  if (!p.ok) return { ok: false, output: "", validation: p.validation, documentCount: 0 };

  const documentCount = p.documents.length;
  try {
    // js-yaml 4 leaves the `<<` merge key literal; resolve it so the JSON matches YAML semantics
    // (merged maps flattened in, own keys winning) rather than emitting a stray "<<" property.
    const value = resolveMergeKeys(documentCount > 1 ? p.documents : (p.documents[0] ?? null));
    const sorted = options.sortKeys ? sortDeep(value) : value;
    const output = JSON.stringify(sorted, null, jsonIndentValue(options.jsonIndent ?? "2"));
    return {
      ok: true,
      output,
      validation: valid(
        documentCount > 1
          ? `Converted YAML → JSON (${documentCount} documents → array)`
          : "Converted YAML → JSON"
      ),
      value,
      documentCount,
    };
  } catch (e) {
    // A recursive YAML anchor (e.g. `a: &x { self: *x }`) yields a circular structure, which
    // JSON cannot represent — JSON.stringify throws a TypeError and deep recursion a RangeError.
    const circular = e instanceof TypeError || e instanceof RangeError;
    return {
      ok: false,
      output: "",
      validation: error(
        "Cannot convert to JSON",
        circular
          ? "This YAML contains a circular reference (a recursive anchor/alias). JSON has no way to represent a value that refers to itself, so it cannot be converted."
          : e instanceof Error
            ? e.message
            : "Conversion failed."
      ),
      documentCount,
    };
  }
}

/**
 * Assign a key as a genuine own, enumerable data property — using defineProperty for `__proto__`
 * so a `__proto__` key becomes real data instead of mutating the object's prototype (prototype-
 * pollution guard).
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

/**
 * Resolve YAML merge keys (`<<`). js-yaml 4's default schema does not process them, so a merge
 * key arrives as a literal `"<<"` property whose value is a map (or an array of maps for multiple
 * merges). YAML semantics: own keys override merged keys; among several merge sources the first
 * listed wins. This flattens them in and drops the `<<` key.
 */
function resolveMergeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveMergeKeys);
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const own: Record<string, unknown> = {};
  let mergeSources: unknown;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "<<") mergeSources = v;
    else setKey(own, k, resolveMergeKeys(v));
  }
  if (mergeSources === undefined) return own;

  const merged: Record<string, unknown> = {};
  const sources = Array.isArray(mergeSources) ? mergeSources : [mergeSources];
  // Apply last→first so the first-listed source wins among merges; own keys then win over all.
  for (const source of [...sources].reverse()) {
    if (source && typeof source === "object" && !Array.isArray(source)) {
      for (const [k, v] of Object.entries(source as Record<string, unknown>))
        setKey(merged, k, resolveMergeKeys(v));
    }
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) setKey(result, k, v);
  for (const [k, v] of Object.entries(own)) setKey(result, k, v);
  return result;
}

/** Recursively sort object keys (used when sortKeys is on). */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Convert in the requested direction. */
export function convert(
  input: string,
  direction: Direction,
  options: ConvertOptions = {}
): ConvertResult {
  return direction === "json2yaml" ? jsonToYaml(input, options) : yamlToJson(input, options);
}

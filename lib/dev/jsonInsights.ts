/**
 * JSON insight engine — the analysis layer of the JSON Formatter (TOOL-005).
 *
 * The format/validate transform lives in lib/dev/jsonFormat (unchanged). This module
 * adds what turns a formatter into a validator + inspector:
 *  - `analyzeJson` — statistics (objects, arrays, properties, depth, value types).
 *  - `scanJson` — a single-pass tokenizer that finds duplicate keys (which JSON.parse
 *    silently drops) and integers outside JavaScript's safe range (which lose precision).
 *  - `explainJsonError` — turns a raw parser message into a human, actionable reason
 *    (trailing comma, comment, single quotes, unquoted key, NaN/Infinity, Python literals).
 *  - `countJsonMatches` — key/value search-match counting for the tree view.
 *
 * Pure and deterministic; nothing here touches the network, DOM, or storage.
 */

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface JsonStats {
  objects: number;
  arrays: number;
  properties: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  /** Deepest level of nested containers (a top-level object/array is depth 1). */
  maxDepth: number;
  /** Every value, including containers — a "size" signal. */
  totalValues: number;
}

export function analyzeJson(value: unknown): JsonStats {
  const stats: JsonStats = {
    objects: 0,
    arrays: 0,
    properties: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    maxDepth: 0,
    totalValues: 0,
  };

  const walk = (v: unknown, depth: number): void => {
    stats.totalValues++;
    if (v === null) {
      stats.nulls++;
      return;
    }
    if (Array.isArray(v)) {
      stats.arrays++;
      if (depth > stats.maxDepth) stats.maxDepth = depth;
      for (const item of v) walk(item, depth + 1);
      return;
    }
    switch (typeof v) {
      case "object": {
        stats.objects++;
        if (depth > stats.maxDepth) stats.maxDepth = depth;
        const entries = Object.entries(v as Record<string, unknown>);
        stats.properties += entries.length;
        for (const [, child] of entries) walk(child, depth + 1);
        return;
      }
      case "string":
        stats.strings++;
        return;
      case "number":
        stats.numbers++;
        return;
      case "boolean":
        stats.booleans++;
        return;
    }
  };

  walk(value, 1);
  return stats;
}

// ─── Single-pass scan: duplicate keys + unsafe integers ──────────────────────

export interface JsonKeyIssue {
  key: string;
  line: number;
  column: number;
}
export interface JsonBigIntIssue {
  value: string;
  line: number;
  column: number;
}
export interface JsonScan {
  duplicateKeys: JsonKeyIssue[];
  bigIntegers: JsonBigIntIssue[];
}

const MAX_SAFE = BigInt("9007199254740991");
const MIN_SAFE = BigInt("-9007199254740991");

function safeDecodeKey(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

/**
 * Scan **valid** JSON text for duplicate object keys and unsafe integers. Runs a
 * tiny tokenizer rather than JSON.parse because both signals are erased by parsing:
 * JSON.parse keeps only the last duplicate key, and coerces big integers to floats.
 */
export function scanJson(input: string): JsonScan {
  const duplicateKeys: JsonKeyIssue[] = [];
  const bigIntegers: JsonBigIntIssue[] = [];

  interface Scope {
    type: "object" | "array";
    keys?: Set<string>;
    expectKey?: boolean;
  }
  const stack: Scope[] = [];
  let line = 1;
  let column = 1;
  let i = 0;
  const n = input.length;

  const step = (ch: string) => {
    if (ch === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
    i++;
  };

  while (i < n) {
    const ch = input[i];

    if (ch === '"') {
      const startLine = line;
      const startCol = column;
      let raw = "";
      step(ch); // opening quote
      while (i < n) {
        const c = input[i];
        if (c === "\\") {
          raw += c;
          step(c);
          if (i < n) {
            raw += input[i];
            step(input[i]);
          }
          continue;
        }
        if (c === '"') {
          step(c); // closing quote
          break;
        }
        raw += c;
        step(c);
      }
      const top = stack[stack.length - 1];
      if (top && top.type === "object" && top.expectKey) {
        const key = safeDecodeKey(raw);
        if (top.keys!.has(key)) duplicateKeys.push({ key, line: startLine, column: startCol });
        else top.keys!.add(key);
        top.expectKey = false;
      }
      continue;
    }

    if (ch === "{") {
      stack.push({ type: "object", keys: new Set(), expectKey: true });
      step(ch);
      continue;
    }
    if (ch === "[") {
      stack.push({ type: "array" });
      step(ch);
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      step(ch);
      continue;
    }
    if (ch === ",") {
      const top = stack[stack.length - 1];
      if (top && top.type === "object") top.expectKey = true;
      step(ch);
      continue;
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const startLine = line;
      const startCol = column;
      let num = "";
      while (i < n && /[-+0-9.eE]/.test(input[i])) {
        num += input[i];
        step(input[i]);
      }
      if (/^-?\d+$/.test(num)) {
        try {
          const big = BigInt(num);
          if (big > MAX_SAFE || big < MIN_SAFE)
            bigIntegers.push({ value: num, line: startLine, column: startCol });
        } catch {
          /* not a plain integer — ignore */
        }
      }
      continue;
    }

    step(ch); // whitespace, ':', or a literal (true/false/null) char
  }

  return { duplicateKeys, bigIntegers };
}

// ─── Human-friendly error explanation ────────────────────────────────────────

/** Blank out string contents so heuristics don't trip on `//` or `,` inside a string. */
function stripStrings(input: string): string {
  return input.replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Turn a raw JSON parser message into a plain-English, actionable explanation.
 * Falls back to the (cleaned) engine message when no common cause is recognised.
 */
export function explainJsonError(input: string, rawMessage: string): string {
  const s = stripStrings(input);

  if (/\/\/|\/\*/.test(s))
    return "JSON does not allow comments. Remove the // line or /* block */ comments — if you need comments in config, use JSONC or JSON5 instead of JSON.";
  if (/,\s*[}\]]/.test(s))
    return "Trailing comma: JSON does not allow a comma after the last item in an object or array. Remove the comma that comes right before } or ].";
  if (/'/.test(s))
    return "Single quotes: JSON strings and keys must use double quotes (\"), never single quotes (').";
  if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(s))
    return 'Unquoted key: every object key in JSON must be wrapped in double quotes, e.g. "name": ….';
  if (/\b(NaN|Infinity|-Infinity|undefined)\b/.test(s))
    return 'JSON has no NaN, Infinity, or undefined. Use null, or a string like "Infinity", instead.';
  if (/\b(True|False|None)\b/.test(s))
    return "Python literals: JSON uses lowercase true / false and null — not True / False / None.";

  const cleaned = rawMessage.replace(/^JSON\.parse:\s*/i, "").replace(/\s+in JSON.*$/i, "");
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}. Check for a missing comma, quote, bracket, or brace near the highlighted position.`;
}

// ─── Search-match counting (for the tree view) ───────────────────────────────

/** Count object keys and scalar values whose text contains `query` (case-insensitive). */
export function countJsonMatches(value: unknown, query: string): number {
  const q = query.trim().toLowerCase();
  if (q === "") return 0;
  let count = 0;

  const scalarMatches = (v: unknown): boolean => {
    if (v === null) return "null".includes(q);
    if (typeof v === "string") return v.toLowerCase().includes(q);
    if (typeof v === "number" || typeof v === "boolean") return String(v).includes(q);
    return false;
  };

  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        if (k.toLowerCase().includes(q)) count++;
        walk(child);
      }
      return;
    }
    if (scalarMatches(v)) count++;
  };

  walk(value);
  return count;
}

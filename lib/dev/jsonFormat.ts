/**
 * JSON formatting engine — PLATFORM-003 (Developer category).
 *
 * Pure and deterministic: the same input and options always produce the same
 * output. Nothing here touches the network, the DOM, or storage — a JSON
 * formatter is a text→text transform, and keeping it that way is what lets the
 * whole tool run in the browser with nothing leaving the device.
 */

export type IndentStyle = "2" | "4" | "tab" | "minify";

export interface JsonFormatOptions {
  indent: IndentStyle;
  /** Sort object keys alphabetically (recursively). Off by default. */
  sortKeys?: boolean;
}

export interface JsonFormatSuccess {
  ok: true;
  output: string;
  /** Number of top-level-and-nested keys seen — a cheap "did it parse" signal. */
  bytes: number;
}

export interface JsonFormatFailure {
  ok: false;
  error: string;
  /** 1-based line and column of the parse error where derivable, else null. */
  line: number | null;
  column: number | null;
}

export type JsonFormatResult = JsonFormatSuccess | JsonFormatFailure;

function indentValue(indent: IndentStyle): string | number {
  switch (indent) {
    case "2":
      return 2;
    case "4":
      return 4;
    case "tab":
      return "\t";
    case "minify":
      return 0;
  }
}

/** Recursively sort object keys so formatting is canonical when sortKeys is on. */
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

/**
 * Derive 1-based line/column from the byte position in a "position N" parse
 * error. V8 and modern engines include it; when absent we return nulls rather
 * than guess.
 */
function locate(input: string, message: string): { line: number | null; column: number | null } {
  // Newer V8 embeds "(line L column C)" directly.
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };

  // Older V8 embeds "position N" — derive line/column from it.
  const m = /position (\d+)/i.exec(message);
  if (!m) return { line: null, column: null };
  const pos = Math.min(Number(m[1]), input.length);
  let line = 1;
  let column = 1;
  for (let i = 0; i < pos; i++) {
    if (input[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

export function formatJson(input: string, options: JsonFormatOptions): JsonFormatResult {
  if (input.trim() === "") {
    return { ok: false, error: "Input is empty.", line: null, column: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON.";
    const { line, column } = locate(input, message);
    return { ok: false, error: message, line, column };
  }
  const value = options.sortKeys ? sortDeep(parsed) : parsed;
  const output = JSON.stringify(value, null, indentValue(options.indent));
  return { ok: true, output, bytes: output.length };
}

/** True when the input parses as JSON — the "validate" surface. */
export function isValidJson(input: string): boolean {
  if (input.trim() === "") return false;
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

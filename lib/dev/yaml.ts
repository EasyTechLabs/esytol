/**
 * YAML parsing/serialising — DEVELOPER-001 (Part 4), extended in DEVELOPER-002.
 *
 * Isolated in its own module so js-yaml is only bundled by tools that actually
 * parse YAML — the JSON/Base64/URL tools stay lean.
 *
 * DEVELOPER-002 additions: parse errors now carry the line/column from the
 * YAMLException mark, and `parseYamlAll` handles multi-document streams (`---`).
 */

import { load, loadAll, dump, YAMLException } from "js-yaml";
import { type Validation, valid, error } from "./validation";
import type { ParseResult } from "./parse";

/** Pull the 1-based line/column out of a js-yaml error, when present. */
function yamlErrorLocation(e: unknown): { line?: number; column?: number; reason: string } {
  if (e instanceof YAMLException) {
    const mark = (e as YAMLException & { mark?: { line: number; column: number } }).mark;
    return {
      line: mark ? mark.line + 1 : undefined,
      column: mark ? mark.column + 1 : undefined,
      reason: e.reason || e.message,
    };
  }
  return { reason: e instanceof Error ? e.message : "Invalid YAML" };
}

export function parseYaml(input: string): ParseResult<unknown> {
  if (input.trim() === "") return { ok: false, value: null, validation: error("Empty input") };
  try {
    const value = load(input);
    return { ok: true, value: value ?? null, validation: valid("Valid YAML") };
  } catch (e) {
    const { line, column, reason } = yamlErrorLocation(e);
    return {
      ok: false,
      value: null,
      validation: { ...error("Invalid YAML", reason), line, column },
    };
  }
}

export interface YamlAllResult {
  ok: boolean;
  documents: unknown[];
  validation: Validation;
}

/**
 * Parse a possibly multi-document YAML stream (`---`-separated). Returns every
 * document; single-document input yields a one-element array.
 */
export function parseYamlAll(input: string): YamlAllResult {
  if (input.trim() === "") return { ok: false, documents: [], validation: error("Empty input") };
  try {
    const documents: unknown[] = [];
    loadAll(input, (doc) => documents.push(doc ?? null));
    return {
      ok: true,
      documents,
      validation: valid(
        documents.length > 1 ? `Valid YAML — ${documents.length} documents` : "Valid YAML"
      ),
    };
  } catch (e) {
    const { line, column, reason } = yamlErrorLocation(e);
    return {
      ok: false,
      documents: [],
      validation: { ...error("Invalid YAML", reason), line, column },
    };
  }
}

export interface ToYamlOptions {
  indent?: number;
  /** Keep object keys in insertion order (default) or sort them. */
  sortKeys?: boolean;
}

/** Serialise a JS value to YAML (e.g. converting parsed JSON → YAML). */
export function toYaml(
  value: unknown,
  options: ToYamlOptions = {}
): { ok: boolean; output: string; validation: Validation } {
  try {
    return {
      ok: true,
      output: dump(value, {
        indent: options.indent ?? 2,
        lineWidth: 120,
        sortKeys: options.sortKeys ?? false,
        noRefs: true, // never emit anchors/aliases — deterministic, self-contained output
      }),
      validation: valid("Serialised YAML"),
    };
  } catch (e) {
    return {
      ok: false,
      output: "",
      validation: error("Could not serialise", e instanceof Error ? e.message : undefined),
    };
  }
}

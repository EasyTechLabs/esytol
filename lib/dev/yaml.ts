/**
 * YAML parsing/serialising — DEVELOPER-001 (Part 4).
 *
 * Isolated in its own module so js-yaml is only bundled by tools that actually
 * parse YAML — the JSON/Base64/URL tools stay lean.
 */

import { load, dump } from "js-yaml";
import { type Validation, valid, error } from "./validation";
import type { ParseResult } from "./parse";

export function parseYaml(input: string): ParseResult<unknown> {
  if (input.trim() === "") return { ok: false, value: null, validation: error("Empty input") };
  try {
    const value = load(input);
    return { ok: true, value: value ?? null, validation: valid("Valid YAML") };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid YAML";
    return { ok: false, value: null, validation: error("Invalid YAML", msg) };
  }
}

/** Serialise a JS value to YAML (e.g. converting parsed JSON → YAML). */
export function toYaml(value: unknown): { ok: boolean; output: string; validation: Validation } {
  try {
    return {
      ok: true,
      output: dump(value, { indent: 2, lineWidth: 120 }),
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

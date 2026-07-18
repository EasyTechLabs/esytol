/**
 * Text case-conversion engine — PLATFORM-004 (Everyday).
 *
 * Pure and deterministic. Word-boundary detection handles spaces, punctuation,
 * and camelCase/PascalCase transitions so any input converts sensibly to any
 * target case.
 */

export type CaseName =
  | "UPPERCASE"
  | "lowercase"
  | "Title Case"
  | "Sentence case"
  | "camelCase"
  | "PascalCase"
  | "snake_case"
  | "kebab-case"
  | "CONSTANT_CASE"
  | "dot.case";

export const CASE_NAMES: CaseName[] = [
  "UPPERCASE",
  "lowercase",
  "Title Case",
  "Sentence case",
  "camelCase",
  "PascalCase",
  "snake_case",
  "kebab-case",
  "CONSTANT_CASE",
  "dot.case",
];

/** Split into lowercase word tokens, respecting camelCase and separators. */
export function tokenize(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // ACRONYMWord → ACRONYM Word
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

export function toCase(input: string, name: CaseName): string {
  if (input.trim() === "") return "";
  switch (name) {
    case "UPPERCASE":
      return input.toUpperCase();
    case "lowercase":
      return input.toLowerCase();
    case "Title Case":
      return input.replace(/\S+/g, (w) => cap(w.toLowerCase()));
    case "Sentence case":
      return input.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
    case "camelCase": {
      const t = tokenize(input);
      return t.map((w, i) => (i === 0 ? w : cap(w))).join("");
    }
    case "PascalCase":
      return tokenize(input).map(cap).join("");
    case "snake_case":
      return tokenize(input).join("_");
    case "kebab-case":
      return tokenize(input).join("-");
    case "CONSTANT_CASE":
      return tokenize(input).join("_").toUpperCase();
    case "dot.case":
      return tokenize(input).join(".");
  }
}

/** Every case at once — for a "convert to all" view. */
export function toAllCases(input: string): { name: CaseName; value: string }[] {
  return CASE_NAMES.map((name) => ({ name, value: toCase(input, name) }));
}

/**
 * Shared validation model — DEVELOPER-001 (Part 3).
 *
 * Every developer tool reports validation through this one shape, so the UI
 * renders "valid / warning / error / info" identically everywhere. Pure data —
 * the rendering lives in features/dev/ValidationStatus.
 */

export type ValidationLevel = "valid" | "warning" | "error" | "info";

export interface Validation {
  level: ValidationLevel;
  /** Short headline, e.g. "Valid JSON" or "Invalid Base64". */
  message: string;
  /** Optional detail, e.g. a parser message or a location hint. */
  detail?: string;
  /** 1-based line/column where derivable. */
  line?: number;
  column?: number;
}

export const valid = (message: string, detail?: string): Validation => ({
  level: "valid",
  message,
  detail,
});
export const warning = (message: string, detail?: string): Validation => ({
  level: "warning",
  message,
  detail,
});
export const error = (message: string, detail?: string): Validation => ({
  level: "error",
  message,
  detail,
});
export const info = (message: string, detail?: string): Validation => ({
  level: "info",
  message,
  detail,
});

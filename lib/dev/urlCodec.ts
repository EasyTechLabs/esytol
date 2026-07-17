/**
 * URL percent-encoding engine — PLATFORM-003 (Developer category).
 *
 * Pure, deterministic, browser-only. Two modes:
 * - "component" (default): encodeURIComponent — encodes reserved characters
 *   (& ? = / #), correct for query-parameter and path-segment values.
 * - "full": encodeURI — preserves URL structure, for encoding a whole URL.
 *
 * Decoding surfaces malformed sequences (a lone "%" or "%zz") as an error
 * rather than throwing into the UI.
 */

export type UrlMode = "component" | "full";

export interface UrlResult {
  ok: boolean;
  output: string;
  error?: string;
}

export function encodeUrl(text: string, mode: UrlMode = "component"): UrlResult {
  try {
    const output = mode === "full" ? encodeURI(text) : encodeURIComponent(text);
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Encoding failed." };
  }
}

export function decodeUrl(text: string, mode: UrlMode = "component"): UrlResult {
  if (text === "") return { ok: true, output: "" };
  try {
    const output = mode === "full" ? decodeURI(text) : decodeURIComponent(text);
    return { ok: true, output };
  } catch {
    return {
      ok: false,
      output: "",
      error: "Malformed percent-encoding (e.g. a lone '%' or an invalid '%zz' sequence).",
    };
  }
}

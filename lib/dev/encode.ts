/**
 * Shared encoding library — DEVELOPER-001 (Part 5).
 *
 * One home for every reversible text encoding a developer tool needs: Base64,
 * URL, Hex, Unicode escapes, and HTML entities. Base64 and URL reuse the
 * existing engines (lib/dev/base64, lib/dev/urlCodec) so there is exactly one
 * implementation each. All pure, deterministic, UTF-8 safe, browser-only.
 */

import { encodeBase64, decodeBase64 } from "./base64";
import { encodeUrl, decodeUrl } from "./urlCodec";

export interface CodecResult {
  ok: boolean;
  output: string;
  error?: string;
}

// ── Base64 / URL — re-exported so callers import one module ───────────────────
export { encodeBase64, decodeBase64, encodeUrl, decodeUrl };

// ── Hex ───────────────────────────────────────────────────────────────────────

/** Encode UTF-8 text to a lowercase hex string (optionally space-separated). */
export function encodeHex(text: string, spaced = false): CodecResult {
  const bytes = new TextEncoder().encode(text);
  const parts = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return { ok: true, output: spaced ? parts.join(" ") : parts.join("") };
}

/** Decode a hex string (with optional whitespace / 0x prefixes) back to UTF-8. */
export function decodeHex(hex: string): CodecResult {
  const cleaned = hex.replace(/0x/gi, "").replace(/\s+/g, "");
  if (cleaned === "") return { ok: false, output: "", error: "Input is empty." };
  if (cleaned.length % 2 !== 0)
    return { ok: false, output: "", error: "Hex string must have an even number of digits." };
  if (!/^[0-9a-fA-F]+$/.test(cleaned))
    return { ok: false, output: "", error: "Input contains non-hexadecimal characters." };
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return { ok: true, output: new TextDecoder().decode(bytes) };
}

// ── Unicode escapes (\uXXXX) ──────────────────────────────────────────────────

/** Escape every character to a \uXXXX sequence (astral chars become surrogate pairs). */
export function encodeUnicode(text: string): CodecResult {
  let out = "";
  for (const unit of text) {
    for (let i = 0; i < unit.length; i++) {
      out += "\\u" + unit.charCodeAt(i).toString(16).padStart(4, "0");
    }
  }
  return { ok: true, output: out };
}

/** Decode \uXXXX (and \xXX) escapes back to text. */
export function decodeUnicode(text: string): CodecResult {
  try {
    const output = text
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Decode failed." };
  }
}

// ── HTML entities ─────────────────────────────────────────────────────────────

const HTML_ENCODE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const HTML_DECODE: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Encode the five HTML-significant characters to named entities. */
export function encodeHtml(text: string): CodecResult {
  return { ok: true, output: text.replace(/[&<>"']/g, (c) => HTML_ENCODE[c]) };
}

/** Decode named and numeric (decimal/hex) HTML entities. */
export function decodeHtml(text: string): CodecResult {
  const output = text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => HTML_DECODE[m] ?? m);
  return { ok: true, output };
}

/**
 * Base64 engine — PLATFORM-003 (Developer category).
 *
 * Pure, deterministic, UTF-8 safe, and browser-only. `btoa`/`atob` operate on
 * Latin-1, so raw use corrupts any non-ASCII text; we round-trip through a
 * UTF-8 byte array so "₹", "é" and emoji survive. Chunked to support large
 * inputs without blowing the call stack.
 *
 * Base64 is encoding, not encryption — that fact is stated to users in the
 * tool's trust surface, never buried.
 */

const CHUNK = 0x8000; // 32 KB — safe for String.fromCharCode.apply across engines

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return binary;
}

export interface Base64Result {
  ok: boolean;
  output: string;
  error?: string;
}

/** Encode UTF-8 text to standard Base64. `urlSafe` swaps +/ for -_ and drops padding. */
export function encodeBase64(text: string, urlSafe = false): Base64Result {
  try {
    const bytes = new TextEncoder().encode(text);
    let b64 = btoa(bytesToBinary(bytes));
    if (urlSafe) b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return { ok: true, output: b64 };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Encoding failed." };
  }
}

/** Decode Base64 (standard or URL-safe) back to UTF-8 text. */
export function decodeBase64(b64: string): Base64Result {
  const trimmed = b64.trim();
  if (trimmed === "") return { ok: false, output: "", error: "Input is empty." };
  try {
    // Accept URL-safe input and restore padding.
    let normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4;
    if (pad === 2) normalized += "==";
    else if (pad === 3) normalized += "=";
    else if (pad === 1) return { ok: false, output: "", error: "Invalid Base64 length." };

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      return { ok: false, output: "", error: "Input contains non-Base64 characters." };
    }
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const output = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: "", error: e instanceof Error ? e.message : "Not valid Base64." };
  }
}

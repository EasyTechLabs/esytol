/**
 * Shared parsing library — DEVELOPER-001 (Part 4).
 *
 * Zero-dependency parsers that every developer tool can reuse: JSON, JWT, XML,
 * CSV, URL, Base64. Each returns a common { ok, value, validation } shape so
 * tools render results and validation identically. (YAML lives in lib/dev/yaml
 * so js-yaml is only bundled by tools that need it.)
 */

import { decodeBase64 } from "./base64";
import { type Validation, valid, error } from "./validation";

export interface ParseResult<T> {
  ok: boolean;
  value: T | null;
  validation: Validation;
}

// ── JSON ──────────────────────────────────────────────────────────────────────

export function parseJson(input: string): ParseResult<unknown> {
  if (input.trim() === "") return { ok: false, value: null, validation: error("Empty input") };
  try {
    return { ok: true, value: JSON.parse(input), validation: valid("Valid JSON") };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    return { ok: false, value: null, validation: error("Invalid JSON", message) };
  }
}

// ── JWT ───────────────────────────────────────────────────────────────────────

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  /** Raw segments, for signature verification. */
  raw: { header: string; payload: string; signature: string };
}

function base64UrlToJson(segment: string): Record<string, unknown> {
  const decoded = decodeBase64(segment);
  if (!decoded.ok) throw new Error("segment is not valid base64url");
  return JSON.parse(decoded.output);
}

export function parseJwt(input: string): ParseResult<JwtParts> {
  const token = input.trim();
  if (token === "") return { ok: false, value: null, validation: error("Empty input") };
  const segments = token.split(".");
  if (segments.length !== 3) {
    return {
      ok: false,
      value: null,
      validation: error(
        "Not a JWT",
        "A JWT has three dot-separated segments (header.payload.signature)."
      ),
    };
  }
  try {
    const header = base64UrlToJson(segments[0]);
    const payload = base64UrlToJson(segments[1]);
    const value: JwtParts = {
      header,
      payload,
      signature: segments[2],
      raw: { header: segments[0], payload: segments[1], signature: segments[2] },
    };
    return {
      ok: true,
      value,
      validation: valid("Decoded JWT", "Signature is not verified by decoding alone."),
    };
  } catch (e) {
    return {
      ok: false,
      value: null,
      validation: error(
        "Invalid JWT",
        e instanceof Error ? e.message : "Could not decode segments."
      ),
    };
  }
}

// ── URL ───────────────────────────────────────────────────────────────────────

export interface ParsedUrl {
  protocol: string;
  host: string;
  pathname: string;
  params: { key: string; value: string }[];
  hash: string;
}

export function parseUrl(input: string): ParseResult<ParsedUrl> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, value: null, validation: error("Empty input") };
  try {
    const u = new URL(trimmed);
    const value: ParsedUrl = {
      protocol: u.protocol.replace(/:$/, ""),
      host: u.host,
      pathname: u.pathname,
      params: Array.from(u.searchParams.entries()).map(([key, value]) => ({ key, value })),
      hash: u.hash.replace(/^#/, ""),
    };
    return { ok: true, value, validation: valid("Valid URL") };
  } catch {
    return {
      ok: false,
      value: null,
      validation: error("Invalid URL", "Must include a scheme, e.g. https://example.com/path?q=1"),
    };
  }
}

// ── Base64 ──────────────────────────────────────────────────────────────────

export function parseBase64(input: string): ParseResult<string> {
  const r = decodeBase64(input);
  return r.ok
    ? { ok: true, value: r.output, validation: valid("Valid Base64") }
    : { ok: false, value: null, validation: error("Invalid Base64", r.error) };
}

// ── CSV ───────────────────────────────────────────────────────────────────────

/** RFC 4180-ish CSV parser: handles quoted fields, escaped quotes, and newlines in quotes. */
export function parseCsv(input: string, delimiter = ","): ParseResult<string[][]> {
  if (input.trim() === "") return { ok: false, value: null, validation: error("Empty input") };
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return {
    ok: true,
    value: rows,
    validation: valid("Parsed CSV", `${rows.length} row${rows.length === 1 ? "" : "s"}`),
  };
}

// ── XML ───────────────────────────────────────────────────────────────────────

/** Validate XML well-formedness using DOMParser (browser + jsdom). Returns the doc. */
export function parseXml(input: string): ParseResult<Document> {
  if (input.trim() === "") return { ok: false, value: null, validation: error("Empty input") };
  if (typeof DOMParser === "undefined") {
    return {
      ok: false,
      value: null,
      validation: error("XML parsing unavailable in this environment"),
    };
  }
  const doc = new DOMParser().parseFromString(input, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    return {
      ok: false,
      value: null,
      validation: error("Invalid XML", parseError.textContent?.trim() || "Not well-formed."),
    };
  }
  return { ok: true, value: doc, validation: valid("Well-formed XML") };
}

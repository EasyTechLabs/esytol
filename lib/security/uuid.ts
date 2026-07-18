/**
 * UUID engine — the logic unique to the UUID Generator (TOOL-003).
 *
 * Implements RFC 4122 / RFC 9562: versions 1, 3, 4, 5, and 7, plus parsing,
 * validation, and version/variant/timestamp inspection.
 *
 * Design:
 *  - **Secure by construction.** Random bytes come from the Web Crypto API
 *    (crypto.getRandomValues) — never Math.random. v4 is equivalent to the native
 *    crypto.randomUUID(); we build it from getRandomValues so the same secure path,
 *    an injectable RNG (for tests), and consistent formatting cover every version.
 *  - **Privacy-safe v1.** A real time-based UUID embeds the host MAC address. RFC
 *    4122 §4.5 permits a *random* node ID with the multicast bit set instead, so this
 *    v1 never leaks hardware identity while staying spec-compliant.
 *  - **Reuse, not reinvention.** v3 (MD5) and v5 (SHA-1) hash the namespace+name with
 *    the shared, tested lib/dev/crypto — no hashing is reimplemented here.
 *  - **Pure & injectable.** Generators accept an optional RNG and clock, so tests are
 *    deterministic; production uses the secure defaults.
 */

import { hashBytes } from "@/lib/dev/crypto";

export type UuidVersion = 1 | 3 | 4 | 5 | 7;

/** A function returning `n` cryptographically secure random bytes. */
export type RandomBytes = (n: number) => Uint8Array;

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error("A secure random source (Web Crypto) is unavailable in this environment.");
  }
  return c;
}

export const secureRandomBytes: RandomBytes = (n) => {
  const b = new Uint8Array(n);
  getCrypto().getRandomValues(b);
  return b;
};

// ─── Predefined namespaces (RFC 4122 Appendix C) ─────────────────────────────

export const NAMESPACES = {
  DNS: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  URL: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  OID: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  X500: "6ba7b814-9dad-11d1-80b4-00c04fd430c8",
} as const;

export type NamespaceKey = keyof typeof NAMESPACES;

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";
export const MAX_UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

// 100-ns intervals between the Gregorian epoch (1582-10-15) and the Unix epoch.
// Written via the BigInt() constructor (not an `n` literal) to stay compatible with
// the project's compile target.
const GREGORIAN_OFFSET = BigInt("122192928000000000");
const B8 = BigInt(8);
const B32 = BigInt(32);
const B48 = BigInt(48);
const B_FF = BigInt(0xff);
const B_FFFF = BigInt(0xffff);
const B_FFF = BigInt(0xfff);
const B_U32 = BigInt(0xffffffff);
const B_10000 = BigInt(10000);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Byte helpers ────────────────────────────────────────────────────────────

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Stamp the version nibble and the RFC 4122 variant bits into a 16-byte buffer. */
function setBits(bytes: Uint8Array, version: number): Uint8Array {
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  return bytes;
}

// ─── Random versions: v4, v7 ─────────────────────────────────────────────────

/** Random UUID (equivalent to crypto.randomUUID()). */
export function uuidV4(rand: RandomBytes = secureRandomBytes): string {
  return bytesToUuid(setBits(rand(16), 4));
}

/** Time-ordered UUID: 48-bit Unix-ms timestamp prefix + random tail (RFC 9562). */
export function uuidV7(now: number = Date.now(), rand: RandomBytes = secureRandomBytes): string {
  const bytes = new Uint8Array(16);
  const ts = BigInt(Math.floor(now));
  for (let i = 0; i < 6; i++) bytes[5 - i] = Number((ts >> BigInt(8 * i)) & B_FF);
  bytes.set(rand(10), 6);
  return bytesToUuid(setBits(bytes, 7));
}

// ─── Time-based v1 (privacy-safe random node) ────────────────────────────────

export function uuidV1(now: number = Date.now(), rand: RandomBytes = secureRandomBytes): string {
  const ts = BigInt(Math.floor(now)) * B_10000 + GREGORIAN_OFFSET;
  const timeLow = Number(ts & B_U32);
  const timeMid = Number((ts >> B32) & B_FFFF);
  const timeHi = Number((ts >> B48) & B_FFF);

  const r = rand(8);
  const clockSeq = ((r[0] << 8) | r[1]) & 0x3fff;
  const node = r.slice(2, 8);
  node[0] = node[0] | 0x01; // multicast bit → random node, never a real MAC

  const h2 = (n: number) => n.toString(16).padStart(2, "0");
  const h4 = (n: number) => n.toString(16).padStart(4, "0");
  const timeHiAndVersion = 0x1000 | timeHi;
  const clockSeqHiVariant = 0x80 | (clockSeq >> 8);
  const clockSeqLow = clockSeq & 0xff;
  const nodeHex = Array.from(node, h2).join("");

  return `${(timeLow >>> 0).toString(16).padStart(8, "0")}-${h4(timeMid)}-${h4(
    timeHiAndVersion
  )}-${h2(clockSeqHiVariant)}${h2(clockSeqLow)}-${nodeHex}`;
}

// ─── Namespace versions: v3 (MD5), v5 (SHA-1) — reuse lib/dev/crypto ──────────

async function namespaceUuid(
  namespace: string,
  name: string,
  algorithm: "MD5" | "SHA-1",
  version: 3 | 5
): Promise<string> {
  const ns = uuidToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(ns.length + nameBytes.length);
  input.set(ns, 0);
  input.set(nameBytes, ns.length);
  const digest = hexToBytes(await hashBytes(input, algorithm)).slice(0, 16);
  return bytesToUuid(setBits(digest, version));
}

/** Name-based UUID using MD5 (deterministic for a given namespace + name). */
export function uuidV3(namespace: string, name: string): Promise<string> {
  return namespaceUuid(namespace, name, "MD5", 3);
}

/** Name-based UUID using SHA-1 (deterministic; preferred over v3). */
export function uuidV5(namespace: string, name: string): Promise<string> {
  return namespaceUuid(namespace, name, "SHA-1", 5);
}

/** Resolve a namespace key or a custom UUID string to a canonical namespace UUID. */
export function resolveNamespace(key: NamespaceKey | "custom", custom: string): string | null {
  if (key === "custom") return isValidUuid(custom) ? custom.trim().toLowerCase() : null;
  return NAMESPACES[key];
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export interface FormatOptions {
  uppercase: boolean;
  hyphens: boolean;
}

export function formatUuid(uuid: string, { uppercase, hyphens }: FormatOptions): string {
  let out = hyphens ? uuid : uuid.replace(/-/g, "");
  if (uppercase) out = out.toUpperCase();
  return out;
}

// ─── Validation & inspection ─────────────────────────────────────────────────

export function isValidUuid(raw: string): boolean {
  return UUID_RE.test(normalize(raw));
}

function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^urn:uuid:/i, "")
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .toLowerCase();
}

export interface VariantInfo {
  label: string;
  detail: string;
}

function variantInfo(nibble: number): VariantInfo {
  if (nibble < 0x8)
    return {
      label: "NCS (legacy)",
      detail: "Reserved for NCS backward compatibility (variant 0).",
    };
  if (nibble < 0xc)
    return {
      label: "RFC 4122 / RFC 9562",
      detail: "The standard variant used by virtually all modern UUIDs.",
    };
  if (nibble < 0xe)
    return { label: "Microsoft (legacy)", detail: "Reserved, Microsoft Corporation GUID variant." };
  return { label: "Reserved", detail: "Reserved for future definition." };
}

const VERSION_INFO: Record<number, string> = {
  1: "Version 1 — time-based. Encodes a timestamp, clock sequence, and node ID (this tool uses a privacy-safe random node, not a MAC address).",
  2: "Version 2 — DCE Security. Rare; embeds a POSIX UID/GID. Not generated here.",
  3: "Version 3 — name-based (MD5). Deterministic: the same namespace + name always yields the same UUID.",
  4: "Version 4 — random. 122 bits of cryptographically secure randomness. The most common UUID.",
  5: "Version 5 — name-based (SHA-1). Like v3 but uses SHA-1; preferred over v3 for new name-based UUIDs.",
  6: "Version 6 — reordered time-based (RFC 9562). Sortable variant of v1. Not generated here.",
  7: "Version 7 — time-ordered (RFC 9562). A Unix-millisecond timestamp prefix plus randomness, so UUIDs sort by creation time.",
  8: "Version 8 — custom/experimental (RFC 9562). Vendor-defined layout.",
};

export interface UuidInspection {
  valid: boolean;
  input: string;
  version: number | "nil" | "max" | null;
  versionInfo?: string;
  variant?: VariantInfo;
  timestamp?: Date;
  error?: string;
}

/** Reconstruct the timestamp embedded in a v1 or v7 UUID, or null if absent. */
export function extractTimestamp(uuid: string): Date | null {
  const norm = normalize(uuid);
  if (!UUID_RE.test(norm)) return null;
  const version = parseInt(norm[14], 16);
  const bytes = uuidToBytes(norm);
  if (version === 7) {
    let ms = BigInt(0);
    for (let i = 0; i < 6; i++) ms = (ms << B8) | BigInt(bytes[i]);
    return new Date(Number(ms));
  }
  if (version === 1) {
    const timeLow =
      BigInt(((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0) & B_U32;
    const timeMid = BigInt((bytes[4] << 8) | bytes[5]);
    const timeHi = BigInt(((bytes[6] & 0x0f) << 8) | bytes[7]);
    const ts = (timeHi << B48) | (timeMid << B32) | timeLow;
    const ms = (ts - GREGORIAN_OFFSET) / B_10000;
    return new Date(Number(ms));
  }
  return null;
}

export function inspectUuid(raw: string): UuidInspection {
  const norm = normalize(raw);
  if (raw.trim() === "") return { valid: false, input: raw, version: null, error: "Enter a UUID." };
  if (!UUID_RE.test(norm)) {
    return {
      valid: false,
      input: raw,
      version: null,
      error: "Not a valid UUID — expected 8-4-4-4-12 hexadecimal digits.",
    };
  }
  if (norm === NIL_UUID)
    return {
      valid: true,
      input: raw,
      version: "nil",
      versionInfo: "The Nil UUID — all bits zero. A special value meaning 'no UUID'.",
      variant: variantInfo(0),
    };
  if (norm === MAX_UUID)
    return {
      valid: true,
      input: raw,
      version: "max",
      versionInfo:
        "The Max UUID — all bits one (RFC 9562). A special value meaning 'the largest UUID'.",
      variant: variantInfo(0xf),
    };

  const version = parseInt(norm[14], 16);
  const variant = variantInfo(parseInt(norm[19], 16));
  const timestamp = extractTimestamp(norm) ?? undefined;
  return {
    valid: true,
    input: raw,
    version,
    versionInfo: VERSION_INFO[version] ?? `Version ${version} — unrecognised or reserved.`,
    variant,
    timestamp,
  };
}

/** Short human description of a version, for the generator's help text. */
export function versionInfo(version: UuidVersion): string {
  return VERSION_INFO[version];
}

/**
 * Shared cryptography — DEVELOPER-001 (Part 6).
 *
 * SHA-1/256/512 and HMAC use the Web Crypto API (SubtleCrypto), available in
 * browsers and Node. MD5 is not offered by Web Crypto, so a small pure
 * implementation is included (MD5 is for checksums/legacy only — never for
 * security; the trust surface says so). JWT verification is HMAC-SHA256 (HS256).
 *
 * All functions run entirely on the client — nothing is transmitted.
 */

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-512" | "MD5";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle)
    throw new Error("Web Crypto (SubtleCrypto) is unavailable in this environment.");
  return c.subtle;
}

/**
 * Hash raw bytes and return a lowercase hex digest. This is the primitive both the
 * string and file paths delegate to, so there is a single implementation per
 * algorithm (file checksums hash the raw bytes, never a decoded-text round trip).
 */
export async function hashBytes(bytes: Uint8Array, algorithm: HashAlgorithm): Promise<string> {
  if (algorithm === "MD5") return md5Bytes(bytes);
  const digest = await subtle().digest(algorithm, bytes as BufferSource);
  return toHex(digest);
}

/** Compute all supported digests of raw bytes at once (e.g. a file checksum set). */
export async function hashAllBytes(bytes: Uint8Array): Promise<Record<HashAlgorithm, string>> {
  const [md, s1, s256, s512] = await Promise.all([
    hashBytes(bytes, "MD5"),
    hashBytes(bytes, "SHA-1"),
    hashBytes(bytes, "SHA-256"),
    hashBytes(bytes, "SHA-512"),
  ]);
  return { MD5: md, "SHA-1": s1, "SHA-256": s256, "SHA-512": s512 };
}

/** Hash UTF-8 text and return a lowercase hex digest. */
export async function hash(text: string, algorithm: HashAlgorithm): Promise<string> {
  return hashBytes(new TextEncoder().encode(text), algorithm);
}

/** Compute all supported digests of a string at once. */
export async function hashAll(text: string): Promise<Record<HashAlgorithm, string>> {
  return hashAllBytes(new TextEncoder().encode(text));
}

/** HMAC of a message with a secret, hex-encoded. */
export async function hmac(
  message: string,
  secret: string,
  algorithm: "SHA-1" | "SHA-256" | "SHA-512" = "SHA-256"
): Promise<string> {
  const key = await subtle().importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"]
  );
  const sig = await subtle().sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

// ── JWT signature verification (HS256) ────────────────────────────────────────

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface JwtVerification {
  verified: boolean;
  reason: string;
}

/**
 * Verify an HS256 JWT signature against a secret. Only HS256 is supported
 * client-side without a key-management story; RS/ES verification is out of
 * scope for V1 and reported honestly rather than faked.
 */
export async function verifyJwtHs256(token: string, secret: string): Promise<JwtVerification> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { verified: false, reason: "Not a three-segment JWT." };
  let alg: string | undefined;
  try {
    const headerJson = atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"));
    alg = (JSON.parse(headerJson) as { alg?: string }).alg;
  } catch {
    return { verified: false, reason: "Header is not valid base64url JSON." };
  }
  if (alg !== "HS256") {
    return {
      verified: false,
      reason: `Algorithm is ${alg ?? "unknown"} — only HS256 can be verified here.`,
    };
  }
  const key = await subtle().importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await subtle().sign("HMAC", key, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const expected = base64UrlEncodeBytes(new Uint8Array(sig));
  return expected === parts[2]
    ? { verified: true, reason: "Signature matches (HS256)." }
    : { verified: false, reason: "Signature does not match the provided secret." };
}

// ── Pure MD5 (checksums/legacy only) ──────────────────────────────────────────
// Compact, well-known implementation (RFC 1321). Not for security use.

function md5Bytes(bytes: Uint8Array): string {
  return rhex(md5cycle(bytes));
}

function md5cycle(bytes: Uint8Array): [number, number, number, number] {
  const n = bytes.length;
  // Zero-fill the whole padded word array up front: unset holes read as
  // `undefined`, which would poison the arithmetic with NaN.
  const len = ((n + 8) >> 6) * 16 + 16;
  const words: number[] = new Array(len).fill(0);
  for (let i = 0; i < n; i++) words[i >> 2] |= bytes[i] << ((i % 4) << 3);
  words[n >> 2] |= 0x80 << ((n % 4) << 3);
  const bits = n * 8;
  words[len - 2] = bits & 0xffffffff;
  words[len - 1] = Math.floor(bits / 0x100000000);

  let a = 1732584193,
    b = -271733879,
    c = -1732584194,
    d = 271733878;

  for (let i = 0; i < len; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d];
    a = ff(a, b, c, d, words[i], 7, -680876936);
    d = ff(d, a, b, c, words[i + 1], 12, -389564586);
    c = ff(c, d, a, b, words[i + 2], 17, 606105819);
    b = ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4], 7, -176418897);
    d = ff(d, a, b, c, words[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, words[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = ff(a, b, c, d, words[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, words[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, words[i + 10], 17, -42063);
    b = ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, words[i + 13], 12, -40341101);
    c = ff(c, d, a, b, words[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, words[i + 15], 22, 1236535329);

    a = gg(a, b, c, d, words[i + 1], 5, -165796510);
    d = gg(d, a, b, c, words[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, words[i + 11], 14, 643717713);
    b = gg(b, c, d, a, words[i], 20, -373897302);
    a = gg(a, b, c, d, words[i + 5], 5, -701558691);
    d = gg(d, a, b, c, words[i + 10], 9, 38016083);
    c = gg(c, d, a, b, words[i + 15], 14, -660478335);
    b = gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = gg(a, b, c, d, words[i + 9], 5, 568446438);
    d = gg(d, a, b, c, words[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, words[i + 3], 14, -187363961);
    b = gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, words[i + 2], 9, -51403784);
    c = gg(c, d, a, b, words[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, words[i + 12], 20, -1926607734);

    a = hh(a, b, c, d, words[i + 5], 4, -378558);
    d = hh(d, a, b, c, words[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, words[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = hh(a, b, c, d, words[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, words[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, words[i + 7], 16, -155497632);
    b = hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13], 4, 681279174);
    d = hh(d, a, b, c, words[i], 11, -358537222);
    c = hh(c, d, a, b, words[i + 3], 16, -722521979);
    b = hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = hh(a, b, c, d, words[i + 9], 4, -640364487);
    d = hh(d, a, b, c, words[i + 12], 11, -421815835);
    c = hh(c, d, a, b, words[i + 15], 16, 530742520);
    b = hh(b, c, d, a, words[i + 2], 23, -995338651);

    a = ii(a, b, c, d, words[i], 6, -198630844);
    d = ii(d, a, b, c, words[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, words[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = ii(a, b, c, d, words[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, words[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, words[i + 10], 15, -1051523);
    b = ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, words[i + 15], 10, -30611744);
    c = ii(c, d, a, b, words[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4], 6, -145523070);
    d = ii(d, a, b, c, words[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, words[i + 2], 15, 718787259);
    b = ii(b, c, d, a, words[i + 9], 21, -343485551);

    a = add32(a, oa);
    b = add32(b, ob);
    c = add32(c, oc);
    d = add32(d, od);
  }
  return [a, b, c, d];
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}
function add32(a: number, b: number): number {
  return (a + b) & 0xffffffff;
}
function rhex(arr: number[]): string {
  const hexChars = "0123456789abcdef";
  let out = "";
  for (const n of arr) {
    for (let j = 0; j < 4; j++) {
      out += hexChars[(n >> (j * 8 + 4)) & 0x0f] + hexChars[(n >> (j * 8)) & 0x0f];
    }
  }
  return out;
}

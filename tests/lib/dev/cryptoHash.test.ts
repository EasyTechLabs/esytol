/**
 * Crypto hashing — byte/file path (TOOL-002 additions to lib/dev/crypto).
 *
 * Pins the digests to published test vectors (RFC 1321, FIPS 180-4, an HMAC-SHA256
 * vector) so the shared library the Hash Generator relies on cannot silently drift.
 * The string helpers are covered in devShared.test.ts; here we focus on the new
 * byte-oriented API that powers file checksums.
 */

import { describe, it, expect } from "vitest";
import { hashBytes, hashAllBytes, hash, hmac } from "@/lib/dev/crypto";

const enc = (s: string) => new TextEncoder().encode(s);

describe("hashBytes — published vectors", () => {
  it("hashes the empty input", async () => {
    const empty = new Uint8Array();
    expect(await hashBytes(empty, "MD5")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(await hashBytes(empty, "SHA-1")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(await hashBytes(empty, "SHA-256")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("matches the classic 'abc' vectors", async () => {
    expect(await hashBytes(enc("abc"), "MD5")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(await hashBytes(enc("abc"), "SHA-1")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(await hashBytes(enc("abc"), "SHA-256")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(await hashBytes(enc("abc"), "SHA-512")).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
        "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    );
  });

  it("byte and string paths agree (the string API delegates to bytes)", async () => {
    expect(await hashBytes(enc("hello world"), "SHA-256")).toBe(
      await hash("hello world", "SHA-256")
    );
  });

  it("hashAllBytes returns every digest, all lowercase hex", async () => {
    const all = await hashAllBytes(enc("abc"));
    for (const algo of ["MD5", "SHA-1", "SHA-256", "SHA-512"] as const) {
      expect(all[algo]).toMatch(/^[0-9a-f]+$/);
    }
    expect(all["SHA-256"]).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("produces avalanche — a one-char change flips most of the digest", async () => {
    const a = await hashBytes(enc("password"), "SHA-256");
    const b = await hashBytes(enc("passwora"), "SHA-256");
    expect(a).not.toBe(b);
  });
});

describe("hmac — published vector", () => {
  it("matches HMAC-SHA256(key='key', 'The quick brown fox jumps over the lazy dog')", async () => {
    const r = await hmac("The quick brown fox jumps over the lazy dog", "key", "SHA-256");
    expect(r).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("is deterministic and secret-sensitive", async () => {
    const a = await hmac("msg", "secret-a", "SHA-256");
    const b = await hmac("msg", "secret-b", "SHA-256");
    const a2 = await hmac("msg", "secret-a", "SHA-256");
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
  });
});

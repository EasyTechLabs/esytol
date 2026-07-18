/**
 * Shared developer-library tests — DEVELOPER-001.
 *
 * Encoding round-trips, parser correctness, and cryptography against published
 * vectors (RFC / jwt.io). These libraries are the platform infrastructure the
 * next 20 tools reuse, so they are pinned hard.
 */

import { describe, it, expect } from "vitest";
import {
  encodeHex,
  decodeHex,
  encodeUnicode,
  decodeUnicode,
  encodeHtml,
  decodeHtml,
} from "@/lib/dev/encode";
import { parseJson, parseJwt, parseUrl, parseCsv, parseXml, parseBase64 } from "@/lib/dev/parse";
import { parseYaml, toYaml } from "@/lib/dev/yaml";
import { hash, hashAll, hmac, verifyJwtHs256 } from "@/lib/dev/crypto";
import { measure, formatBytes, formatMs } from "@/lib/dev/metrics";

describe("encode — round-trips and vectors", () => {
  const samples = ["hello", "₹ & <b>é</b>", "日本語 😀", "line1\nline2"];

  it("hex round-trips", () => {
    for (const s of samples) expect(decodeHex(encodeHex(s).output).output).toBe(s);
  });
  it("hex known vector: 'Man' -> '4d616e'", () => {
    expect(encodeHex("Man").output).toBe("4d616e");
  });
  it("hex rejects odd-length and non-hex", () => {
    expect(decodeHex("abc").ok).toBe(false);
    expect(decodeHex("zz").ok).toBe(false);
  });
  it("unicode round-trips", () => {
    for (const s of samples) expect(decodeUnicode(encodeUnicode(s).output).output).toBe(s);
  });
  it("html encodes the five significant characters and decodes numeric entities", () => {
    expect(encodeHtml('<a href="x">&').output).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
    expect(decodeHtml("&lt;b&gt;&#39;&#x263A;").output).toBe("<b>'☺");
  });
});

describe("parse", () => {
  it("parseJson: valid and invalid", () => {
    expect(parseJson('{"a":1}').ok).toBe(true);
    const bad = parseJson("{a:1}");
    expect(bad.ok).toBe(false);
    expect(bad.validation.level).toBe("error");
  });

  it("parseJwt decodes header + payload, flags non-JWT", () => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const r = parseJwt(token);
    expect(r.ok).toBe(true);
    expect(r.value!.header.alg).toBe("HS256");
    expect(r.value!.payload.name).toBe("John Doe");
    expect(parseJwt("not.a").ok).toBe(false);
  });

  it("parseUrl extracts parts and params", () => {
    const r = parseUrl("https://x.com/a/b?q=1&lang=en#frag");
    expect(r.ok).toBe(true);
    expect(r.value!.protocol).toBe("https");
    expect(r.value!.params).toContainEqual({ key: "lang", value: "en" });
    expect(r.value!.hash).toBe("frag");
    expect(parseUrl("not a url").ok).toBe(false);
  });

  it("parseCsv handles quotes, escaped quotes and newlines in fields", () => {
    const r = parseCsv('a,b\n"x,y","he said ""hi"""');
    expect(r.ok).toBe(true);
    expect(r.value).toEqual([
      ["a", "b"],
      ["x,y", 'he said "hi"'],
    ]);
  });

  it("parseBase64 decodes and rejects garbage", () => {
    expect(parseBase64("TWFu").value).toBe("Man");
    expect(parseBase64("!!!!").ok).toBe(false);
  });

  it("parseXml validates well-formedness (jsdom DOMParser)", () => {
    expect(parseXml("<a><b>1</b></a>").ok).toBe(true);
    expect(parseXml("<a><b></a>").ok).toBe(false);
  });
});

describe("yaml", () => {
  it("parses YAML and round-trips through toYaml", () => {
    const r = parseYaml("name: Esytol\ntools:\n  - json\n  - base64");
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: "Esytol", tools: ["json", "base64"] });
    const back = toYaml(r.value);
    expect(back.ok).toBe(true);
    expect(parseYaml(back.output).value).toEqual(r.value);
  });
  it("flags invalid YAML", () => {
    expect(parseYaml("a:\n  - x\n - y").ok).toBe(false);
  });
});

describe("crypto — published vectors", () => {
  it("MD5", async () => {
    expect(await hash("", "MD5")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(await hash("abc", "MD5")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("SHA family", async () => {
    expect(await hash("abc", "SHA-1")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(await hash("abc", "SHA-256")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(await hash("abc", "SHA-512")).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    );
  });
  it("hashAll returns every digest", async () => {
    const all = await hashAll("abc");
    expect(all["SHA-256"]).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(all.MD5).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("HMAC-SHA256 known vector", async () => {
    // RFC-style vector: key="key", msg="The quick brown fox jumps over the lazy dog".
    expect(await hmac("The quick brown fox jumps over the lazy dog", "key")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
    );
  });
  it("verifies a real HS256 JWT and rejects a wrong secret", async () => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect((await verifyJwtHs256(token, "your-256-bit-secret")).verified).toBe(true);
    expect((await verifyJwtHs256(token, "wrong")).verified).toBe(false);
  });
  it("declines non-HS256 honestly rather than faking a result", async () => {
    const rs256 = "eyJhbGciOiJSUzI1NiJ9.eyJhIjoxfQ.sig";
    const v = await verifyJwtHs256(rs256, "secret");
    expect(v.verified).toBe(false);
    expect(v.reason).toMatch(/HS256/);
  });
});

describe("metrics", () => {
  it("counts characters, lines, and UTF-8 bytes", () => {
    const m = measure("a₹\nbc");
    expect(m.characters).toBe(5); // a ₹ \n b c
    expect(m.lines).toBe(2);
    expect(m.bytes).toBe(7); // ₹ = 3 UTF-8 bytes; a,\n,b,c = 1 each → 7
  });
  it("formats bytes and ms", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatMs(0.4)).toBe("<1 ms");
    expect(formatMs(42)).toBe("42 ms");
  });
});

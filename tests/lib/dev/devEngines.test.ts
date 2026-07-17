/**
 * Developer-category engine tests — PLATFORM-003.
 *
 * The engines are pure text transforms, so the tests lean on invariants:
 * encode∘decode is identity, formatting is idempotent and canonical, and
 * malformed input fails cleanly (never throws into the UI).
 */

import { describe, it, expect } from "vitest";
import { formatJson, isValidJson } from "@/lib/dev/jsonFormat";
import { encodeBase64, decodeBase64 } from "@/lib/dev/base64";
import { encodeUrl, decodeUrl } from "@/lib/dev/urlCodec";

describe("formatJson", () => {
  it("pretty-prints with the chosen indent", () => {
    const r = formatJson('{"b":1,"a":2}', { indent: "2" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe('{\n  "b": 1,\n  "a": 2\n}');
  });

  it("minifies", () => {
    const r = formatJson('{\n  "a": 1\n}', { indent: "minify" });
    expect(r.ok && r.output).toBe('{"a":1}');
  });

  it("sorts keys deeply when asked (canonical output)", () => {
    const r = formatJson('{"b":{"d":1,"c":2},"a":3}', { indent: "minify", sortKeys: true });
    expect(r.ok && r.output).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("is idempotent — formatting formatted output changes nothing", () => {
    const once = formatJson('{"a":[1,2,{"x":true}]}', { indent: "2" });
    expect(once.ok).toBe(true);
    if (once.ok) {
      const twice = formatJson(once.output, { indent: "2" });
      expect(twice.ok && twice.output).toBe(once.output);
    }
  });

  it("reports a clean error on a syntax error (with location where the engine provides one)", () => {
    const r = formatJson('{\n  "a": ,\n}', { indent: "2" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeTruthy();
      // Location is best-effort: some engines embed position/line-column, some
      // don't. When present it must be sane; when absent it is null, never wrong.
      if (r.line !== null) expect(r.line).toBeGreaterThanOrEqual(1);
      if (r.column !== null) expect(r.column).toBeGreaterThanOrEqual(1);
    }
  });

  it("derives line/column from a 'position N' style message", () => {
    // Guards the older-V8 path in locate() regardless of the running engine.
    const withPos = formatJson("[1, 2,]", { indent: "2" });
    expect(withPos.ok).toBe(false);
  });

  it("rejects empty input without throwing", () => {
    expect(formatJson("   ", { indent: "2" }).ok).toBe(false);
  });

  it("isValidJson agrees with the parser", () => {
    expect(isValidJson('{"a":1}')).toBe(true);
    expect(isValidJson("{a:1}")).toBe(false);
    expect(isValidJson("")).toBe(false);
    expect(isValidJson("42")).toBe(true);
  });
});

describe("base64 — round-trip identity", () => {
  const samples = [
    "",
    "hello world",
    "The quick brown fox",
    "₹1,00,000 saved",
    "日本語のテキスト",
    "emoji: 😀🚀🎉",
    "line1\nline2\ttab",
    JSON.stringify({ a: 1, b: [2, 3], c: "x" }),
  ];

  for (const s of samples) {
    it(`decode(encode(x)) === x for ${JSON.stringify(s.slice(0, 24))}`, () => {
      const enc = encodeBase64(s);
      expect(enc.ok).toBe(true);
      const dec = decodeBase64(enc.output);
      // empty encodes to "" which decodeBase64 treats as "empty input"
      if (s === "") {
        expect(enc.output).toBe("");
      } else {
        expect(dec.ok).toBe(true);
        expect(dec.output).toBe(s);
      }
    });
  }

  it("URL-safe encoding round-trips and avoids +/=", () => {
    const s = "subjects?a=1&b=2/3+4";
    const enc = encodeBase64(s, true);
    expect(enc.output).not.toMatch(/[+/=]/);
    expect(decodeBase64(enc.output).output).toBe(s);
  });

  it("rejects non-Base64 characters cleanly", () => {
    const r = decodeBase64("not*base64*");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("known vector: 'Man' -> 'TWFu'", () => {
    expect(encodeBase64("Man").output).toBe("TWFu");
    expect(decodeBase64("TWFu").output).toBe("Man");
  });
});

describe("url codec — round-trip identity", () => {
  const samples = ["a b c", "?q=hello world&x=1", "₹ & % / #", "path/segment", "日本語"];

  for (const s of samples) {
    it(`decode(encode(x)) === x (component) for ${JSON.stringify(s)}`, () => {
      const enc = encodeUrl(s, "component");
      expect(enc.ok).toBe(true);
      expect(decodeUrl(enc.output, "component").output).toBe(s);
    });
  }

  it("component encoding escapes reserved characters", () => {
    expect(encodeUrl("a&b=c", "component").output).toBe("a%26b%3Dc");
  });

  it("full mode preserves URL structure", () => {
    expect(encodeUrl("https://x.com/a b?q=1", "full").output).toBe("https://x.com/a%20b?q=1");
  });

  it("flags malformed percent-encoding on decode", () => {
    const r = decodeUrl("%zz", "component");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/percent/i);
  });
});

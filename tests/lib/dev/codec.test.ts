/**
 * Codec platform engine tests (PLATFORM-005).
 *
 * The registry drives the whole Encoding & Escape family, so a single round-trip loop over every
 * codec is the core guarantee: encode → decode returns the original for a demanding sample (ASCII,
 * punctuation, Unicode, whitespace). Per-codec tests then lock the exact output and error handling.
 */

import { describe, it, expect } from "vitest";
import { CODECS, getCodec, type CodecId } from "@/lib/dev/codec";
import { encodeBinary, decodeBinary, encodeBackslash, decodeBackslash } from "@/lib/dev/encode";

const ALL_IDS = Object.keys(CODECS) as CodecId[];

describe("codec registry — shared guarantees", () => {
  it("registers a complete, well-formed codec for every id", () => {
    for (const id of ALL_IDS) {
      const c = getCodec(id);
      expect(c.id).toBe(id);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.plainLabel.length).toBeGreaterThan(0);
      expect(c.encodedLabel.length).toBeGreaterThan(0);
      expect(typeof c.encode).toBe("function");
      expect(typeof c.decode).toBe("function");
    }
  });

  it("round-trips every codec (encode → decode returns the original)", () => {
    const samples = ["Hello, World!", "café ₹ 😀", 'a "b" <c> & \\d\n\te', "   spaced   "];
    for (const id of ALL_IDS) {
      const c = getCodec(id);
      for (const sample of samples) {
        const enc = c.encode(sample);
        expect(enc.ok, `${id} encode ${JSON.stringify(sample)}`).toBe(true);
        const dec = c.decode(enc.output);
        expect(dec.ok, `${id} decode ${JSON.stringify(sample)}`).toBe(true);
        expect(dec.output, `${id} round-trip ${JSON.stringify(sample)}`).toBe(sample);
      }
    }
  });

  it("each codec's declared sampleEncoded decodes to its samplePlain", () => {
    for (const id of ALL_IDS) {
      const c = getCodec(id);
      expect(c.decode(c.sampleEncoded).output, `${id} sample`).toBe(c.samplePlain);
      expect(c.encode(c.samplePlain).output, `${id} sample`).toBe(c.sampleEncoded);
    }
  });
});

describe("html codec", () => {
  it("escapes the significant characters", () => {
    expect(CODECS.html.encode(`<a> & "x" '`).output).toBe("&lt;a&gt; &amp; &quot;x&quot; &#39;");
  });
  it("decodes numeric entities", () => {
    expect(CODECS.html.decode("&#38;&#x26;").output).toBe("&&");
  });
});

describe("hex codec", () => {
  it("encodes UTF-8 bytes spaced", () => {
    expect(CODECS.hex.encode("Hi₹").output).toBe("48 69 e2 82 b9");
  });
  it("decodes continuous and 0x-prefixed hex", () => {
    expect(CODECS.hex.decode("4869").output).toBe("Hi");
    expect(CODECS.hex.decode("0x480x69").output).toBe("Hi");
  });
  it("rejects odd-length and non-hex input", () => {
    expect(CODECS.hex.decode("abc").ok).toBe(false);
    expect(CODECS.hex.decode("zz").ok).toBe(false);
  });
});

describe("binary codec", () => {
  it("encodes to 8-bit groups", () => {
    expect(encodeBinary("Hi!").output).toBe("01001000 01101001 00100001");
  });
  it("decodes spaced and continuous bits", () => {
    expect(decodeBinary("01001000 01101001").output).toBe("Hi");
    expect(decodeBinary("0100100001101001").output).toBe("Hi");
  });
  it("rejects non-binary and non-multiple-of-8", () => {
    expect(decodeBinary("0102").ok).toBe(false);
    expect(decodeBinary("0100100").ok).toBe(false);
  });
});

describe("unicode codec", () => {
  it("encodes astral characters as surrogate pairs", () => {
    expect(CODECS.unicode.encode("😀").output).toBe("\\ud83d\\ude00");
  });
  it("decodes \\xXX escapes too", () => {
    expect(CODECS.unicode.decode("\\x41\\u0042").output).toBe("AB");
  });
});

describe("backslash codec", () => {
  it("escapes control and quote characters", () => {
    expect(encodeBackslash('a\nb\tc"d\\e').output).toBe('a\\nb\\tc\\"d\\\\e');
  });
  it("unescapes known sequences and keeps unknown ones literal", () => {
    expect(decodeBackslash('a\\nb\\tc\\"d\\\\e').output).toBe('a\nb\tc"d\\e');
    expect(decodeBackslash("\\q").output).toBe("\\q"); // unknown escape preserved
  });
  it("interprets \\uXXXX and \\xXX on unescape", () => {
    expect(decodeBackslash("\\u0041\\x42").output).toBe("AB");
  });
});

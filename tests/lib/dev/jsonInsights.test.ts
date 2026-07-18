/**
 * JSON insight-engine tests.
 *
 * The format transform is tested in devEngines.test.ts; here we cover the analysis
 * layer: statistics, the duplicate-key + big-integer scanner (both erased by
 * JSON.parse), the human error explanations, and search-match counting — including
 * the tricky cases (unicode-escaped keys, strings that contain //, big ints).
 */

import { describe, it, expect } from "vitest";
import { analyzeJson, scanJson, explainJsonError, countJsonMatches } from "@/lib/dev/jsonInsights";

describe("analyzeJson", () => {
  it("counts value types and containers", () => {
    const v = JSON.parse('{"a":1,"b":"x","c":true,"d":null,"e":[1,2,{"f":3}]}');
    const s = analyzeJson(v);
    expect(s.objects).toBe(2); // root + {f:3}
    expect(s.arrays).toBe(1);
    expect(s.properties).toBe(6); // a,b,c,d,e + f
    expect(s.numbers).toBe(4); // 1,3,1,2
    expect(s.strings).toBe(1);
    expect(s.booleans).toBe(1);
    expect(s.nulls).toBe(1);
  });

  it("measures maximum nesting depth of containers", () => {
    expect(analyzeJson(JSON.parse('{"a":1}')).maxDepth).toBe(1);
    expect(analyzeJson(JSON.parse('{"a":{"b":{"c":1}}}')).maxDepth).toBe(3);
    expect(analyzeJson(JSON.parse("[[[1]]]")).maxDepth).toBe(3);
    expect(analyzeJson(JSON.parse("42")).maxDepth).toBe(0); // a scalar has no container
  });
});

describe("scanJson — duplicate keys", () => {
  it("finds a duplicate key with its location (JSON.parse would hide it)", () => {
    const { duplicateKeys } = scanJson('{\n  "a": 1,\n  "a": 2\n}');
    expect(duplicateKeys).toHaveLength(1);
    expect(duplicateKeys[0].key).toBe("a");
    expect(duplicateKeys[0].line).toBe(3);
  });

  it("does not flag the same key name in different objects", () => {
    expect(scanJson('{"a":{"x":1},"b":{"x":2}}').duplicateKeys).toHaveLength(0);
  });

  it("does not treat array strings or value strings as keys", () => {
    expect(scanJson('{"a":"a","list":["a","a","a"]}').duplicateKeys).toHaveLength(0);
  });

  it("compares decoded keys, catching unicode-escaped duplicates", () => {
    // "a" decodes to "a".
    const { duplicateKeys } = scanJson('{"a":1,"\\u0061":2}');
    expect(duplicateKeys).toHaveLength(1);
    expect(duplicateKeys[0].key).toBe("a");
  });

  it("is not fooled by braces or commas inside string values", () => {
    expect(scanJson('{"a":"{,}","b":"x, y"}').duplicateKeys).toHaveLength(0);
  });
});

describe("scanJson — unsafe integers", () => {
  it("flags integers beyond Number.MAX_SAFE_INTEGER", () => {
    const { bigIntegers } = scanJson('{"id": 9007199254740993}');
    expect(bigIntegers).toHaveLength(1);
    expect(bigIntegers[0].value).toBe("9007199254740993");
  });

  it("ignores safe integers, floats, and numbers inside strings", () => {
    expect(scanJson('{"a":123,"b":1.5,"c":"9999999999999999999"}').bigIntegers).toHaveLength(0);
  });
});

describe("explainJsonError", () => {
  const msg = "Unexpected token";
  it("explains a trailing comma", () => {
    expect(explainJsonError('{"a":1,}', msg)).toMatch(/trailing comma/i);
  });
  it("explains comments", () => {
    expect(explainJsonError('{"a":1} // note', msg)).toMatch(/comments/i);
  });
  it("explains single quotes", () => {
    expect(explainJsonError("{'a':1}", msg)).toMatch(/double quotes/i);
  });
  it("explains unquoted keys", () => {
    expect(explainJsonError("{a:1}", msg)).toMatch(/quoted|double quotes/i);
  });
  it("explains NaN/Infinity", () => {
    expect(explainJsonError('{"a":NaN}', msg)).toMatch(/NaN|Infinity/);
  });
  it("explains Python literals", () => {
    expect(explainJsonError('{"a":True}', msg)).toMatch(/true \/ false|python/i);
  });
  it("does not false-positive on // inside a string", () => {
    // A URL in a string with an otherwise-valid structure should fall through to the
    // generic message, not the comment explanation.
    expect(explainJsonError('{"url":"http://x"', msg)).not.toMatch(/comments/i);
  });
  it("falls back to a cleaned generic message", () => {
    expect(explainJsonError("{", "Unexpected end of JSON input")).toMatch(/missing/i);
  });
});

describe("countJsonMatches", () => {
  const v = JSON.parse('{"name":"Esytol","nickname":"esy","count":2,"nested":{"name":"x"}}');
  it("counts matching keys and values, case-insensitively", () => {
    expect(countJsonMatches(v, "name")).toBe(3); // name, nickname(key), name(nested)
    expect(countJsonMatches(v, "esy")).toBe(2); // "Esytol" value + "esy" value
    expect(countJsonMatches(v, "")).toBe(0);
  });
});

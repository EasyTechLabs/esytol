/**
 * JSON ↔ YAML conversion engine tests (DEVELOPER-002).
 *
 * The JSON and YAML primitives are tested elsewhere; here we test the conversion layer
 * and the YAML feature scanner: lossless round-trips, unicode, anchors/aliases/merge keys,
 * multi-document streams, and friendly errors with line/column.
 */

import { describe, it, expect } from "vitest";
import { jsonToYaml, yamlToJson, convert } from "@/lib/dev/jsonYaml";
import { scanYaml } from "@/lib/dev/yamlInsights";
import { parseYamlAll } from "@/lib/dev/yaml";

describe("jsonToYaml", () => {
  it("converts JSON to clean YAML", () => {
    const r = jsonToYaml('{"name":"Esytol","tags":["dev","yaml"]}');
    expect(r.ok).toBe(true);
    expect(r.output).toContain("name: Esytol");
    expect(r.output).toContain("- dev");
  });

  it("minifies vs indents are irrelevant to input; value round-trips JSON → YAML → JSON exactly", () => {
    const original = { a: 1, b: [true, null, "x"], c: { d: 3.5 }, e: "unicode ₹ é 😀" };
    const y = jsonToYaml(JSON.stringify(original));
    expect(y.ok).toBe(true);
    const back = yamlToJson(y.output);
    expect(back.ok).toBe(true);
    expect(JSON.parse(back.output)).toEqual(original);
  });

  it("reports invalid JSON with a friendly reason and location", () => {
    const r = jsonToYaml('{"a":1,}');
    expect(r.ok).toBe(false);
    expect(r.validation.message).toMatch(/invalid json/i);
    expect(r.validation.detail).toMatch(/trailing comma/i);
    expect(r.validation.line).toBeGreaterThanOrEqual(1);
  });

  it("returns the parsed value for stats/tree reuse", () => {
    const r = jsonToYaml('{"x":[1,2,3]}');
    expect(r.value).toEqual({ x: [1, 2, 3] });
  });
});

describe("yamlToJson", () => {
  it("converts YAML to JSON", () => {
    const r = yamlToJson("name: Esytol\ntags:\n  - dev\n  - yaml");
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.output)).toEqual({ name: "Esytol", tags: ["dev", "yaml"] });
  });

  it("round-trips YAML → JSON → YAML (resolved value preserved)", () => {
    const yaml = "a: 1\nb:\n  - x\n  - y\nc:\n  d: true";
    const j = yamlToJson(yaml);
    const y = jsonToYaml(j.output);
    expect(JSON.parse(yamlToJson(y.output).output)).toEqual({
      a: 1,
      b: ["x", "y"],
      c: { d: true },
    });
  });

  it("expands anchors and aliases to self-contained JSON", () => {
    const yaml = "default: &d\n  role: user\nalice:\n  <<: *d\n  name: Alice";
    const r = yamlToJson(yaml);
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.output)).toEqual({
      default: { role: "user" },
      alice: { role: "user", name: "Alice" },
    });
  });

  it("converts a multi-document stream to a JSON array", () => {
    const r = yamlToJson("---\na: 1\n---\nb: 2\n");
    expect(r.ok).toBe(true);
    expect(r.documentCount).toBe(2);
    expect(JSON.parse(r.output)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("reports invalid YAML with line/column", () => {
    const r = yamlToJson("a:\n  - x\n - y");
    expect(r.ok).toBe(false);
    expect(r.validation.message).toMatch(/invalid yaml/i);
    expect(r.validation.line).toBeGreaterThanOrEqual(1);
  });

  it("honours the JSON indent / minify option", () => {
    expect(yamlToJson("a: 1", { jsonIndent: "minify" }).output).toBe('{"a":1}');
    expect(yamlToJson("a: 1", { jsonIndent: "4" }).output).toContain('    "a": 1');
  });

  it("sorts keys when asked", () => {
    expect(yamlToJson("b: 2\na: 1", { sortKeys: true, jsonIndent: "minify" }).output).toBe(
      '{"a":1,"b":2}'
    );
  });

  it("reports a circular reference (recursive anchor) instead of crashing", () => {
    const r = yamlToJson("a: &x\n  self: *x\n");
    expect(r.ok).toBe(false);
    expect(r.validation.detail).toMatch(/circular reference/i);
  });

  it("treats a __proto__ key as data, never polluting the prototype", () => {
    const r = yamlToJson('{"__proto__":{"polluted":true},"safe":1}');
    expect(r.ok).toBe(true);
    // The global Object prototype is untouched.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // The key survives as ordinary data.
    expect(r.output).toContain("__proto__");
  });
});

describe("convert() dispatch", () => {
  it("routes by direction", () => {
    expect(convert('{"a":1}', "json2yaml").output).toContain("a: 1");
    expect(convert("a: 1", "yaml2json").output).toContain('"a": 1');
  });
});

describe("scanYaml — feature detection", () => {
  it("detects a multi-document stream", () => {
    const count = parseYamlAll("---\na: 1\n---\nb: 2\n").documents.length;
    const s = scanYaml("---\na: 1\n---\nb: 2\n", count);
    expect(s.multiDocument).toBe(true);
    expect(s.documentCount).toBe(2);
    expect(s.notes.some((n) => /multi-document/i.test(n.title))).toBe(true);
  });

  it("detects anchors, aliases, and merge keys", () => {
    const yaml = "default: &d\n  role: user\nalice:\n  <<: *d\n  name: Alice";
    const s = scanYaml(yaml);
    expect(s.anchors).toContain("d");
    expect(s.aliases).toContain("d");
    expect(s.mergeKeys).toBe(1);
    expect(s.notes.some((n) => /anchors & aliases/i.test(n.title))).toBe(true);
    expect(s.notes.some((n) => /merge keys/i.test(n.title))).toBe(true);
  });

  it("does not false-positive on & or # inside strings/comments", () => {
    const s = scanYaml('name: "a & b" # &notAnchor comment\nurl: "http://x"');
    expect(s.anchors).toHaveLength(0);
    expect(s.aliases).toHaveLength(0);
    expect(s.notes).toHaveLength(0);
  });

  it("flags custom tags as a warning but not standard scalar tags", () => {
    expect(scanYaml("v: !!str 123").notes.some((n) => n.severity === "warning")).toBe(false);
    expect(scanYaml("v: !mytag foo").notes.some((n) => /custom/i.test(n.title))).toBe(true);
  });
});

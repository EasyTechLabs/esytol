/**
 * CSV ↔ JSON engine tests (DEVELOPER-005).
 *
 * Covers delimiters (custom + auto-detect), quotes, escaped quotes, unicode, multiline fields,
 * large files, empty rows, missing/extra columns, nested JSON flattening, type inference,
 * CSV-injection safety, and the location-aware validation errors.
 */

import { describe, it, expect } from "vitest";
import {
  parseCsvRows,
  detectDelimiter,
  inferCellValue,
  csvToJson,
  jsonToCsv,
  convertCsvJson,
} from "@/lib/dev/csv";

describe("parseCsvRows — RFC 4180", () => {
  it("parses simple rows", () => {
    expect(parseCsvRows("a,b,c\n1,2,3").rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles a custom delimiter", () => {
    expect(parseCsvRows("a;b;c", ";").rows).toEqual([["a", "b", "c"]]);
  });

  it("handles quoted fields with a delimiter and newline inside", () => {
    const r = parseCsvRows('"a,b","line1\nline2",c');
    expect(r.rows).toEqual([["a,b", "line1\nline2", "c"]]);
  });

  it("handles escaped quotes (doubled)", () => {
    expect(parseCsvRows('"say ""hi""",x').rows).toEqual([['say "hi"', "x"]]);
  });

  it("keeps empty values", () => {
    expect(parseCsvRows("a,,c").rows).toEqual([["a", "", "c"]]);
    expect(parseCsvRows("a,b,").rows).toEqual([["a", "b", ""]]);
  });

  it("handles CRLF line endings and no trailing newline", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n").rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles unicode", () => {
    expect(parseCsvRows("₹,é,😀").rows).toEqual([["₹", "é", "😀"]]);
  });

  it("reports an unterminated quote with a location", () => {
    const r = parseCsvRows('a,"unterminated\n,b');
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/never closed/i);
    expect(r.error?.line).toBe(1);
    expect(r.error?.column).toBe(3);
  });

  it("reports text after a closing quote (invalid quoting)", () => {
    const r = parseCsvRows('"ok"x,b');
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/after a closing quote/i);
  });
});

describe("detectDelimiter", () => {
  it("detects comma, semicolon, tab, and pipe", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a|b|c\n1|2|3")).toBe("|");
  });

  it("prefers the consistent delimiter over an incidental one", () => {
    // Commas appear in a value but the real separator is the semicolon on every line.
    expect(detectDelimiter('a;b;c\n"x,y";2;3')).toBe(";");
  });
});

describe("inferCellValue", () => {
  it("infers booleans, null, and numbers but keeps risky strings", () => {
    expect(inferCellValue("true")).toBe(true);
    expect(inferCellValue("false")).toBe(false);
    expect(inferCellValue("null")).toBe(null);
    expect(inferCellValue("42")).toBe(42);
    expect(inferCellValue("-3.14")).toBe(-3.14);
    expect(inferCellValue("")).toBe("");
    expect(inferCellValue("007")).toBe("007"); // leading zero → string
    expect(inferCellValue("hello")).toBe("hello");
    expect(inferCellValue("12345678901234567890")).toBe("12345678901234567890"); // beyond safe int
  });
});

describe("csvToJson", () => {
  it("converts with header detection", () => {
    const r = csvToJson("name,age\nAlice,30\nBob,25");
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.output)).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("infers types when asked", () => {
    const r = csvToJson("name,age,active\nAlice,30,true", { inferTypes: true });
    expect(JSON.parse(r.output)).toEqual([{ name: "Alice", age: 30, active: true }]);
  });

  it("auto-detects the delimiter", () => {
    const r = csvToJson("a;b\n1;2");
    expect(r.delimiter).toBe(";");
    expect(JSON.parse(r.output)).toEqual([{ a: "1", b: "2" }]);
  });

  it("skips blank lines", () => {
    const r = csvToJson("a,b\n1,2\n\n3,4\n");
    expect(JSON.parse(r.output)).toHaveLength(2);
  });

  it("fills missing columns and warns about ragged rows", () => {
    const r = csvToJson("a,b,c\n1,2");
    expect(JSON.parse(r.output)).toEqual([{ a: "1", b: "2", c: "" }]);
    expect(r.warnings.some((w) => /different column count/i.test(w.title))).toBe(true);
  });

  it("renames duplicate header columns", () => {
    const r = csvToJson("id,id\n1,2");
    expect(JSON.parse(r.output)).toEqual([{ id: "1", id_2: "2" }]);
    expect(r.warnings.some((w) => /duplicate column/i.test(w.title))).toBe(true);
  });

  it("uses column_N names when there is no header", () => {
    const r = csvToJson("1,2,3", { hasHeader: false });
    expect(JSON.parse(r.output)).toEqual([{ column_1: "1", column_2: "2", column_3: "3" }]);
  });

  it("does not pollute the prototype via a __proto__ column", () => {
    const r = csvToJson("__proto__\nx");
    const arr = JSON.parse(r.output);
    expect(arr[0].__proto__).toBe("x");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("reports invalid CSV with a location", () => {
    const r = csvToJson('a,b\n"oops');
    expect(r.ok).toBe(false);
    expect(r.validation.level).toBe("error");
    expect(r.validation.line).toBe(2);
  });
});

describe("jsonToCsv", () => {
  it("converts an array of objects", () => {
    const r = jsonToCsv('[{"name":"Alice","age":30},{"name":"Bob","age":25}]');
    expect(r.ok).toBe(true);
    expect(r.output).toBe("name,age\r\nAlice,30\r\nBob,25");
  });

  it("flattens nested objects with dot notation", () => {
    const r = jsonToCsv('[{"user":{"id":1,"name":"A"}}]');
    expect(r.output).toBe("user.id,user.name\r\n1,A");
  });

  it("keeps stable column order and fills missing fields", () => {
    const r = jsonToCsv('[{"a":1,"b":2},{"a":3,"c":4}]');
    expect(r.output).toBe("a,b,c\r\n1,2,\r\n3,,4");
  });

  it("quotes fields containing the delimiter, quotes, or newlines", () => {
    const r = jsonToCsv('[{"note":"a,b","q":"say \\"hi\\""}]');
    expect(r.output).toBe('note,q\r\n"a,b","say ""hi"""');
  });

  it("serialises arrays as JSON in a cell", () => {
    const r = jsonToCsv('[{"tags":["x","y"]}]');
    expect(r.output).toBe('tags\r\n"[""x"",""y""]"');
  });

  it("neutralises CSV-injection cells by default", () => {
    const r = jsonToCsv('[{"formula":"=1+1"},{"formula":"safe"}]');
    expect(r.output).toBe("formula\r\n'=1+1\r\nsafe");
    expect(r.warnings.some((w) => /formula injection/i.test(w.title))).toBe(true);
  });

  it("keeps the raw formula when protection is off", () => {
    const r = jsonToCsv('[{"formula":"=1+1"}]', { sanitizeInjection: false });
    expect(r.output).toBe("formula\r\n=1+1");
  });

  it("reports invalid JSON with a friendly message", () => {
    const r = jsonToCsv('[{"a":1,}]');
    expect(r.ok).toBe(false);
    expect(r.validation.detail).toMatch(/trailing comma/i);
  });

  it("wraps a single object into one row", () => {
    expect(jsonToCsv('{"a":1,"b":2}').output).toBe("a,b\r\n1,2");
  });

  it("produces no columns for a top-level empty object", () => {
    const r = jsonToCsv("[{}]");
    expect(r.ok).toBe(true);
    expect(r.table?.header).toEqual([]);
  });
});

describe("statistics & round-trip", () => {
  it("computes CSV statistics", () => {
    const r = csvToJson("a,b,c\n1,,3\nlongervalue,2,3");
    expect(r.stats).toMatchObject({ rows: 2, columns: 3, emptyCells: 1 });
    expect(r.stats!.maxWidth).toBe(11); // "longervalue"
  });

  it("round-trips CSV → JSON → CSV for well-formed data", () => {
    const csv = "name,age\r\nAlice,30\r\nBob,25";
    const json = csvToJson(csv).output;
    const back = jsonToCsv(json).output;
    expect(back).toBe(csv);
  });

  it("handles a large document", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => `${i},row${i}`).join("\n");
    const r = csvToJson("id,label\n" + rows, { inferTypes: true });
    expect(r.ok).toBe(true);
    expect(JSON.parse(r.output)).toHaveLength(5000);
    expect(r.stats!.rows).toBe(5000);
  });
});

describe("convertCsvJson — dispatch", () => {
  it("routes to the requested direction", () => {
    expect(convertCsvJson("a\n1", "csv2json").ok).toBe(true);
    expect(convertCsvJson('[{"a":1}]', "json2csv").ok).toBe(true);
  });
});

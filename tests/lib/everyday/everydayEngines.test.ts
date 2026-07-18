/**
 * Everyday engine tests — PLATFORM-004.
 *
 * textStats and textCase are pure text transforms, pinned on determinism and
 * the boundary cases (empty input, camelCase splitting, multibyte counts).
 */

import { describe, it, expect } from "vitest";
import { textStats } from "@/lib/everyday/textStats";
import { toCase, toAllCases, tokenize, CASE_NAMES } from "@/lib/everyday/textCase";

describe("textStats", () => {
  it("counts words, characters, sentences, paragraphs, lines", () => {
    const s = textStats("Hello world. How are you?\n\nSecond paragraph here.");
    expect(s.words).toBe(8);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(s.lines).toBe(3);
  });

  it("counts characters with and without spaces, and UTF-8 bytes", () => {
    const s = textStats("a ₹ b");
    expect(s.characters).toBe(5); // a, space, ₹, space, b
    expect(s.charactersNoSpaces).toBe(3);
    expect(s.bytes).toBe(7); // ₹ = 3 bytes, others 1 each
  });

  it("is all-zero for empty input", () => {
    const s = textStats("   ");
    expect(s.words).toBe(0);
    expect(s.sentences).toBe(0);
    expect(s.paragraphs).toBe(0);
    expect(s.readingMinutes).toBe(0);
  });

  it("estimates reading time at 200 wpm (rounded up)", () => {
    const s = textStats("word ".repeat(250).trim());
    expect(s.words).toBe(250);
    expect(s.readingMinutes).toBe(2); // ceil(250/200)
  });

  it("is deterministic", () => {
    const t = "The quick brown fox. Jumps!";
    expect(textStats(t)).toEqual(textStats(t));
  });
});

describe("textCase", () => {
  it("converts simple cases", () => {
    expect(toCase("Hello World", "UPPERCASE")).toBe("HELLO WORLD");
    expect(toCase("Hello World", "lowercase")).toBe("hello world");
    expect(toCase("hello world", "Title Case")).toBe("Hello World");
    expect(toCase("hello world. bye now", "Sentence case")).toBe("Hello world. Bye now");
  });

  it("converts programmer cases from spaced input", () => {
    expect(toCase("user first name", "camelCase")).toBe("userFirstName");
    expect(toCase("user first name", "PascalCase")).toBe("UserFirstName");
    expect(toCase("user first name", "snake_case")).toBe("user_first_name");
    expect(toCase("user first name", "kebab-case")).toBe("user-first-name");
    expect(toCase("user first name", "CONSTANT_CASE")).toBe("USER_FIRST_NAME");
    expect(toCase("user first name", "dot.case")).toBe("user.first.name");
  });

  it("tokenizes camelCase and mixed input", () => {
    expect(tokenize("myVariableName")).toEqual(["my", "variable", "name"]);
    expect(tokenize("user_first-name")).toEqual(["user", "first", "name"]);
    expect(tokenize("HTTPResponse")).toEqual(["http", "response"]);
  });

  it("round-trips through tokenization (camel in → snake → kebab)", () => {
    expect(toCase("myVariableName", "snake_case")).toBe("my_variable_name");
    expect(toCase("myVariableName", "kebab-case")).toBe("my-variable-name");
  });

  it("returns empty string for empty input and covers every case name", () => {
    for (const name of CASE_NAMES) expect(toCase("   ", name)).toBe("");
    expect(toAllCases("hi there")).toHaveLength(CASE_NAMES.length);
  });

  it("is deterministic", () => {
    expect(toAllCases("The Quick Brown Fox")).toEqual(toAllCases("The Quick Brown Fox"));
  });
});

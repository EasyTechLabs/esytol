/**
 * Password engine tests.
 *
 * Output is random by design, so the tests assert invariants and structure rather
 * than exact strings: correct length, pool membership, the guarantees the options
 * promise (require-each, exclude-ambiguous), honest entropy math, and clean failure
 * on invalid configs. Randomness quality (unbiased, in-range) is checked
 * statistically. A deterministic injected RNG pins down the structural cases.
 */

import { describe, it, expect } from "vitest";
import {
  CHAR_SETS,
  AMBIGUOUS_CHARS,
  secureRandomInt,
  generatePassword,
  generatePassphrase,
  strengthFromEntropy,
  crackTimeText,
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  type PasswordOptions,
  type RandomInt,
} from "@/lib/security/password";
import { PASSPHRASE_WORDS } from "@/lib/security/wordlist";

const ALL = CHAR_SETS.lowercase + CHAR_SETS.uppercase + CHAR_SETS.numbers + CHAR_SETS.symbols;

describe("secureRandomInt", () => {
  it("always returns a value in [0, max)", () => {
    for (let i = 0; i < 2000; i++) {
      const v = secureRandomInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("returns 0 for max = 1", () => {
    expect(secureRandomInt(1)).toBe(0);
  });

  it("throws on non-positive max", () => {
    expect(() => secureRandomInt(0)).toThrow();
    expect(() => secureRandomInt(-3)).toThrow();
  });

  it("is roughly uniform across buckets (no gross bias)", () => {
    const buckets = new Array(6).fill(0);
    const n = 60000;
    for (let i = 0; i < n; i++) buckets[secureRandomInt(6)]++;
    const expected = n / 6;
    for (const b of buckets) {
      // Each bucket within 10% of the expected share — loose, just catches bias bugs.
      expect(Math.abs(b - expected) / expected).toBeLessThan(0.1);
    }
  });
});

describe("generatePassword", () => {
  it("produces a password of the requested length", () => {
    for (const length of [4, 8, 16, 32, 64, 128]) {
      const r = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toHaveLength(length);
    }
  });

  it("only uses characters from the selected pools", () => {
    const r = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) for (const ch of r.value) expect(ALL).toContain(ch);
  });

  it("respects a single selected set", () => {
    const r = generatePassword({
      length: 40,
      lowercase: false,
      uppercase: false,
      numbers: true,
      symbols: false,
      excludeAmbiguous: false,
      requireEachSet: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(/^[0-9]+$/.test(r.value)).toBe(true);
  });

  it("excludes ambiguous characters when asked", () => {
    const r = generatePassword({
      ...DEFAULT_PASSWORD_OPTIONS,
      length: 120,
      excludeAmbiguous: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) for (const ch of AMBIGUOUS_CHARS) expect(r.value).not.toContain(ch);
  });

  it("guarantees at least one of every selected set when requireEachSet is on", () => {
    for (let i = 0; i < 200; i++) {
      const r = generatePassword({
        length: 4,
        lowercase: true,
        uppercase: true,
        numbers: true,
        symbols: true,
        excludeAmbiguous: false,
        requireEachSet: true,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect([...r.value].some((c) => CHAR_SETS.lowercase.includes(c))).toBe(true);
        expect([...r.value].some((c) => CHAR_SETS.uppercase.includes(c))).toBe(true);
        expect([...r.value].some((c) => CHAR_SETS.numbers.includes(c))).toBe(true);
        expect([...r.value].some((c) => CHAR_SETS.symbols.includes(c))).toBe(true);
      }
    }
  });

  it("errors when no character type is selected", () => {
    const r = generatePassword({
      length: 16,
      lowercase: false,
      uppercase: false,
      numbers: false,
      symbols: false,
      excludeAmbiguous: false,
      requireEachSet: false,
    });
    expect(r.ok).toBe(false);
  });

  it("errors when require-each cannot fit in the length", () => {
    const r = generatePassword({
      length: 3, // below MIN anyway, but also < 4 sets
      lowercase: true,
      uppercase: true,
      numbers: true,
      symbols: true,
      excludeAmbiguous: false,
      requireEachSet: true,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range lengths", () => {
    expect(
      generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: MIN_PASSWORD_LENGTH - 1 }).ok
    ).toBe(false);
    expect(
      generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: MAX_PASSWORD_LENGTH + 1 }).ok
    ).toBe(false);
  });

  it("reports entropy as length × log2(poolSize)", () => {
    const opts: PasswordOptions = {
      length: 20,
      lowercase: true,
      uppercase: true,
      numbers: true,
      symbols: false,
      excludeAmbiguous: false,
      requireEachSet: false,
    };
    const r = generatePassword(opts);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const expectedPool = 26 + 26 + 10;
      expect(r.poolSize).toBe(expectedPool);
      expect(r.entropyBits).toBeCloseTo(20 * Math.log2(expectedPool), 6);
    }
  });

  it("is deterministic under an injected RNG (structure is reproducible)", () => {
    const rng: RandomInt = () => 0; // always pick index 0
    const a = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, requireEachSet: false }, rng);
    const b = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, requireEachSet: false }, rng);
    expect(a.ok && b.ok && a.value).toBe(b.ok && b.value);
  });
});

describe("generatePassphrase", () => {
  it("produces the requested number of words from the list", () => {
    const r = generatePassphrase({ ...DEFAULT_PASSPHRASE_OPTIONS, words: 6, separator: "-" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parts = r.value.split("-");
      expect(parts).toHaveLength(6);
      for (const p of parts) expect(PASSPHRASE_WORDS).toContain(p.toLowerCase());
    }
  });

  it("capitalises each word when asked", () => {
    const r = generatePassphrase({
      words: 4,
      separator: "-",
      capitalize: true,
      addNumber: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) for (const p of r.value.split("-")) expect(p[0]).toBe(p[0].toUpperCase());
  });

  it("appends a two-digit number when asked", () => {
    const r = generatePassphrase({ words: 4, separator: "-", capitalize: false, addNumber: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const parts = r.value.split("-");
      expect(parts).toHaveLength(5);
      expect(/^\d{2}$/.test(parts[4])).toBe(true);
    }
  });

  it("supports an empty separator", () => {
    const r = generatePassphrase({ words: 3, separator: "", capitalize: true, addNumber: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).not.toContain("-");
  });

  it("reports entropy as words × log2(listSize)", () => {
    const r = generatePassphrase({ words: 5, separator: "-", capitalize: true, addNumber: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.listSize).toBe(PASSPHRASE_WORDS.length);
      expect(r.entropyBits).toBeCloseTo(5 * Math.log2(PASSPHRASE_WORDS.length), 6);
    }
  });

  it("rejects out-of-range word counts", () => {
    expect(generatePassphrase({ ...DEFAULT_PASSPHRASE_OPTIONS, words: 2 }).ok).toBe(false);
    expect(generatePassphrase({ ...DEFAULT_PASSPHRASE_OPTIONS, words: 13 }).ok).toBe(false);
  });
});

describe("wordlist quality", () => {
  it("has no duplicate words", () => {
    expect(new Set(PASSPHRASE_WORDS).size).toBe(PASSPHRASE_WORDS.length);
  });

  it("is a power of two for clean per-word entropy", () => {
    const n = PASSPHRASE_WORDS.length;
    expect(Math.log2(n) % 1).toBe(0);
  });
});

describe("strengthFromEntropy", () => {
  it("maps bits to the expected five bands", () => {
    expect(strengthFromEntropy(20).label).toBe("Very weak");
    expect(strengthFromEntropy(30).label).toBe("Weak");
    expect(strengthFromEntropy(50).label).toBe("Fair");
    expect(strengthFromEntropy(90).label).toBe("Strong");
    expect(strengthFromEntropy(140).label).toBe("Very strong");
  });

  it("increases monotonically in score", () => {
    let last = -1;
    for (const bits of [10, 28, 36, 60, 128, 200]) {
      const s = strengthFromEntropy(bits).score;
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});

describe("crackTimeText", () => {
  it("is instant for tiny keyspaces", () => {
    expect(crackTimeText(10)).toBe("instantly");
  });

  it("is astronomically long for strong entropy", () => {
    expect(crackTimeText(256)).toBe("longer than the age of the universe");
  });

  it("produces a human bucket for a mid-range secret", () => {
    // 60 bits at 1e11/s ≈ 2^59 / 1e11 ≈ 5.7e6 s ≈ a couple of months → not instant, not eternal.
    const text = crackTimeText(60);
    expect(text).not.toBe("instantly");
    expect(text).not.toBe("longer than the age of the universe");
  });
});

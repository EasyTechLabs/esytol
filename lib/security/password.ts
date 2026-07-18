/**
 * Password & passphrase engine — the only logic unique to the Password Generator.
 *
 * Design principles:
 *  - **Cryptographically secure.** Randomness comes from the Web Crypto API
 *    (`crypto.getRandomValues`), never `Math.random`. Selection uses rejection
 *    sampling so there is no modulo bias — every character/word is equally likely.
 *  - **Pure and injectable.** Every generator takes an optional `randomInt` so tests
 *    can drive it deterministically; production uses the secure default.
 *  - **Honest strength.** Entropy is computed from the actual pool/word-list size,
 *    and the crack-time estimate states its attacker assumption rather than inventing
 *    a reassuring number.
 *  - **Never throws into the UI.** Invalid configurations return a typed error.
 */

import { PASSPHRASE_WORDS } from "./wordlist";

// ─── Character sets ──────────────────────────────────────────────────────────

export const CHAR_SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
} as const;

export type CharSetKey = keyof typeof CHAR_SETS;

/** Look-alike characters removed when "exclude ambiguous" is on (e.g. l vs 1 vs I). */
export const AMBIGUOUS_CHARS = "Il1|O0o5S8B6G2Z";

const AMBIGUOUS_SET = new Set(AMBIGUOUS_CHARS.split(""));

// ─── Secure randomness ───────────────────────────────────────────────────────

/** A function returning a uniformly random integer in [0, max). */
export type RandomInt = (max: number) => number;

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error("A secure random source (Web Crypto) is unavailable in this environment.");
  }
  return c;
}

/**
 * Uniform integer in [0, max) from a CSPRNG, using rejection sampling to eliminate
 * modulo bias. Exported so the same unbiased primitive is used everywhere.
 */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("secureRandomInt: max must be a positive integer.");
  }
  if (max === 1) return 0;
  const crypto = getCrypto();
  const buf = new Uint32Array(1);
  // Largest multiple of `max` that fits in a uint32; values at or above it are
  // rejected so the remaining range divides evenly (no bias toward low values).
  const limit = Math.floor(0x100000000 / max) * max;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/** In-place Fisher–Yates shuffle using the given unbiased RNG. */
function shuffle<T>(arr: T[], randomInt: RandomInt): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Password generation ─────────────────────────────────────────────────────

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  /** Remove look-alike characters (Il1O0o…). */
  excludeAmbiguous: boolean;
  /** Guarantee at least one character from every selected set. */
  requireEachSet: boolean;
}

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 128;

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachSet: true,
};

export interface GenerateOk {
  ok: true;
  value: string;
  /** Size of the character pool the password was drawn from — the entropy base. */
  poolSize: number;
  entropyBits: number;
}
export interface GenerateErr {
  ok: false;
  error: string;
}
export type GenerateResult = GenerateOk | GenerateErr;

function applyAmbiguous(set: string, exclude: boolean): string {
  if (!exclude) return set;
  return set
    .split("")
    .filter((ch) => !AMBIGUOUS_SET.has(ch))
    .join("");
}

/** The selected, ambiguity-filtered character pools, keyed by set. Empty pools dropped. */
function activePools(opts: PasswordOptions): { key: CharSetKey; chars: string }[] {
  const keys: CharSetKey[] = ["lowercase", "uppercase", "numbers", "symbols"];
  return keys
    .filter((k) => opts[k])
    .map((k) => ({ key: k, chars: applyAmbiguous(CHAR_SETS[k], opts.excludeAmbiguous) }))
    .filter((p) => p.chars.length > 0);
}

export function generatePassword(
  opts: PasswordOptions,
  randomInt: RandomInt = secureRandomInt
): GenerateResult {
  const length = Math.floor(opts.length);
  if (!Number.isFinite(length) || length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Length must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH}.`,
    };
  }

  const pools = activePools(opts);
  if (pools.length === 0) {
    return { ok: false, error: "Select at least one character type." };
  }
  if (opts.requireEachSet && length < pools.length) {
    return {
      ok: false,
      error: `Length must be at least ${pools.length} to include one of each selected type.`,
    };
  }

  const combined = pools.map((p) => p.chars).join("");
  const chars: string[] = [];

  // Guarantee one from each selected set first, then fill the remainder.
  if (opts.requireEachSet) {
    for (const p of pools) chars.push(p.chars[randomInt(p.chars.length)]);
  }
  while (chars.length < length) {
    chars.push(combined[randomInt(combined.length)]);
  }

  // Shuffle so the guaranteed characters are not stuck at the front.
  shuffle(chars, randomInt);

  const poolSize = combined.length;
  return {
    ok: true,
    value: chars.join(""),
    poolSize,
    entropyBits: length * Math.log2(poolSize),
  };
}

// ─── Passphrase generation ───────────────────────────────────────────────────

export type Separator = "-" | "." | "_" | " " | "";

export interface PassphraseOptions {
  words: number;
  separator: Separator;
  /** Capitalise the first letter of each word. */
  capitalize: boolean;
  /** Append a random two-digit number to the end. */
  addNumber: boolean;
}

export const MIN_PASSPHRASE_WORDS = 3;
export const MAX_PASSPHRASE_WORDS = 12;

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  words: 5,
  separator: "-",
  capitalize: true,
  addNumber: false,
};

export interface PassphraseOk {
  ok: true;
  value: string;
  wordCount: number;
  listSize: number;
  entropyBits: number;
}
export type PassphraseResult = PassphraseOk | GenerateErr;

export function generatePassphrase(
  opts: PassphraseOptions,
  randomInt: RandomInt = secureRandomInt
): PassphraseResult {
  const count = Math.floor(opts.words);
  if (!Number.isFinite(count) || count < MIN_PASSPHRASE_WORDS || count > MAX_PASSPHRASE_WORDS) {
    return {
      ok: false,
      error: `Choose between ${MIN_PASSPHRASE_WORDS} and ${MAX_PASSPHRASE_WORDS} words.`,
    };
  }

  const listSize = PASSPHRASE_WORDS.length;
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    let w = PASSPHRASE_WORDS[randomInt(listSize)];
    if (opts.capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
    picked.push(w);
  }

  let value = picked.join(opts.separator);

  // Word-choice entropy is the guaranteed floor; a trailing number adds ~log2(100).
  let entropyBits = count * Math.log2(listSize);
  if (opts.addNumber) {
    const n = 10 + randomInt(90); // 10..99, always two digits
    value += `${opts.separator}${n}`;
    entropyBits += Math.log2(90);
  }

  return { ok: true, value, wordCount: count, listSize, entropyBits };
}

// ─── Strength & crack-time ───────────────────────────────────────────────────

export interface Strength {
  /** 0 (weakest) … 4 (strongest). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
}

/** Map entropy (bits) to a five-band strength rating. */
export function strengthFromEntropy(bits: number): Strength {
  if (bits < 28) return { score: 0, label: "Very weak" };
  if (bits < 36) return { score: 1, label: "Weak" };
  if (bits < 60) return { score: 2, label: "Fair" };
  if (bits < 128) return { score: 3, label: "Strong" };
  return { score: 4, label: "Very strong" };
}

/**
 * Human-readable time to exhaust the keyspace, assuming an **offline** attacker
 * making 1e11 (100 billion) guesses per second — a fast modern GPU rig against a
 * weak/unsalted hash. Uses the average case (half the keyspace). This is a
 * deliberately pessimistic estimate for user awareness, not a guarantee.
 */
export const ASSUMED_GUESSES_PER_SECOND = 1e11;

export function crackTimeText(bits: number, guessesPerSecond = ASSUMED_GUESSES_PER_SECOND): string {
  // Average guesses = 2^(bits-1). Work in log-space to avoid Infinity for large bits.
  const log10Seconds = (bits - 1) * Math.log10(2) - Math.log10(guessesPerSecond);

  if (log10Seconds < 0) return "instantly";

  const seconds = log10Seconds < 300 ? Math.pow(10, log10Seconds) : Infinity;
  if (seconds === Infinity) return "longer than the age of the universe";

  const MIN = 60,
    HOUR = 3600,
    DAY = 86400,
    YEAR = 31557600;
  if (seconds < 1) return "less than a second";
  if (seconds < MIN) return `${Math.round(seconds)} seconds`;
  if (seconds < HOUR) return `${Math.round(seconds / MIN)} minutes`;
  if (seconds < DAY) return `${Math.round(seconds / HOUR)} hours`;
  if (seconds < YEAR) return `${Math.round(seconds / DAY)} days`;

  const years = seconds / YEAR;
  if (years < 1e3) return `${Math.round(years)} years`;
  if (years < 1e6) return `${Math.round(years / 1e3)} thousand years`;
  if (years < 1e9) return `${Math.round(years / 1e6)} million years`;
  if (years < 1e12) return `${Math.round(years / 1e9)} billion years`;
  return "longer than the age of the universe";
}

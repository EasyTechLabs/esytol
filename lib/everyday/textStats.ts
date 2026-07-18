/**
 * Text statistics engine — PLATFORM-004 (Everyday).
 *
 * Pure and deterministic: counts words, characters, sentences, paragraphs,
 * lines, and estimates reading time. Reuses lib/dev/metrics for the character/
 * line/byte primitives rather than re-counting them.
 */

import { measure } from "@/lib/dev/metrics";

export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  bytes: number;
  /** Reading time in minutes at 200 words/min, rounded up (0 for empty). */
  readingMinutes: number;
}

const WORDS_PER_MINUTE = 200;

export function textStats(input: string): TextStats {
  const base = measure(input); // characters, lines, bytes
  const trimmed = input.trim();

  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const charactersNoSpaces = input.replace(/\s/g, "").length;
  const sentences =
    trimmed === "" ? 0 : (trimmed.match(/[.!?]+(\s|$)/g) || []).length || (trimmed ? 1 : 0);
  const paragraphs =
    trimmed === "" ? 0 : trimmed.split(/\n\s*\n/).filter((p) => p.trim() !== "").length;
  const readingMinutes = words === 0 ? 0 : Math.ceil(words / WORDS_PER_MINUTE);

  return {
    words,
    characters: base.characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    lines: base.lines,
    bytes: base.bytes,
    readingMinutes,
  };
}

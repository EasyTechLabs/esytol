/**
 * Text metrics + timing — DEVELOPER-001 (Part 2 support).
 *
 * The numbers every result panel shows: characters, lines, bytes (UTF-8), and
 * how long the transform took. Pure and deterministic (except the clock, which
 * the caller supplies).
 */

export interface TextMetrics {
  characters: number;
  lines: number;
  /** UTF-8 byte length — what actually travels over the wire. */
  bytes: number;
}

export function measure(text: string): TextMetrics {
  return {
    characters: text.length,
    lines: text === "" ? 0 : text.split("\n").length,
    bytes: new TextEncoder().encode(text).length,
  };
}

/** Format a byte count as B / KB / MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Time a synchronous transform. `now` defaults to performance.now when present
 * (browser + Node), falling back so the module never throws at import.
 */
export function timed<T>(fn: () => T): { result: T; ms: number } {
  const clock =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => 0;
  const start = clock();
  const result = fn();
  return { result, ms: Math.max(0, clock() - start) };
}

/** Human-readable processing time. */
export function formatMs(ms: number): string {
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

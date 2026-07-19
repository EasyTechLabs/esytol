/**
 * AIOS kernel primitives (AIOS-004 — Chief Orchestrator implementation).
 *
 * Deterministic time + identity + value helpers. The orchestrator MUST be reproducible
 * (golden-task replay, see docs), so wall-clock time and randomness are never used directly —
 * they are injected as a `Clock` and an `IdGenerator`. This mirrors AIOS.md §5 (a run is pure over
 * its inputs) and the "no invented numbers / reproducible" discipline.
 */

/** A monotonic logical clock. The default increments once per read, so tests are deterministic. */
export interface Clock {
  /** Returns a monotonically non-decreasing logical tick. */
  now(): number;
}

/** Deterministic logical clock: a simple monotonic counter. */
export class LogicalClock implements Clock {
  private tick: number;
  constructor(start = 0) {
    this.tick = start;
  }
  now(): number {
    return ++this.tick;
  }
}

/** Deterministic, prefixed, zero-padded id generator (e.g. `task-000001`). */
export class IdGenerator {
  private counters = new Map<string, number>();
  next(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}-${String(n).padStart(6, "0")}`;
  }
}

/** Deep clone of plain JSON-serialisable data — used to isolate memory snapshots and outputs. */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Recursively freeze plain data so a granted read-only snapshot cannot be mutated by a consumer. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Structural equality for plain JSON data (used by workflow gates and golden-replay assertions). */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** AIOS version stamped into every audit record's provenance. */
export const AIOS_VERSION = "0.1.0";

/** The Task-contract version this runtime implements. */
export const TASK_CONTRACT_VERSION = "1.0.0";

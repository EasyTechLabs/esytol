/**
 * Structural diff engine (DEVELOPER-003).
 *
 * Compares two parsed JavaScript values (from JSON, YAML, or any format that parses to JS) into a
 * diff tree, computes statistics, and emits an RFC 6902 JSON Patch. Working on parsed values — not
 * text — makes this reusable by a future YAML Diff, XML Diff, config diff, or API-response diff:
 * parse to JS, then `diffValues`.
 *
 * Safety: read-only traversal (no writes into user objects → no prototype pollution), and a depth
 * guard so pathologically nested input degrades gracefully instead of overflowing the stack.
 *
 * Pure and deterministic; nothing touches the network, DOM, or storage.
 */

import { analyzeJson } from "./jsonInsights";

export type DiffKind = "added" | "removed" | "changed" | "type-changed" | "unchanged";

export interface DiffEntry {
  /** Object key or array index at this node; `null` for the root. */
  key: string | number | null;
  /** Full path from the root (keys and indices). */
  path: (string | number)[];
  kind: DiffKind;
  /** Left value (absent for `added`). */
  left?: unknown;
  /** Right value (absent for `removed`). */
  right?: unknown;
  /** "object" | "array" when this node is a container that was compared structurally. */
  container?: "object" | "array";
  /** Present only when a container **changed** — the per-key/index child diffs. */
  children?: DiffEntry[];
}

const MAX_DEPTH = 400;

function typeOf(v: unknown): "null" | "array" | "object" | "string" | "number" | "boolean" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  return t === "object" ? "object" : (t as "string" | "number" | "boolean");
}

function scalarEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

/** Compare two present values into a diff entry. */
function compare(
  left: unknown,
  right: unknown,
  path: (string | number)[],
  key: string | number | null
): DiffEntry {
  const lt = typeOf(left);
  const rt = typeOf(right);

  // Depth guard — beyond the cap, fall back to a stringified comparison (no deeper recursion).
  if (path.length > MAX_DEPTH) {
    let equal = false;
    try {
      equal = JSON.stringify(left) === JSON.stringify(right);
    } catch {
      equal = false;
    }
    return { key, path, kind: equal ? "unchanged" : "changed", left, right };
  }

  if (lt !== rt) return { key, path, kind: "type-changed", left, right };

  if (lt === "object") {
    const l = left as Record<string, unknown>;
    const r = right as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(l), ...Object.keys(r)])).sort();
    const children = keys.map((k) => childDiff(l, r, k, path));
    const changed = children.some((c) => c.kind !== "unchanged");
    return changed
      ? { key, path, kind: "changed", container: "object", left, right, children }
      : { key, path, kind: "unchanged", container: "object", left, right };
  }

  if (lt === "array") {
    const l = left as unknown[];
    const r = right as unknown[];
    const max = Math.max(l.length, r.length);
    const children: DiffEntry[] = [];
    for (let i = 0; i < max; i++) children.push(arrayChild(l, r, i, path));
    const changed = children.some((c) => c.kind !== "unchanged");
    return changed
      ? { key, path, kind: "changed", container: "array", left, right, children }
      : { key, path, kind: "unchanged", container: "array", left, right };
  }

  // Scalars.
  return { key, path, kind: scalarEqual(left, right) ? "unchanged" : "changed", left, right };
}

function childDiff(
  l: Record<string, unknown>,
  r: Record<string, unknown>,
  k: string,
  path: (string | number)[]
): DiffEntry {
  const childPath = [...path, k];
  const inL = Object.prototype.hasOwnProperty.call(l, k);
  const inR = Object.prototype.hasOwnProperty.call(r, k);
  if (inL && inR) return compare(l[k], r[k], childPath, k);
  if (!inL) return { key: k, path: childPath, kind: "added", right: r[k] };
  return { key: k, path: childPath, kind: "removed", left: l[k] };
}

function arrayChild(l: unknown[], r: unknown[], i: number, path: (string | number)[]): DiffEntry {
  const childPath = [...path, i];
  const inL = i < l.length;
  const inR = i < r.length;
  if (inL && inR) return compare(l[i], r[i], childPath, i);
  if (!inL) return { key: i, path: childPath, kind: "added", right: r[i] };
  return { key: i, path: childPath, kind: "removed", left: l[i] };
}

/** Diff two parsed values into a root diff entry. */
export function diffValues(left: unknown, right: unknown): DiffEntry {
  return compare(left, right, [], null);
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
  maxDepth: number;
}

/** Count value nodes in a subtree (reuses the JSON insight walker). */
function countNodes(value: unknown): number {
  return analyzeJson(value).totalValues;
}

export function diffStats(root: DiffEntry): DiffStats {
  let added = 0;
  let removed = 0;
  let modified = 0;
  let unchanged = 0;
  let maxDepth = 0;

  const walk = (entry: DiffEntry): void => {
    if (entry.path.length > maxDepth) maxDepth = entry.path.length;
    switch (entry.kind) {
      case "added":
        added += countNodes(entry.right);
        break;
      case "removed":
        removed += countNodes(entry.left);
        break;
      case "type-changed":
        modified++;
        break;
      case "changed":
        if (entry.children) entry.children.forEach(walk);
        else modified++;
        break;
      case "unchanged":
        unchanged += entry.container ? countNodes(entry.left) : 1;
        break;
    }
  };

  walk(root);
  return {
    added,
    removed,
    modified,
    unchanged,
    total: added + removed + modified + unchanged,
    maxDepth,
  };
}

// ─── RFC 6902 JSON Patch ─────────────────────────────────────────────────────

export interface PatchOp {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}

/** Escape a path segment per RFC 6901 (JSON Pointer): `~` → `~0`, `/` → `~1`. */
function escapePointer(segment: string | number): string {
  return String(segment).replace(/~/g, "~0").replace(/\//g, "~1");
}

function pointer(path: (string | number)[]): string {
  return path.length === 0 ? "" : "/" + path.map(escapePointer).join("/");
}

/** Public JSON Pointer (RFC 6901) for a path — used by the UI to key/jump to a node. */
export function pathToPointer(path: (string | number)[]): string {
  return pointer(path);
}

/**
 * Produce an RFC 6902 JSON Patch that transforms the left document into the right one.
 * Array tails are index-aligned, so array additions append and removals are emitted
 * highest-index-first to keep the remaining indices valid.
 */
export function toJsonPatch(root: DiffEntry): PatchOp[] {
  const ops: PatchOp[] = [];

  const emit = (entry: DiffEntry): void => {
    switch (entry.kind) {
      case "added":
        ops.push({ op: "add", path: pointer(entry.path), value: entry.right });
        break;
      case "removed":
        ops.push({ op: "remove", path: pointer(entry.path) });
        break;
      case "type-changed":
        ops.push({ op: "replace", path: pointer(entry.path), value: entry.right });
        break;
      case "changed":
        if (!entry.children) {
          ops.push({ op: "replace", path: pointer(entry.path), value: entry.right });
          break;
        }
        if (entry.container === "array") {
          // Non-removed children first (replaces/nested/tail-adds), then removes highest-index-first.
          const removes = entry.children.filter((c) => c.kind === "removed");
          const rest = entry.children.filter((c) => c.kind !== "removed");
          rest.forEach(emit);
          [...removes].reverse().forEach(emit);
        } else {
          entry.children.forEach(emit);
        }
        break;
      case "unchanged":
        break;
    }
  };

  emit(root);
  return ops;
}

/** True when the two values are structurally identical (no differences). */
export function isIdentical(root: DiffEntry): boolean {
  return root.kind === "unchanged";
}

/** Collect the paths (as JSON Pointers) of every changed/added/removed leaf — for jump-to-diff. */
export function collectDiffPaths(root: DiffEntry): string[] {
  const paths: string[] = [];
  const walk = (entry: DiffEntry): void => {
    if (entry.kind === "changed" && entry.children) {
      entry.children.forEach(walk);
    } else if (entry.kind !== "unchanged") {
      paths.push(pointer(entry.path));
    }
  };
  walk(root);
  return paths;
}

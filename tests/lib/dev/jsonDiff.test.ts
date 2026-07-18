/**
 * Structural diff engine tests (DEVELOPER-003).
 *
 * Covers every diff kind, nested objects and arrays, type changes, unicode, the RFC 6902 patch
 * (including that applying it transforms left → right), statistics, and the depth guard.
 */

import { describe, it, expect } from "vitest";
import {
  diffValues,
  diffStats,
  toJsonPatch,
  isIdentical,
  collectDiffPaths,
  type DiffEntry,
} from "@/lib/dev/jsonDiff";

const kindAt = (root: DiffEntry, ...keys: (string | number)[]): string => {
  let node: DiffEntry | undefined = root;
  for (const k of keys) node = node?.children?.find((c) => c.key === k);
  return node?.kind ?? "missing";
};

describe("diffValues — kinds", () => {
  it("marks identical documents unchanged", () => {
    const d = diffValues({ a: 1, b: [1, 2], c: { d: true } }, { a: 1, b: [1, 2], c: { d: true } });
    expect(isIdentical(d)).toBe(true);
    expect(d.kind).toBe("unchanged");
  });

  it("detects added, removed, and changed keys", () => {
    const d = diffValues({ a: 1, b: 2 }, { a: 1, c: 3, b: 5 });
    expect(kindAt(d, "a")).toBe("unchanged");
    expect(kindAt(d, "b")).toBe("changed");
    expect(kindAt(d, "c")).toBe("added");
    // "removed" needs a key only on the left.
    const d2 = diffValues({ a: 1, gone: 2 }, { a: 1 });
    expect(kindAt(d2, "gone")).toBe("removed");
  });

  it("detects a type change vs a value change", () => {
    expect(diffValues({ a: 1 }, { a: "1" }).children?.[0].kind).toBe("type-changed");
    expect(diffValues({ a: 1 }, { a: 2 }).children?.[0].kind).toBe("changed");
    expect(diffValues({ a: [] }, { a: {} }).children?.[0].kind).toBe("type-changed");
    expect(diffValues({ a: null }, { a: 0 }).children?.[0].kind).toBe("type-changed");
  });

  it("compares nested objects and arrays", () => {
    const d = diffValues(
      { user: { id: 1, roles: ["admin", "dev"] } },
      { user: { id: 2, roles: ["admin", "ops"] } }
    );
    const user = d.children?.find((c) => c.key === "user");
    expect(user?.kind).toBe("changed");
    expect(user?.children?.find((c) => c.key === "id")?.kind).toBe("changed");
    const roles = user?.children?.find((c) => c.key === "roles");
    expect(roles?.children?.[0].kind).toBe("unchanged"); // "admin" == "admin"
    expect(roles?.children?.[1].kind).toBe("changed"); // dev -> ops
  });

  it("handles array length differences (tail add / remove)", () => {
    expect(diffValues([1, 2], [1, 2, 3]).children?.[2].kind).toBe("added");
    expect(diffValues([1, 2, 3], [1, 2]).children?.[2].kind).toBe("removed");
  });

  it("handles unicode values", () => {
    expect(diffValues({ m: "₹ é 😀" }, { m: "₹ é 😀" }).kind).toBe("unchanged");
    expect(diffValues({ m: "a" }, { m: "😀" }).children?.[0].kind).toBe("changed");
  });
});

describe("diffStats", () => {
  it("counts added, removed, modified, unchanged, total, and depth", () => {
    const s = diffStats(
      diffValues({ a: 1, b: { c: 2 }, keep: "x" }, { a: 9, b: { c: 2, d: 3 }, keep: "x" })
    );
    expect(s.modified).toBe(1); // a: 1 -> 9
    expect(s.added).toBe(1); // b.d added (scalar)
    expect(s.removed).toBe(0);
    expect(s.unchanged).toBeGreaterThan(0); // keep + b.c + containers
    expect(s.total).toBe(s.added + s.removed + s.modified + s.unchanged);
    expect(s.maxDepth).toBeGreaterThanOrEqual(2);
  });

  it("counts a whole added/removed subtree by its node count", () => {
    const added = diffStats(diffValues({}, { tree: { a: 1, b: [2, 3] } }));
    // added subtree: object + a + array + 2 + 3 = 5 nodes.
    expect(added.added).toBe(5);
    const removed = diffStats(diffValues({ tree: { a: 1 } }, {}));
    expect(removed.removed).toBe(2); // object + a
  });
});

describe("toJsonPatch — RFC 6902", () => {
  const apply = (doc: unknown, ops: ReturnType<typeof toJsonPatch>): unknown => {
    // A tiny applier sufficient for the shapes our diff produces (object keys + array tails).
    const root = structuredClone(doc);
    const parse = (p: string) =>
      p
        .split("/")
        .slice(1)
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    for (const op of ops) {
      const segs = parse(op.path);
      const last = segs.pop()!;
      let target: unknown = root;
      for (const s of segs)
        target = Array.isArray(target) ? target[Number(s)] : (target as Record<string, unknown>)[s];
      if (op.op === "remove") {
        if (Array.isArray(target)) target.splice(Number(last), 1);
        else delete (target as Record<string, unknown>)[last];
      } else if (Array.isArray(target)) {
        target[Number(last)] = op.value;
      } else {
        (target as Record<string, unknown>)[last] = op.value;
      }
    }
    return root;
  };

  it("emits add / remove / replace operations with JSON Pointer paths", () => {
    const ops = toJsonPatch(diffValues({ a: 1, b: 2, gone: 3 }, { a: 1, b: 9, added: 7 }));
    expect(ops).toContainEqual({ op: "replace", path: "/b", value: 9 });
    expect(ops).toContainEqual({ op: "add", path: "/added", value: 7 });
    expect(ops).toContainEqual({ op: "remove", path: "/gone" });
  });

  it("escapes ~ and / in pointer segments (RFC 6901)", () => {
    const ops = toJsonPatch(diffValues({ "a/b": 1, "c~d": 1 }, { "a/b": 2, "c~d": 2 }));
    expect(ops.map((o) => o.path).sort()).toEqual(["/a~1b", "/c~0d"]);
  });

  it("produces a patch that transforms left into right", () => {
    const left = { a: 1, b: { c: [1, 2, 3], d: "x" }, e: [1, 2] };
    const right = { a: 1, b: { c: [1, 9], d: "x" }, f: true, e: [1, 2, 3] };
    const ops = toJsonPatch(diffValues(left, right));
    expect(apply(left, ops)).toEqual(right);
  });

  it("emits array removals highest-index-first so indices stay valid", () => {
    const left = { list: [1, 2, 3, 4, 5] };
    const right = { list: [1, 2] };
    const ops = toJsonPatch(diffValues(left, right));
    expect(apply(left, ops)).toEqual(right);
  });
});

describe("collectDiffPaths", () => {
  it("returns a pointer per changed/added/removed leaf, for jump-to-diff", () => {
    const paths = collectDiffPaths(diffValues({ a: 1, b: 2, gone: 1 }, { a: 9, b: 2, add: 3 }));
    expect(paths).toContain("/a");
    expect(paths).toContain("/gone");
    expect(paths).toContain("/add");
    expect(paths).not.toContain("/b");
  });
});

describe("safety", () => {
  it("does not overflow on deeply nested input", () => {
    let deepL: unknown = 1;
    let deepR: unknown = 2;
    for (let i = 0; i < 1000; i++) {
      deepL = { n: deepL };
      deepR = { n: deepR };
    }
    expect(() => diffValues(deepL, deepR)).not.toThrow();
  });

  it("does not write into the compared objects (no prototype pollution)", () => {
    diffValues(JSON.parse('{"__proto__":{"x":1}}'), JSON.parse('{"__proto__":{"x":2}}'));
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

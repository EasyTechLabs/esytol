"use client";

/**
 * Unified diff tree — the core visualisation for the JSON Diff Viewer (DEVELOPER-003).
 *
 * Renders a `DiffEntry` tree, colour-coded by kind (added / removed / changed / type-changed),
 * with expand/collapse-all, a "changed only" filter, search-highlight, and jump-to-next/previous
 * difference. Lazy: a collapsed container renders none of its children. Colour is never the only
 * signal — every changed row carries a text badge.
 */

import { useMemo, useRef, useState } from "react";
import { collectDiffPaths, pathToPointer, type DiffEntry, type DiffKind } from "@/lib/dev/jsonDiff";

const KIND_STYLE: Record<DiffKind, { row: string; badge: string; label: string }> = {
  added: { row: "bg-green-50", badge: "bg-green-600", label: "added" },
  removed: { row: "bg-red-50", badge: "bg-red-600", label: "removed" },
  changed: { row: "bg-amber-50", badge: "bg-amber-500", label: "changed" },
  "type-changed": { row: "bg-orange-50", badge: "bg-orange-600", label: "type" },
  unchanged: { row: "", badge: "bg-gray-300", label: "" },
};

export function DiffTree({ root }: { root: DiffEntry }) {
  const [query, setQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(true);
  const [version, setVersion] = useState(0);
  const [openAll, setOpenAll] = useState<boolean | null>(null);
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const diffPointers = useMemo(() => collectDiffPaths(root), [root]);
  const diffIndex = useMemo(() => {
    const m = new Map<string, number>();
    diffPointers.forEach((p, i) => m.set(p, i));
    return m;
  }, [diffPointers]);

  const setAll = (open: boolean) => {
    setOpenAll(open);
    setVersion((v) => v + 1);
  };

  const jump = (dir: 1 | -1) => {
    if (diffPointers.length === 0) return;
    const next = (current + dir + diffPointers.length) % diffPointers.length;
    setCurrent(next);
    const el = containerRef.current?.querySelector(`[data-diff-index="${next}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    (el as HTMLElement | null)?.focus?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search keys and values…"
          aria-label="Search the diff"
          className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
        />
        <span className="text-xs text-gray-500" role="status">
          {diffPointers.length} difference{diffPointers.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => jump(-1)}
          disabled={diffPointers.length === 0}
          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          aria-label="Previous difference"
        >
          ↑ Prev
        </button>
        <button
          type="button"
          onClick={() => jump(1)}
          disabled={diffPointers.length === 0}
          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          aria-label="Next difference"
        >
          ↓ Next
        </button>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={changedOnly}
            onChange={(e) => setChangedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-brand-600"
          />
          Changed only
        </label>
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Expand
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Collapse
        </button>
      </div>

      <div
        key={version}
        ref={containerRef}
        role="tree"
        aria-label="JSON diff"
        className="max-h-[30rem] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm"
      >
        <DiffNode
          entry={root}
          depth={0}
          openAll={openAll}
          query={q}
          changedOnly={changedOnly}
          diffIndex={diffIndex}
        />
      </div>
    </div>
  );
}

interface NodeProps {
  entry: DiffEntry;
  depth: number;
  openAll: boolean | null;
  query: string;
  changedOnly: boolean;
  diffIndex: Map<string, number>;
}

function DiffNode({ entry, depth, openAll, query, changedOnly, diffIndex }: NodeProps) {
  const isContainer = entry.container !== undefined && entry.children !== undefined;
  // A changed container opens by default so every difference is visible (and reachable by
  // jump-to-next) without expanding the whole document; unchanged containers stay collapsed.
  const [open, setOpen] = useState(openAll ?? (entry.kind === "changed" || depth < 2));
  const style = KIND_STYLE[entry.kind];

  // "Changed only" hides unchanged rows (except the root, which always renders).
  if (changedOnly && entry.kind === "unchanged" && entry.path.length > 0) return null;

  const label =
    entry.key !== null ? (
      <>
        <Highlight
          text={String(entry.key)}
          query={query}
          className={typeof entry.key === "number" ? "text-gray-400" : "text-purple-700"}
        />
        <span className="text-gray-400">: </span>
      </>
    ) : null;

  if (isContainer) {
    const childrenVisible = open || query !== "";
    const visibleChildren = entry.children!.filter(
      (c) => !(changedOnly && c.kind === "unchanged" && c.path.length > 0)
    );
    return (
      <div role="treeitem" aria-selected={false} aria-expanded={childrenVisible}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={
            "flex w-full items-baseline gap-1 rounded px-0.5 text-left hover:bg-gray-100 " +
            style.row
          }
        >
          <span className="inline-block w-4 shrink-0 text-gray-500" aria-hidden>
            {childrenVisible ? "▼" : "▶"}
          </span>
          {label}
          <span className="text-xs text-gray-400">
            {entry.container === "array" ? "Array" : "Object"}
            {entry.kind !== "unchanged" && <Badge kind={entry.kind} />}
          </span>
        </button>
        {childrenVisible && (
          <ul role="group" className="ml-3 border-l border-gray-200 pl-2">
            {visibleChildren.map((c) => (
              <li key={String(c.key)}>
                <DiffNode
                  entry={c}
                  depth={depth + 1}
                  openAll={openAll}
                  query={query}
                  changedOnly={changedOnly}
                  diffIndex={diffIndex}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Leaf.
  const idx = entry.kind !== "unchanged" ? diffIndex.get(pathToPointer(entry.path)) : undefined;
  return (
    <div
      role="treeitem"
      aria-selected={false}
      tabIndex={idx !== undefined ? -1 : undefined}
      data-diff-index={idx}
      className={"flex flex-wrap items-baseline gap-1 rounded px-0.5 py-0.5 " + style.row}
    >
      <span className="mr-1 inline-block w-4" aria-hidden />
      {label}
      <LeafValues entry={entry} query={query} />
      {entry.kind !== "unchanged" && <Badge kind={entry.kind} />}
    </div>
  );
}

function LeafValues({ entry, query }: { entry: DiffEntry; query: string }) {
  if (entry.kind === "added")
    return <Scalar value={entry.right} query={query} tone="text-green-700" />;
  if (entry.kind === "removed")
    return <Scalar value={entry.left} query={query} tone="text-red-700" />;
  if (entry.kind === "unchanged")
    return <Scalar value={entry.left} query={query} tone="text-gray-600" />;
  // changed / type-changed: show left → right.
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <span className="text-red-700 line-through">
        <Scalar value={entry.left} query={query} tone="text-red-700" />
      </span>
      <span className="text-gray-400" aria-hidden>
        →
      </span>
      <Scalar value={entry.right} query={query} tone="text-green-700" />
    </span>
  );
}

function Scalar({ value, query, tone }: { value: unknown; query: string; tone: string }) {
  if (value === null) return <span className="text-gray-400">null</span>;
  if (Array.isArray(value)) return <span className="text-gray-500">[{value.length}]</span>;
  if (typeof value === "object")
    return <span className="text-gray-500">{`{${Object.keys(value as object).length}}`}</span>;
  if (typeof value === "string")
    return (
      <span className={tone}>
        &quot;
        <Highlight text={value} query={query} className={tone} />
        &quot;
      </span>
    );
  return <Highlight text={String(value)} query={query} className={tone} />;
}

function Badge({ kind }: { kind: DiffKind }) {
  const s = KIND_STYLE[kind];
  return (
    <span
      className={"ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white " + s.badge}
    >
      {s.label}
    </span>
  );
}

function Highlight({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  if (query === "" || !text.toLowerCase().includes(query))
    return <span className={className}>{text}</span>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let idx = lower.indexOf(query);
  let key = 0;
  while (idx !== -1) {
    if (idx > start) parts.push(<span key={key++}>{text.slice(start, idx)}</span>);
    parts.push(
      <mark key={key++} className="rounded bg-yellow-200 text-inherit">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    start = idx + query.length;
    idx = lower.indexOf(query, start);
  }
  if (start < text.length) parts.push(<span key={key++}>{text.slice(start)}</span>);
  return <span className={className}>{parts}</span>;
}

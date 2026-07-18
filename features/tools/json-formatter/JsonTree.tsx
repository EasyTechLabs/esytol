"use client";

/**
 * Interactive JSON tree view — part of the JSON Formatter upgrade (TOOL-005).
 *
 * Lazy by construction: a collapsed node renders none of its children, so a large
 * document stays responsive. Expand-all / collapse-all remount the tree to reset each
 * node's state; a search term forces matching branches open and highlights matches,
 * without remounting. Fully keyboard-operable (each toggle is a button).
 */

import { useMemo, useState } from "react";
import { countJsonMatches } from "@/lib/dev/jsonInsights";

export function JsonTree({ value }: { value: unknown }) {
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [openAll, setOpenAll] = useState<boolean | null>(null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => countJsonMatches(value, q), [value, q]);

  const setAll = (open: boolean) => {
    setOpenAll(open);
    setVersion((v) => v + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keys and values…"
            aria-label="Search the JSON tree"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
          />
        </div>
        {q !== "" && (
          <span className="text-xs text-gray-500" role="status">
            {matches} match{matches === 1 ? "" : "es"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Collapse all
        </button>
      </div>

      <div
        key={version}
        role="tree"
        aria-label="JSON tree"
        className="max-h-[28rem] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm"
      >
        <TreeNode
          value={value}
          label={null}
          isIndex={false}
          depth={0}
          openAll={openAll}
          query={q}
        />
      </div>
    </div>
  );
}

interface TreeNodeProps {
  value: unknown;
  label: string | null;
  isIndex: boolean;
  depth: number;
  openAll: boolean | null;
  query: string;
}

function TreeNode({ value, label, isIndex, depth, openAll, query }: TreeNodeProps) {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;
  const isContainer = isArray || isObject;

  const [open, setOpen] = useState(openAll ?? depth < 2);
  const childrenVisible = isContainer && (open || query !== "");

  const keyLabel = label !== null && (
    <>
      <Highlight
        text={label}
        query={query}
        className={isIndex ? "text-gray-400" : "text-purple-700"}
      />
      <span className="text-gray-400">: </span>
    </>
  );

  if (!isContainer) {
    return (
      <div role="treeitem" aria-selected={false} className="flex flex-wrap items-baseline py-0.5">
        <span className="mr-1 inline-block w-4" aria-hidden />
        {keyLabel}
        <ScalarValue value={value} query={query} />
      </div>
    );
  }

  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const summary = isArray ? `[${entries.length}]` : `{${entries.length}}`;

  return (
    <div role="treeitem" aria-selected={false} aria-expanded={childrenVisible}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline gap-1 rounded px-0.5 text-left hover:bg-gray-100"
      >
        <span className="inline-block w-4 shrink-0 text-gray-500" aria-hidden>
          {childrenVisible ? "▼" : "▶"}
        </span>
        {keyLabel}
        <span className="text-xs text-gray-400">
          {isArray ? "Array" : "Object"} {summary}
        </span>
      </button>
      {childrenVisible && (
        <ul role="group" className="ml-3 border-l border-gray-200 pl-2">
          {entries.map(([k, v]) => (
            <li key={k}>
              <TreeNode
                value={v}
                label={k}
                isIndex={isArray}
                depth={depth + 1}
                openAll={openAll}
                query={query}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScalarValue({ value, query }: { value: unknown; query: string }) {
  if (value === null) return <span className="text-gray-400">null</span>;
  if (typeof value === "string")
    return (
      <span className="text-green-700">
        &quot;
        <Highlight text={value} query={query} className="text-green-700" />
        &quot;
      </span>
    );
  if (typeof value === "number")
    return <Highlight text={String(value)} query={query} className="text-blue-700" />;
  if (typeof value === "boolean")
    return <Highlight text={String(value)} query={query} className="text-amber-700" />;
  return <span className="text-gray-700">{String(value)}</span>;
}

/** Render `text`, wrapping case-insensitive matches of `query` in a <mark>. */
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

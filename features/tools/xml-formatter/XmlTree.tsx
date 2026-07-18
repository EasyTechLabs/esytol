"use client";

/**
 * XML tree view — for the XML Formatter & Validator (DEVELOPER-004).
 *
 * Renders the `XmlNode[]` tree from lib/dev/xml (element / text / comment / cdata / pi /
 * declaration / doctype), lazily: a collapsed element renders none of its children. Expand/collapse
 * all, and search that highlights matching names, attributes, and text. Fully keyboard-operable.
 */

import { useMemo, useState } from "react";
import type { XmlNode } from "@/lib/dev/xml";

export function XmlTree({ nodes }: { nodes: XmlNode[] }) {
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [openAll, setOpenAll] = useState<boolean | null>(null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q === "" ? 0 : countMatches(nodes, q)), [nodes, q]);

  const setAll = (open: boolean) => {
    setOpenAll(open);
    setVersion((v) => v + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, attributes, and text…"
          aria-label="Search the XML tree"
          className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
        />
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

      <ul
        key={version}
        role="tree"
        aria-label="XML tree"
        className="max-h-[28rem] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm"
      >
        {nodes.map((n, i) => (
          <li key={i}>
            <TreeNode node={n} depth={0} openAll={openAll} query={q} />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface NodeProps {
  node: XmlNode;
  depth: number;
  openAll: boolean | null;
  query: string;
}

function TreeNode({ node, depth, openAll, query }: NodeProps) {
  const [open, setOpen] = useState(openAll ?? depth < 2);

  if (node.type === "text") {
    if (node.value.trim() === "") return null;
    return (
      <div role="treeitem" aria-selected={false} className="flex items-baseline py-0.5">
        <span className="mr-1 inline-block w-4" aria-hidden />
        <span className="text-gray-700">
          <Highlight text={node.value.trim()} query={query} />
        </span>
      </div>
    );
  }
  if (node.type === "comment")
    return (
      <Leaf>
        <span className="text-gray-400">
          &lt;!--
          <Highlight text={node.value} query={query} className="text-gray-400" />
          --&gt;
        </span>
      </Leaf>
    );
  if (node.type === "cdata")
    return (
      <Leaf>
        <span className="text-teal-700">
          &lt;![CDATA[
          <Highlight text={node.value} query={query} className="text-teal-700" />
          ]]&gt;
        </span>
      </Leaf>
    );
  if (node.type === "pi")
    return (
      <Leaf>
        <span className="text-blue-700">
          &lt;?{node.target} {node.value}?&gt;
        </span>
      </Leaf>
    );
  if (node.type === "declaration")
    return (
      <Leaf>
        <span className="text-blue-700">&lt;?xml {node.value}?&gt;</span>
      </Leaf>
    );
  if (node.type === "doctype")
    return (
      <Leaf>
        <span className="text-gray-500">{node.value}</span>
      </Leaf>
    );

  // Element.
  const attrs = (
    <>
      {node.attrs.map((a) => (
        <span key={a.name}>
          {" "}
          <Highlight text={a.name} query={query} className="text-amber-700" />
          <span className="text-gray-400">=</span>
          <span className="text-green-700">
            &quot;
            <Highlight text={a.value} query={query} className="text-green-700" />
            &quot;
          </span>
        </span>
      ))}
    </>
  );

  const nameEl = <Highlight text={node.name} query={query} className="text-purple-700" />;

  if (node.children.length === 0) {
    return (
      <Leaf>
        <span className="text-gray-400">&lt;</span>
        {nameEl}
        {attrs}
        <span className="text-gray-400">/&gt;</span>
      </Leaf>
    );
  }

  const onlyText = node.children.every((c) => c.type === "text" || c.type === "cdata");
  if (onlyText) {
    const inner = node.children
      .map((c) => (c.type === "cdata" ? c.value : (c as { value: string }).value))
      .join("")
      .trim();
    return (
      <Leaf>
        <span className="text-gray-400">&lt;</span>
        {nameEl}
        {attrs}
        <span className="text-gray-400">&gt;</span>
        <Highlight text={inner} query={query} className="text-gray-700" />
        <span className="text-gray-400">&lt;/</span>
        {nameEl}
        <span className="text-gray-400">&gt;</span>
      </Leaf>
    );
  }

  const childrenVisible = open || query !== "";
  const visible = node.children.filter((c) => !(c.type === "text" && c.value.trim() === ""));
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
        <span className="text-gray-400">&lt;</span>
        {nameEl}
        {attrs}
        <span className="text-gray-400">&gt;</span>
        <span className="ml-1 text-xs text-gray-400">{visible.length}</span>
      </button>
      {childrenVisible && (
        <ul role="group" className="ml-3 border-l border-gray-200 pl-2">
          {visible.map((c, i) => (
            <li key={i}>
              <TreeNode node={c} depth={depth + 1} openAll={openAll} query={query} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Leaf({ children }: { children: React.ReactNode }) {
  return (
    <div role="treeitem" aria-selected={false} className="flex items-baseline py-0.5">
      <span className="mr-1 inline-block w-4" aria-hidden />
      {children}
    </div>
  );
}

function countMatches(nodes: XmlNode[], q: string): number {
  let n = 0;
  const walk = (list: XmlNode[]): void => {
    for (const node of list) {
      if (node.type === "element") {
        if (node.name.toLowerCase().includes(q)) n++;
        for (const a of node.attrs) {
          if (a.name.toLowerCase().includes(q)) n++;
          if (a.value.toLowerCase().includes(q)) n++;
        }
        walk(node.children);
      } else if (node.type === "text" || node.type === "cdata" || node.type === "comment") {
        if (node.value.toLowerCase().includes(q)) n++;
      }
    }
  };
  walk(nodes);
  return n;
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

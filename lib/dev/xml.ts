/**
 * XML engine — the reusable XML layer (DEVELOPER-004).
 *
 * A controlled, single-pass tokenizer/parser that is **XXE-safe by construction**: it never resolves
 * external entities, never evaluates DTDs, never expands entities (an `&entity;` stays literal text),
 * and never touches the network. That is deliberately *not* DOMParser — DOMParser can expand internal
 * entities (billion-laughs) and its errors are browser-specific. This engine gives full control over
 * formatting, the tree, statistics, and friendly errors with line/column, and it is reusable by a
 * future XML Diff or XPath tester.
 *
 * Pure and deterministic; nothing touches the network, DOM, or storage.
 */

import { type Validation, valid, error } from "./validation";

export type XmlNode =
  | { type: "element"; name: string; attrs: XmlAttr[]; children: XmlNode[]; selfClose: boolean }
  | { type: "text"; value: string }
  | { type: "comment"; value: string }
  | { type: "cdata"; value: string }
  | { type: "pi"; target: string; value: string }
  | { type: "declaration"; value: string }
  | { type: "doctype"; value: string };

export interface XmlAttr {
  name: string;
  value: string;
}

export interface XmlMeta {
  hasDeclaration: boolean;
  hasDoctype: boolean;
  processingInstructions: string[];
  namespaces: string[];
  entityRefs: string[];
  duplicateAttributes: { element: string; attr: string; line: number }[];
}

export interface XmlParseResult {
  ok: boolean;
  nodes: XmlNode[];
  validation: Validation;
  meta: XmlMeta;
}

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.\-]/;
const ENTITY_RE = /&(#x?[0-9A-Fa-f]+|[A-Za-z_][\w.\-]*);/g;

class Cursor {
  i = 0;
  line = 1;
  col = 1;
  constructor(readonly s: string) {}
  eof(): boolean {
    return this.i >= this.s.length;
  }
  peek(n = 0): string {
    return this.s[this.i + n] ?? "";
  }
  startsWith(t: string): boolean {
    return this.s.startsWith(t, this.i);
  }
  advance(n = 1): void {
    for (let k = 0; k < n && this.i < this.s.length; k++) {
      if (this.s[this.i] === "\n") {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.i++;
    }
  }
  skipWs(): void {
    while (!this.eof() && /\s/.test(this.peek())) this.advance();
  }
}

class XmlError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number
  ) {
    super(message);
  }
}

/** Parse XML text into a node tree with well-formedness validation and metadata. */
export function parseXmlDocument(input: string): XmlParseResult {
  const meta: XmlMeta = {
    hasDeclaration: false,
    hasDoctype: false,
    processingInstructions: [],
    namespaces: [],
    entityRefs: [],
    duplicateAttributes: [],
  };
  const entitySet = new Set<string>();
  const nsSet = new Set<string>();

  const collectEntities = (text: string): void => {
    for (const m of text.matchAll(ENTITY_RE)) entitySet.add(m[0]);
  };

  if (input.trim() === "") {
    return { ok: false, nodes: [], validation: error("Empty input"), meta };
  }

  const c = new Cursor(input);
  const roots: XmlNode[] = [];
  const stack: Extract<XmlNode, { type: "element" }>[] = [];
  let rootElementCount = 0;

  const push = (node: XmlNode): void => {
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
  };

  try {
    while (!c.eof()) {
      if (c.peek() !== "<") {
        // Text run up to the next "<".
        const start = c.i;
        while (!c.eof() && c.peek() !== "<") c.advance();
        const text = c.s.slice(start, c.i);
        collectEntities(text);
        if (stack.length > 0 || text.trim() !== "") push({ type: "text", value: text });
        continue;
      }

      // A markup construct.
      if (c.startsWith("<!--")) {
        const end = c.s.indexOf("-->", c.i + 4);
        if (end === -1) throw new XmlError("Unterminated comment (missing '-->').", c.line, c.col);
        push({ type: "comment", value: c.s.slice(c.i + 4, end) });
        c.advance(end + 3 - c.i);
        continue;
      }
      if (c.startsWith("<![CDATA[")) {
        const end = c.s.indexOf("]]>", c.i + 9);
        if (end === -1) throw new XmlError("Unterminated CDATA (missing ']]>').", c.line, c.col);
        push({ type: "cdata", value: c.s.slice(c.i + 9, end) });
        c.advance(end + 3 - c.i);
        continue;
      }
      if (c.startsWith("<!DOCTYPE") || (c.startsWith("<!") && !c.startsWith("<!--"))) {
        const value = readDoctype(c);
        meta.hasDoctype = true;
        push({ type: "doctype", value });
        continue;
      }
      if (c.startsWith("<?")) {
        const { target, value, isDeclaration } = readProcessingInstruction(c);
        if (isDeclaration) {
          meta.hasDeclaration = true;
          push({ type: "declaration", value });
        } else {
          meta.processingInstructions.push(target);
          push({ type: "pi", target, value });
        }
        continue;
      }
      if (c.startsWith("</")) {
        const { name } = readCloseTag(c);
        const top = stack.pop();
        if (!top)
          throw new XmlError(`Unexpected closing tag </${name}> — no open element.`, c.line, c.col);
        if (top.name !== name)
          throw new XmlError(
            `Mismatched tag: expected </${top.name}> but found </${name}>.`,
            c.line,
            c.col
          );
        continue;
      }

      // Opening or self-closing element.
      const el = readOpenTag(c, meta, nsSet);
      collectEntities(el.attrs.map((a) => a.value).join(" "));
      if (stack.length === 0) {
        rootElementCount++;
        if (rootElementCount > 1)
          throw new XmlError("An XML document must have exactly one root element.", c.line, c.col);
      }
      push(el);
      if (!el.selfClose) stack.push(el);
    }

    if (stack.length > 0)
      throw new XmlError(`Unclosed element <${stack[stack.length - 1].name}>.`, c.line, c.col);
    if (rootElementCount === 0) throw new XmlError("No root element found.", c.line, c.col);

    meta.entityRefs = Array.from(entitySet);
    meta.namespaces = Array.from(nsSet);
    return { ok: true, nodes: roots, validation: valid("Well-formed XML"), meta };
  } catch (e) {
    if (e instanceof XmlError) {
      meta.entityRefs = Array.from(entitySet);
      meta.namespaces = Array.from(nsSet);
      return {
        ok: false,
        nodes: roots,
        validation: { ...error("Invalid XML", e.message), line: e.line, column: e.col },
        meta,
      };
    }
    return { ok: false, nodes: roots, validation: error("Invalid XML", "Could not parse."), meta };
  }
}

function readName(c: Cursor): string {
  if (!NAME_START.test(c.peek())) throw new XmlError("Expected a tag name.", c.line, c.col);
  const start = c.i;
  c.advance();
  while (!c.eof() && NAME_CHAR.test(c.peek())) c.advance();
  return c.s.slice(start, c.i);
}

function readOpenTag(
  c: Cursor,
  meta: XmlMeta,
  nsSet: Set<string>
): Extract<XmlNode, { type: "element" }> {
  const tagLine = c.line;
  c.advance(); // "<"
  const name = readName(c);
  const attrs: XmlAttr[] = [];
  const seen = new Set<string>();

  for (;;) {
    c.skipWs();
    const ch = c.peek();
    if (ch === "") throw new XmlError(`Unclosed tag <${name}>.`, tagLine, 1);
    if (ch === ">") {
      c.advance();
      return { type: "element", name, attrs, children: [], selfClose: false };
    }
    if (ch === "/" && c.peek(1) === ">") {
      c.advance(2);
      return { type: "element", name, attrs, children: [], selfClose: true };
    }
    // Attribute.
    const aLine = c.line;
    const attrName = readName(c);
    c.skipWs();
    if (c.peek() !== "=")
      throw new XmlError(`Attribute "${attrName}" is missing a value.`, c.line, c.col);
    c.advance();
    c.skipWs();
    const quote = c.peek();
    if (quote !== '"' && quote !== "'")
      throw new XmlError(`Attribute "${attrName}" value must be quoted.`, c.line, c.col);
    c.advance();
    const vStart = c.i;
    while (!c.eof() && c.peek() !== quote) c.advance();
    if (c.eof())
      throw new XmlError(`Unterminated attribute value for "${attrName}".`, c.line, c.col);
    const value = c.s.slice(vStart, c.i);
    c.advance(); // closing quote

    if (seen.has(attrName))
      meta.duplicateAttributes.push({ element: name, attr: attrName, line: aLine });
    seen.add(attrName);
    attrs.push({ name: attrName, value });
    if (attrName === "xmlns") nsSet.add(`(default) = ${value}`);
    else if (attrName.startsWith("xmlns:")) nsSet.add(`${attrName.slice(6)} = ${value}`);
  }
}

function readCloseTag(c: Cursor): { name: string } {
  c.advance(2); // "</"
  const name = readName(c);
  c.skipWs();
  if (c.peek() !== ">") throw new XmlError(`Malformed closing tag </${name}>.`, c.line, c.col);
  c.advance();
  return { name };
}

function readProcessingInstruction(c: Cursor): {
  target: string;
  value: string;
  isDeclaration: boolean;
} {
  const end = c.s.indexOf("?>", c.i + 2);
  if (end === -1)
    throw new XmlError("Unterminated processing instruction (missing '?>').", c.line, c.col);
  const inner = c.s.slice(c.i + 2, end);
  c.advance(end + 2 - c.i);
  const sp = inner.search(/\s/);
  const target = sp === -1 ? inner : inner.slice(0, sp);
  const value = sp === -1 ? "" : inner.slice(sp + 1);
  return { target, value, isDeclaration: target.toLowerCase() === "xml" };
}

function readDoctype(c: Cursor): string {
  // Read to the matching ">", allowing a single "[ ... ]" internal subset.
  const start = c.i;
  c.advance(2); // "<!"
  let depth = 0;
  while (!c.eof()) {
    const ch = c.peek();
    if (ch === "[") depth++;
    else if (ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === ">" && depth === 0) {
      c.advance();
      return c.s.slice(start, c.i);
    }
    c.advance();
  }
  throw new XmlError("Unterminated DOCTYPE.", c.line, c.col);
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface XmlStats {
  elements: number;
  attributes: number;
  textNodes: number;
  comments: number;
  cdata: number;
  maxDepth: number;
}

export function analyzeXml(nodes: XmlNode[]): XmlStats {
  const stats: XmlStats = {
    elements: 0,
    attributes: 0,
    textNodes: 0,
    comments: 0,
    cdata: 0,
    maxDepth: 0,
  };
  const walk = (list: XmlNode[], depth: number): void => {
    for (const node of list) {
      switch (node.type) {
        case "element":
          stats.elements++;
          stats.attributes += node.attrs.length;
          if (depth > stats.maxDepth) stats.maxDepth = depth;
          walk(node.children, depth + 1);
          break;
        case "text":
          if (node.value.trim() !== "") stats.textNodes++;
          break;
        case "comment":
          stats.comments++;
          break;
        case "cdata":
          stats.cdata++;
          break;
      }
    }
  };
  walk(nodes, 1);
  return stats;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export type XmlIndent = "2" | "4" | "tab";

export interface XmlFormatOptions {
  indent: XmlIndent;
  minify?: boolean;
}

function indentUnit(indent: XmlIndent): string {
  return indent === "tab" ? "\t" : " ".repeat(Number(indent));
}

function serializeAttrValue(value: string): string {
  // Preserve existing entities; only normalise the surrounding quote at serialisation. Prefer double
  // quotes, fall back to single quotes when the value has a double quote, and escape only when the
  // value contains both (so the output is always well-formed).
  if (!value.includes('"')) return `"${value}"`;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/"/g, "&quot;")}"`;
}

function serializeAttrs(attrs: XmlAttr[]): string {
  return attrs.map((a) => ` ${a.name}=${serializeAttrValue(a.value)}`).join("");
}

/** True when an element contains only text/cdata (no child elements) — render it inline. */
function isInlineElement(node: Extract<XmlNode, { type: "element" }>): boolean {
  return node.children.every((ch) => ch.type === "text" || ch.type === "cdata");
}

function serializeNodes(nodes: XmlNode[], depth: number, opts: XmlFormatOptions): string {
  const nl = opts.minify ? "" : "\n";
  const pad = opts.minify ? "" : indentUnit(opts.indent).repeat(depth);
  const lines: string[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text": {
        const t = node.value.trim();
        if (t !== "") lines.push(pad + t);
        break;
      }
      case "comment":
        lines.push(`${pad}<!--${node.value}-->`);
        break;
      case "cdata":
        lines.push(`${pad}<![CDATA[${node.value}]]>`);
        break;
      case "pi":
        lines.push(`${pad}<?${node.target}${node.value ? " " + node.value : ""}?>`);
        break;
      case "declaration":
        lines.push(`${pad}<?xml${node.value ? " " + node.value.replace(/^xml\s*/i, "") : ""}?>`);
        break;
      case "doctype":
        lines.push(`${pad}${node.value}`);
        break;
      case "element": {
        const open = `<${node.name}${serializeAttrs(node.attrs)}`;
        if (node.selfClose || node.children.length === 0) {
          lines.push(`${pad}${open}/>`);
        } else if (isInlineElement(node)) {
          const inner = node.children
            .map((ch) =>
              ch.type === "cdata"
                ? `<![CDATA[${ch.value}]]>`
                : ch.type === "text"
                  ? ch.value.trim()
                  : ""
            )
            .join("");
          lines.push(`${pad}${open}>${inner}</${node.name}>`);
        } else {
          lines.push(`${pad}${open}>`);
          lines.push(serializeNodes(node.children, depth + 1, opts));
          lines.push(`${pad}</${node.name}>`);
        }
        break;
      }
    }
  }
  return lines.filter((l) => l !== "").join(nl);
}

export interface XmlFormatResult {
  ok: boolean;
  output: string;
  validation: Validation;
  nodes: XmlNode[];
  meta: XmlMeta;
}

/** Parse and re-serialise XML with pretty-print or minify. */
export function formatXml(input: string, options: XmlFormatOptions): XmlFormatResult {
  const parsed = parseXmlDocument(input);
  if (!parsed.ok) {
    return {
      ok: false,
      output: "",
      validation: parsed.validation,
      nodes: parsed.nodes,
      meta: parsed.meta,
    };
  }
  const output = serializeNodes(parsed.nodes, 0, options);
  return {
    ok: true,
    output,
    validation: parsed.validation,
    nodes: parsed.nodes,
    meta: parsed.meta,
  };
}

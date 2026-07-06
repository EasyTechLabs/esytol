import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Focused Markdown → React renderer for Learn Center articles. Supports exactly
 * the constructs the articles use: h2/h3 headings, paragraphs, ordered and
 * unordered lists, tables, blockquotes, horizontal rules, and inline bold,
 * italics, inline code, and links (internal via next/link, external via anchor).
 *
 * The body H1 is intentionally skipped — the page renders its own <h1> from the
 * frontmatter title, so there is exactly one H1 per page.
 *
 * Content is authored in-repo and therefore trusted; this renderer builds a
 * React tree (no dangerouslySetInnerHTML) so internal links are real <Link>s.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let k = 0;

  const patterns: { type: "code" | "link" | "bold" | "ital"; re: RegExp }[] = [
    { type: "code", re: /`([^`]+)`/ },
    { type: "link", re: /\[([^\]]+)\]\(([^)]+)\)/ },
    { type: "bold", re: /\*\*([^*]+)\*\*/ },
    { type: "ital", re: /_([^_]+)_/ },
  ];

  while (rest.length > 0) {
    let best: { type: string; m: RegExpExecArray } | null = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) best = { type: p.type, m };
    }
    if (best === null) {
      nodes.push(rest);
      break;
    }
    const { type, m } = best;
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const key = `${keyBase}-${k++}`;

    if (type === "code") {
      nodes.push(
        <code
          key={key}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-700"
        >
          {m[1]}
        </code>
      );
    } else if (type === "link") {
      const label = m[1];
      const href = m[2];
      if (/^https?:/.test(href)) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 underline underline-offset-2 transition-colors hover:text-brand-700"
          >
            {inline(label, key)}
          </a>
        );
      } else {
        nodes.push(
          <Link
            key={key}
            href={href}
            className="text-brand-600 underline underline-offset-2 transition-colors hover:text-brand-700"
          >
            {inline(label, key)}
          </Link>
        );
      }
    } else if (type === "bold") {
      nodes.push(
        <strong key={key} className="font-semibold text-gray-900">
          {inline(m[1], key)}
        </strong>
      );
    } else {
      nodes.push(<em key={key}>{inline(m[1], key)}</em>);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isSpecial(line: string): boolean {
  return /^(#{1,6}\s|>\s?|\d+\.\s|[-*]\s|\|)/.test(line) || /^---+$/.test(line.trim());
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1) {
        i++;
        continue; // body H1 skipped (title rendered by the page)
      }
      const id = slugify(text);
      const kb = `h-${key++}`;
      if (level === 2) {
        out.push(
          <h2 key={kb} id={id} className="mt-10 scroll-mt-24 text-2xl font-bold text-gray-900">
            {inline(text, kb)}
          </h2>
        );
      } else {
        out.push(
          <h3 key={kb} id={id} className="mt-8 scroll-mt-24 text-lg font-semibold text-gray-900">
            {inline(text, kb)}
          </h3>
        );
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={`hr-${key++}`} className="my-8 border-gray-200" />);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const kb = `bq-${key++}`;
      out.push(
        <blockquote
          key={kb}
          className="mt-5 border-l-4 border-brand-200 bg-brand-50 px-4 py-3 text-gray-700"
        >
          {inline(buf.join(" "), kb)}
        </blockquote>
      );
      continue;
    }

    // Table
    if (
      /^\|/.test(line) &&
      i + 1 < lines.length &&
      /-/.test(lines[i + 1]) &&
      /^\|?[\s:|-]+$/.test(lines[i + 1].trim())
    ) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const kb = `tbl-${key++}`;
      out.push(
        <div key={kb} className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {header.map((c, ci) => (
                  <th
                    key={ci}
                    scope="col"
                    className="px-4 py-2.5 text-left font-semibold text-gray-700"
                  >
                    {inline(c, `${kb}-h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, ri) => (
                <tr key={ri} className="align-top">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-gray-600">
                      {inline(c, `${kb}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      const kb = `ol-${key++}`;
      out.push(
        <ol key={kb} className="mt-4 list-decimal space-y-2 pl-6 text-gray-700">
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed">
              {inline(it, `${kb}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      const kb = `ul-${key++}`;
      out.push(
        <ul key={kb} className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed">
              {inline(it, `${kb}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    const kb = `p-${key++}`;
    out.push(
      <p key={kb} className="mt-4 leading-relaxed text-gray-700">
        {inline(buf.join(" "), kb)}
      </p>
    );
  }

  return <>{out}</>;
}

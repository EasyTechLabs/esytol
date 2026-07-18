"use client";

/**
 * CSV table preview — for the CSV ↔ JSON Converter (DEVELOPER-005).
 *
 * Renders a `CsvTable` (header + rows) as an accessible HTML table with search + match highlighting.
 * Lazy by row: only the first `MAX_VISIBLE_ROWS` are rendered so a huge file stays responsive; a
 * notice reports how many rows are hidden. Cells are rendered as text — a formula is never executed.
 */

import { useMemo, useState } from "react";
import type { CsvTable } from "@/lib/dev/csv";

const MAX_VISIBLE_ROWS = 200;

export function CsvTablePreview({ table }: { table: CsvTable }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (q === "") return 0;
    let n = 0;
    for (const h of table.header) if (h.toLowerCase().includes(q)) n++;
    for (const row of table.rows) for (const c of row) if (c.toLowerCase().includes(q)) n++;
    return n;
  }, [table, q]);

  const visibleRows = table.rows.slice(0, MAX_VISIBLE_ROWS);
  const hidden = table.rows.length - visibleRows.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cells…"
          aria-label="Search the table"
          className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800"
        />
        {q !== "" && (
          <span className="text-xs text-gray-500" role="status">
            {matches} match{matches === 1 ? "" : "es"}
          </span>
        )}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">CSV data preview</caption>
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th
                scope="col"
                className="border-b border-gray-200 px-2 py-1.5 text-right text-xs font-medium text-gray-400"
              >
                #
              </th>
              {table.header.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="whitespace-nowrap border-b border-l border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-800"
                >
                  <Highlight text={h} query={q} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, r) => (
              <tr key={r} className="even:bg-gray-50/50">
                <td className="px-2 py-1 text-right text-xs tabular-nums text-gray-400">{r + 1}</td>
                {table.header.map((_, c) => (
                  <td
                    key={c}
                    className="max-w-[20rem] truncate border-l border-gray-100 px-3 py-1 text-gray-700"
                    title={row[c] ?? ""}
                  >
                    <Highlight text={row[c] ?? ""} query={q} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Showing the first {MAX_VISIBLE_ROWS.toLocaleString()} of{" "}
          {table.rows.length.toLocaleString()} rows. The full data is in the output above and the
          download.
        </p>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (query === "" || !text.toLowerCase().includes(query)) return <>{text}</>;
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
  return <>{parts}</>;
}

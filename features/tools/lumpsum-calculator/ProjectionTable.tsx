"use client";

import { useState, useCallback } from "react";
import type { LumpsumProjectionRow } from "@/lib/lumpsum";
import { projectionToCSV, downloadCSV, formatINR } from "@/lib/lumpsum";
import { cn } from "@/lib/cn";

interface ProjectionTableProps {
  rows: LumpsumProjectionRow[];
}

const INITIAL_VISIBLE = 15;

const COLUMNS = ["Year", "Opening Value", "Growth", "Closing Value"] as const;

export function ProjectionTable({ rows }: ProjectionTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hasMore = rows.length > INITIAL_VISIBLE;

  const handleDownload = useCallback(() => {
    const csv = projectionToCSV(rows);
    downloadCSV(csv, "lumpsum-projection.csv");
  }, [rows]);

  return (
    <section aria-labelledby="lumpsum-projection-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="lumpsum-projection-heading" className="text-lg font-semibold text-gray-900">
          Year-wise Projection
        </h2>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm" aria-label="Year-wise lumpsum projection">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {displayed.map((row) => (
              <tr key={row.year} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{row.year}</td>
                <td className="px-4 py-2.5 tabular-nums text-gray-700">
                  {formatINR(row.openingValue)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 tabular-nums",
                    row.growth >= 0 ? "text-green-700" : "text-red-600"
                  )}
                >
                  {formatINR(row.growth)}
                </td>
                <td className="px-4 py-2.5 font-medium tabular-nums text-brand-700">
                  {formatINR(row.closingValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-sm text-brand-600 hover:underline"
          >
            {showAll ? "Show first 15 years" : `Show all ${rows.length} rows`}
          </button>
        </div>
      )}
    </section>
  );
}

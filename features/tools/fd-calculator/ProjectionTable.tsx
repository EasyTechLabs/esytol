"use client";

import { useState, useCallback } from "react";
import type { FDProjectionRow } from "@/lib/fd";
import { projectionToCSV, downloadCSV, formatINR } from "@/lib/fd";

interface ProjectionTableProps {
  rows: FDProjectionRow[];
  unitLabel: string;
}

const INITIAL_VISIBLE = 12;

export function ProjectionTable({ rows, unitLabel }: ProjectionTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hasMore = rows.length > INITIAL_VISIBLE;

  const handleDownload = useCallback(() => {
    const csv = projectionToCSV(rows, unitLabel);
    downloadCSV(csv, "fd-projection.csv");
  }, [rows, unitLabel]);

  const columns = [unitLabel, "Opening Balance", "Interest Earned", "Closing Balance"];

  return (
    <section aria-labelledby="fd-projection-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="fd-projection-heading" className="text-lg font-semibold text-gray-900">
          {unitLabel}-wise Growth
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
        <table className="min-w-full text-sm" aria-label={`${unitLabel}-wise FD growth schedule`}>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
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
              <tr key={row.period} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{row.period}</td>
                <td className="px-4 py-2.5 tabular-nums text-gray-700">
                  {formatINR(row.openingBalance)}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-amber-700">
                  {formatINR(row.interestEarned)}
                </td>
                <td className="px-4 py-2.5 font-medium tabular-nums text-brand-700">
                  {formatINR(row.closingBalance)}
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
            {showAll
              ? `Show first 12 ${unitLabel.toLowerCase()}s`
              : `Show all ${rows.length} periods`}
          </button>
        </div>
      )}
    </section>
  );
}

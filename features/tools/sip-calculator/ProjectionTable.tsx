"use client";

import { useState, useCallback } from "react";
import type { SIPProjectionRow } from "@/lib/sip";
import { projectionToCSV, downloadCSV, formatINR } from "@/lib/sip";

interface ProjectionTableProps {
  rows: SIPProjectionRow[];
  monthlyAmount: number;
}

const INITIAL_VISIBLE = 12;

const COLUMNS = ["Month", "Total Invested", "Interest Earned", "Portfolio Value"] as const;

export function ProjectionTable({ rows, monthlyAmount }: ProjectionTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hasMore = rows.length > INITIAL_VISIBLE;

  const handleDownload = useCallback(() => {
    const csv = projectionToCSV(rows, monthlyAmount);
    downloadCSV(csv, "sip-projection.csv");
  }, [rows, monthlyAmount]);

  return (
    <section aria-labelledby="sip-projection-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="sip-projection-heading" className="text-lg font-semibold text-gray-900">
          Month-wise Projection
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
        <table className="min-w-full text-sm" aria-label="Month-wise SIP projection">
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
              <tr key={row.month} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{row.month}</td>
                <td className="px-4 py-2.5 tabular-nums text-gray-700">
                  {formatINR(row.totalInvested)}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-amber-700">
                  {formatINR(row.interestEarned)}
                </td>
                <td className="px-4 py-2.5 font-medium tabular-nums text-brand-700">
                  {formatINR(row.portfolioValue)}
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
            {showAll ? "Show first 12 months" : `Show all ${rows.length} months`}
          </button>
        </div>
      )}
    </section>
  );
}

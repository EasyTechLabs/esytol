"use client";

import { useState, useCallback } from "react";
import type { AmortizationRow } from "@/lib/emi";
import { scheduleToCSV, downloadCSV, formatINR } from "@/lib/emi";

interface AmortizationTableProps {
  rows: AmortizationRow[];
}

const INITIAL_VISIBLE = 12;

const COLUMNS = ["Month", "EMI", "Principal", "Interest", "Balance"] as const;

export function AmortizationTable({ rows }: AmortizationTableProps) {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hasMore = rows.length > INITIAL_VISIBLE;

  const handleDownload = useCallback(() => {
    const csv = scheduleToCSV(rows);
    downloadCSV(csv, "emi-amortization-schedule.csv");
  }, [rows]);

  return (
    <section aria-labelledby="amortization-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="amortization-heading" className="text-lg font-semibold text-gray-900">
          Amortization Schedule
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
        <table className="min-w-full text-sm">
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
                <td className="px-4 py-2.5 text-gray-700">{formatINR(row.emi)}</td>
                <td className="px-4 py-2.5 text-green-700">{formatINR(row.principal)}</td>
                <td className="px-4 py-2.5 text-orange-700">{formatINR(row.interest)}</td>
                <td className="px-4 py-2.5 text-gray-700">{formatINR(row.balance)}</td>
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

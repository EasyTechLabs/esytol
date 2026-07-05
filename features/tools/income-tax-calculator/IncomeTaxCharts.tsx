"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { IncomeTaxResult, TaxRegime } from "@/lib/incomeTax";
import { formatINR } from "@/lib/incomeTax";

interface Props {
  result: IncomeTaxResult;
  regime: TaxRegime;
}

const COLORS = {
  tax: "#3b82f6", // brand-500
  surcharge: "#6366f1", // indigo-500
  cess: "#f59e0b", // amber-400
  takeHome: "#10b981", // emerald-500
  old: "#f59e0b",
  new: "#3b82f6",
};

function fmtShort(v: number): string {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export function IncomeTaxCharts({ result, regime }: Props) {
  const r = result[regime];
  const fmtTooltip = (value: number) => [formatINR(value), ""];

  const breakdown = [
    { name: "Income Tax", value: r.taxAfterRebate, color: COLORS.tax },
    { name: "Surcharge", value: r.surcharge, color: COLORS.surcharge },
    { name: "Cess", value: r.cess, color: COLORS.cess },
  ].filter((d) => d.value > 0);

  const incomeVsTax = [
    { name: "Take-home", value: Math.max(0, r.grossIncome - r.totalTax), color: COLORS.takeHome },
    { name: "Total Tax", value: r.totalTax, color: COLORS.tax },
  ].filter((d) => d.value > 0);

  const comparison = [
    { name: "Old Regime", tax: result.old.totalTax },
    { name: "New Regime", tax: result.new.totalTax },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Tax Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Tax Breakdown</h3>
          <p className="mb-3 text-xs text-gray-400">
            {regime === "new" ? "New" : "Old"} regime — tax, surcharge & cess
          </p>
          <ResponsiveContainer width="100%" height={200}>
            {breakdown.length > 0 ? (
              <PieChart>
                <Pie
                  data={breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {breakdown.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={fmtTooltip} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                No tax payable 🎉
              </div>
            )}
          </ResponsiveContainer>
        </div>

        {/* Income vs Tax */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Income vs Tax</h3>
          <p className="mb-3 text-xs text-gray-400">How much of your income is tax</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={incomeVsTax}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {incomeVsTax.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip formatter={fmtTooltip} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regime Comparison */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Regime Comparison</h3>
        <p className="mb-3 text-xs text-gray-400">Total tax — Old vs New regime</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comparison} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={fmtShort}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip formatter={fmtTooltip} cursor={{ fill: "#f9fafb" }} />
            <Bar dataKey="tax" radius={[6, 6, 0, 0]} maxBarSize={110}>
              <Cell fill={COLORS.old} />
              <Cell fill={COLORS.new} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

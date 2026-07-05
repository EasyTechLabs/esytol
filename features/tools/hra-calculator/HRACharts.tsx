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
import type { HRAInput, HRAResult } from "@/lib/hra";
import { formatINR } from "@/lib/hra";

interface Props {
  input: HRAInput;
  result: HRAResult;
}

const COLORS = {
  exempt: "#10b981", // emerald-500
  taxable: "#f59e0b", // amber-400
  basic: "#3b82f6", // brand-500
  hra: "#6366f1", // indigo-500
  other: "#94a3b8", // slate-400
  winner: "#10b981",
  bar: "#3b82f6",
};

function fmtShort(v: number): string {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export function HRACharts({ input, result }: Props) {
  const fmtTooltip = (value: number) => [formatINR(value), ""];

  const exemptVsTaxable = [
    { name: "Exempt HRA", value: result.hraExemption, color: COLORS.exempt },
    { name: "Taxable HRA", value: result.taxableHRA, color: COLORS.taxable },
  ].filter((d) => d.value > 0);

  const otherSalary = Math.max(0, input.annualSalary - input.basicSalary - input.hraReceived);
  const composition = [
    { name: "Basic Salary", value: input.basicSalary, color: COLORS.basic },
    { name: "HRA Received", value: input.hraReceived, color: COLORS.hra },
    { name: "Other Salary", value: otherSalary, color: COLORS.other },
  ].filter((d) => d.value > 0);

  const rulesData = result.rules.map((r) => ({
    name: r.key === "actual" ? "Actual HRA" : r.key === "rentExcess" ? "Rent − 10%" : "% of Basic",
    value: r.value,
    isWinner: r.isWinner,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* HRA Exempt vs Taxable */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">HRA Exempt vs Taxable</h3>
          <p className="mb-3 text-xs text-gray-400">How much of your HRA is tax-free</p>
          <ResponsiveContainer width="100%" height={200}>
            {exemptVsTaxable.length > 0 ? (
              <PieChart>
                <Pie
                  data={exemptVsTaxable}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {exemptVsTaxable.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={fmtTooltip} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                No HRA to exempt
              </div>
            )}
          </ResponsiveContainer>
        </div>

        {/* Salary Composition */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Salary Composition</h3>
          <p className="mb-3 text-xs text-gray-400">Basic, HRA & the rest of your salary</p>
          <ResponsiveContainer width="100%" height={200}>
            {composition.length > 0 ? (
              <PieChart>
                <Pie
                  data={composition}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {composition.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={fmtTooltip} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Enter your salary details
              </div>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Three Rules comparison */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">The Three HRA Rules</h3>
        <p className="mb-3 text-xs text-gray-400">
          Exemption is the lowest bar (highlighted in green)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rulesData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={90}>
              {rulesData.map((d) => (
                <Cell key={d.name} fill={d.isWinner ? COLORS.winner : COLORS.bar} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

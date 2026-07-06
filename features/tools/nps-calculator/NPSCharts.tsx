"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { NPSResult } from "@/lib/nps";
import { formatINR } from "@/lib/nps";

interface Props {
  result: NPSResult;
}

const COLORS = {
  contributions: "#3b82f6", // brand-500
  returns: "#10b981", // emerald-500
  lumpSum: "#f59e0b", // amber-400
  annuity: "#6366f1", // indigo-500
  area: "#3b82f6",
};

function fmtShort(v: number): string {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export function NPSCharts({ result }: Props) {
  const fmtTooltip = (value: number) => [formatINR(value), ""];

  const composition = [
    { name: "Total Contributions", value: result.totalContributions, color: COLORS.contributions },
    {
      name: "Estimated Returns",
      value: Math.max(0, result.estimatedReturns),
      color: COLORS.returns,
    },
  ].filter((d) => d.value > 0);

  const split = [
    {
      name: `Lump Sum (${result.lumpSumPct}%)`,
      value: result.lumpSumAmount,
      color: COLORS.lumpSum,
    },
    { name: `Annuity (${result.annuityPct}%)`, value: result.annuityCorpus, color: COLORS.annuity },
  ].filter((d) => d.value > 0);

  const growth = result.yearWise.map((r) => ({ age: r.age, balance: r.closingBalance }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Corpus Composition */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Corpus Composition</h3>
          <p className="mb-3 text-xs text-gray-400">Your contributions vs market returns</p>
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
                Enter your details
              </div>
            )}
          </ResponsiveContainer>
        </div>

        {/* Lump Sum vs Annuity */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Lump Sum vs Annuity</h3>
          <p className="mb-3 text-xs text-gray-400">How your corpus is split at retirement</p>
          <ResponsiveContainer width="100%" height={200}>
            {split.length > 0 ? (
              <PieChart>
                <Pie
                  data={split}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {split.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={fmtTooltip} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Enter your details
              </div>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Corpus Growth */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Corpus Growth</h3>
        <p className="mb-3 text-xs text-gray-400">Projected balance by age</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={growth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="npsGrowth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.area} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.area} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fill: "#6b7280" }}
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
            <Tooltip
              formatter={fmtTooltip}
              labelFormatter={(age) => `Age ${age}`}
              cursor={{ stroke: "#e5e7eb" }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={COLORS.area}
              strokeWidth={2}
              fill="url(#npsGrowth)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

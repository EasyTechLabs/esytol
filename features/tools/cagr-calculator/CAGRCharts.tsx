"use client";

import {
  BarChart,
  Bar,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { CAGRProjectionRow } from "@/lib/cagr";
import { formatINR } from "@/lib/cagr";

interface Props {
  beginningValue: number;
  endingValue: number;
  projection: CAGRProjectionRow[];
}

const COLORS = {
  beginning: "#94a3b8", // slate-400
  ending: "#3b82f6", // brand-500
  endingLoss: "#ef4444", // red-500
  curve: "#3b82f6",
};

function fmtShort(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function CAGRCharts({ beginningValue, endingValue, projection }: Props) {
  const isLoss = endingValue < beginningValue;

  const barData = [
    { name: "Beginning", value: beginningValue, fill: COLORS.beginning },
    { name: "Ending", value: endingValue, fill: isLoss ? COLORS.endingLoss : COLORS.ending },
  ];

  const curveData = [
    { year: 0, value: beginningValue },
    ...projection.map((r) => ({ year: r.year, value: r.projectedValue })),
  ];

  const fmtTooltip = (value: number) => [formatINR(value), ""];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Bar — Beginning vs Ending */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Beginning vs Ending Value</h3>
        <p className="mb-3 text-xs text-gray-400">Where your investment started and ended</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="name"
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
            <Tooltip formatter={fmtTooltip} cursor={{ fill: "#f9fafb" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={90}>
              {barData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Area — Growth Curve */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Growth Curve</h3>
        <p className="mb-3 text-xs text-gray-400">Projected value at the CAGR each year</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={curveData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cagrCurve" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.curve} stopOpacity={0.35} />
                <stop offset="95%" stopColor={COLORS.curve} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Year",
                position: "insideBottom",
                offset: -2,
                fontSize: 10,
                fill: "#9ca3af",
              }}
            />
            <YAxis
              tickFormatter={fmtShort}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip formatter={fmtTooltip} labelFormatter={(l) => `Year ${l}`} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={COLORS.curve}
              strokeWidth={2}
              fill="url(#cagrCurve)"
              name="Projected Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

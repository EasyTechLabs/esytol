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
import type { SIPProjectionRow } from "@/lib/sip";
import { formatINR } from "@/lib/sip";

interface Props {
  totalInvested: number;
  estimatedReturn: number;
  projection: SIPProjectionRow[];
}

const COLORS = {
  invested: "#3b82f6", // brand-500
  returns: "#f59e0b", // amber-400
  investedFill: "#dbeafe", // blue-100
  returnsFill: "#fef3c7", // amber-100
};

// Subsample projection to at most MAX_POINTS for chart performance.
function subsample(rows: SIPProjectionRow[], max = 60): SIPProjectionRow[] {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  const result = rows.filter((_, i) => i % step === 0);
  // Always include the last row.
  if (result[result.length - 1] !== rows[rows.length - 1]) {
    result.push(rows[rows.length - 1]);
  }
  return result;
}

function fmtShort(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function SIPCharts({ totalInvested, estimatedReturn, projection }: Props) {
  const donutData = [
    { name: "Total Invested", value: totalInvested },
    { name: "Estimated Returns", value: estimatedReturn },
  ];

  const chartData = subsample(projection).map((r) => ({
    month: r.month,
    totalInvested: r.totalInvested,
    interestEarned: r.interestEarned,
  }));

  const fmtTooltip = (value: number) => [formatINR(value), ""];
  const fmtAxis = (v: number) => fmtShort(v);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Donut — Invested vs Returns */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Invested vs Returns</h3>
        <p className="mb-3 text-xs text-gray-400">Wealth created vs capital deployed</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={COLORS.invested} />
              <Cell fill={COLORS.returns} />
            </Pie>
            <Tooltip formatter={fmtTooltip} />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Area — Portfolio Growth */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Portfolio Growth</h3>
        <p className="mb-3 text-xs text-gray-400">How your investment compounds over time</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sipInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.invested} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.invested} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="sipReturns" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.returns} stopOpacity={0.5} />
                <stop offset="95%" stopColor={COLORS.returns} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Month",
                position: "insideBottom",
                offset: -2,
                fontSize: 10,
                fill: "#9ca3af",
              }}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip formatter={fmtTooltip} labelFormatter={(l) => `Month ${l}`} />
            <Area
              type="monotone"
              dataKey="totalInvested"
              stackId="a"
              stroke={COLORS.invested}
              strokeWidth={1.5}
              fill="url(#sipInvested)"
              name="Total Invested"
            />
            <Area
              type="monotone"
              dataKey="interestEarned"
              stackId="a"
              stroke={COLORS.returns}
              strokeWidth={1.5}
              fill="url(#sipReturns)"
              name="Interest Earned"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

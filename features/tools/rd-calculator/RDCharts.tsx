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
import type { RDProjectionRow } from "@/lib/rd";
import { formatINR } from "@/lib/rd";

interface Props {
  totalDeposited: number;
  interestEarned: number;
  projection: RDProjectionRow[];
}

const COLORS = {
  deposited: "#3b82f6", // brand-500
  interest: "#f59e0b", // amber-400
};

// Subsample the projection to at most `max` points for chart performance.
function subsample(rows: RDProjectionRow[], max = 60): RDProjectionRow[] {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  const result = rows.filter((_, idx) => idx % step === 0);
  if (result[result.length - 1] !== rows[rows.length - 1]) {
    result.push(rows[rows.length - 1]);
  }
  return result;
}

function fmtShort(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function RDCharts({ totalDeposited, interestEarned, projection }: Props) {
  const donutData = [
    { name: "Total Deposited", value: totalDeposited },
    { name: "Interest Earned", value: interestEarned },
  ];

  const chartData = subsample(projection).map((r) => ({
    month: r.month,
    totalDeposited: r.totalDeposited,
    interestEarned: r.interestEarned,
  }));

  const fmtTooltip = (value: number) => [formatINR(value), ""];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Donut — Deposited vs Interest */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Deposited vs Interest</h3>
        <p className="mb-3 text-xs text-gray-400">How much of maturity is interest</p>
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
              <Cell fill={COLORS.deposited} />
              <Cell fill={COLORS.interest} />
            </Pie>
            <Tooltip formatter={fmtTooltip} />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Area — Deposit Growth Curve */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Deposit Growth Curve</h3>
        <p className="mb-3 text-xs text-gray-400">How your recurring deposit compounds</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rdDeposited" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.deposited} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.deposited} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="rdInterest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.interest} stopOpacity={0.5} />
                <stop offset="95%" stopColor={COLORS.interest} stopOpacity={0.1} />
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
              tickFormatter={fmtShort}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip formatter={fmtTooltip} labelFormatter={(l) => `Month ${l}`} />
            <Area
              type="monotone"
              dataKey="totalDeposited"
              stackId="a"
              stroke={COLORS.deposited}
              strokeWidth={1.5}
              fill="url(#rdDeposited)"
              name="Total Deposited"
            />
            <Area
              type="monotone"
              dataKey="interestEarned"
              stackId="a"
              stroke={COLORS.interest}
              strokeWidth={1.5}
              fill="url(#rdInterest)"
              name="Interest Earned"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

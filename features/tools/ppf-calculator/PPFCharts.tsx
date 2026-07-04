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
import type { PPFProjectionRow } from "@/lib/ppf";
import { formatINR } from "@/lib/ppf";

interface Props {
  openingBalance: number;
  totalContribution: number;
  totalInterest: number;
  yearlyContribution: number;
  projection: PPFProjectionRow[];
}

const COLORS = {
  opening: "#6366f1", // indigo-500
  contribution: "#3b82f6", // brand-500
  interest: "#f59e0b", // amber-400
};

function fmtShort(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function PPFCharts({
  openingBalance,
  totalContribution,
  totalInterest,
  yearlyContribution,
  projection,
}: Props) {
  // Donut — Contribution vs Interest (plus Opening Balance when present).
  const donutData = [
    ...(openingBalance > 0 ? [{ name: "Opening Balance", value: openingBalance }] : []),
    { name: "Total Contribution", value: totalContribution },
    { name: "Total Interest", value: totalInterest },
  ];
  const donutColors =
    openingBalance > 0
      ? [COLORS.opening, COLORS.contribution, COLORS.interest]
      : [COLORS.contribution, COLORS.interest];

  // Portfolio growth — split each year's closing into invested vs interest.
  const chartData = projection.map((r) => {
    const invested = openingBalance + yearlyContribution * r.year;
    return {
      year: r.year,
      invested,
      interest: Math.max(0, r.closingBalance - invested),
    };
  });

  const fmtTooltip = (value: number) => [formatINR(value), ""];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Donut — Contribution vs Interest */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Contribution vs Interest</h3>
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
              {donutData.map((_, idx) => (
                <Cell key={idx} fill={donutColors[idx]} />
              ))}
            </Pie>
            <Tooltip formatter={fmtTooltip} />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked Area — Portfolio Growth */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Portfolio Growth</h3>
        <p className="mb-3 text-xs text-gray-400">How your PPF compounds over the years</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ppfInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.contribution} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.contribution} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="ppfInterest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.interest} stopOpacity={0.5} />
                <stop offset="95%" stopColor={COLORS.interest} stopOpacity={0.1} />
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
              dataKey="invested"
              stackId="a"
              stroke={COLORS.contribution}
              strokeWidth={1.5}
              fill="url(#ppfInvested)"
              name="Invested"
            />
            <Area
              type="monotone"
              dataKey="interest"
              stackId="a"
              stroke={COLORS.interest}
              strokeWidth={1.5}
              fill="url(#ppfInterest)"
              name="Interest"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

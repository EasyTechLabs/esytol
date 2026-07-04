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
import type { LumpsumProjectionRow } from "@/lib/lumpsum";
import { formatINR } from "@/lib/lumpsum";

interface Props {
  initialInvestment: number;
  estimatedReturns: number;
  maturityValue: number;
  projection: LumpsumProjectionRow[];
}

const COLORS = {
  principal: "#3b82f6", // brand-500
  returns: "#f59e0b", // amber-400
  remaining: "#10b981", // emerald-500
  loss: "#ef4444", // red-500
};

function fmtShort(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function LumpsumCharts({
  initialInvestment,
  estimatedReturns,
  maturityValue,
  projection,
}: Props) {
  const isLoss = estimatedReturns < 0;

  // On a gain: how much of maturity is returns (Principal + Returns = Maturity).
  // On a loss: how much of the principal remains vs was lost (Remaining + Loss = Principal).
  const donutData = isLoss
    ? [
        { name: "Remaining", value: Math.max(0, maturityValue) },
        { name: "Loss", value: Math.abs(estimatedReturns) },
      ]
    : [
        { name: "Initial Investment", value: initialInvestment },
        { name: "Estimated Returns", value: estimatedReturns },
      ];
  const donutColors = isLoss ? [COLORS.remaining, COLORS.loss] : [COLORS.principal, COLORS.returns];

  const curveData = [
    { year: 0, value: initialInvestment },
    ...projection.map((r) => ({ year: r.year, value: r.closingValue })),
  ];

  const fmtTooltip = (value: number) => [formatINR(value), ""];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Donut — Principal vs Returns */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Principal vs Returns</h3>
        <p className="mb-3 text-xs text-gray-400">
          {isLoss ? "How much of your principal remains" : "How much of maturity is returns"}
        </p>
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

      {/* Area — Portfolio Growth Curve */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Portfolio Growth Curve</h3>
        <p className="mb-3 text-xs text-gray-400">
          Projected value at the expected return each year
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={curveData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="lumpsumCurve" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.principal} stopOpacity={0.35} />
                <stop offset="95%" stopColor={COLORS.principal} stopOpacity={0.05} />
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
              stroke={COLORS.principal}
              strokeWidth={2}
              fill="url(#lumpsumCurve)"
              name="Portfolio Value"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

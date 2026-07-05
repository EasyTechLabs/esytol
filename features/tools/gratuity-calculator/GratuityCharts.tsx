"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { GratuityInput, GratuityResult } from "@/lib/gratuity";
import { formatINR, gratuityAtService, GRATUITY_CAP } from "@/lib/gratuity";

interface Props {
  input: GratuityInput;
  result: GratuityResult;
}

const COLORS = {
  area: "#3b82f6", // brand-500
  covered: "#3b82f6",
  notCovered: "#6366f1", // indigo-500
  cap: "#ef4444", // red-500
};

function fmtShort(v: number): string {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
}

export function GratuityCharts({ input, result }: Props) {
  const fmtTooltip = (value: number) => [formatINR(value), ""];
  const salary = Math.max(0, input.monthlyBasic);
  const years = Math.max(0, Math.floor(input.years));

  const growth = [5, 10, 15, 20, 25, 30, 35, 40].map((y) => ({
    years: y,
    amount: gratuityAtService(salary, y, result.coveredUnderAct),
  }));

  const comparison = [
    { name: "Covered (÷26)", amount: gratuityAtService(salary, years, true) },
    { name: "Not Covered (÷30)", amount: gratuityAtService(salary, years, false) },
  ];

  const showCapLine = growth.some((g) => g.amount >= GRATUITY_CAP);

  return (
    <div className="flex flex-col gap-6">
      {/* Gratuity by Years of Service */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Gratuity by Years of Service</h3>
        <p className="mb-3 text-xs text-gray-400">
          At your current salary &amp; coverage {showCapLine && "(dashed line = ₹20 lakh cap)"}
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={growth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gratuityGrowth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.area} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.area} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="years"
              tickFormatter={(y) => `${y}y`}
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
              labelFormatter={(y) => `${y} years of service`}
              cursor={{ stroke: "#e5e7eb" }}
            />
            {showCapLine && (
              <ReferenceLine y={GRATUITY_CAP} stroke={COLORS.cap} strokeDasharray="4 4" />
            )}
            <Area
              type="monotone"
              dataKey="amount"
              stroke={COLORS.area}
              strokeWidth={2}
              fill="url(#gratuityGrowth)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Covered vs Not Covered */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Covered vs Not Covered</h3>
        <p className="mb-3 text-xs text-gray-400">
          Same salary &amp; years — the divisor (26 vs 30) changes the payout
        </p>
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
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={110}>
              <Cell fill={COLORS.covered} />
              <Cell fill={COLORS.notCovered} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

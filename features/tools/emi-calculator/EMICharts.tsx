"use client";

import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { AmortizationRow } from "@/lib/emi";
import { formatINR } from "@/lib/emi";

interface EMIChartsProps {
  principal: number;
  totalInterest: number;
  schedule: AmortizationRow[];
}

const PIE_COLORS = ["#3b82f6", "#f97316"];

export function EMICharts({ principal, totalInterest, schedule }: EMIChartsProps) {
  const pieData = [
    { name: "Principal", value: principal },
    { name: "Interest", value: totalInterest },
  ];

  const balanceData = schedule.map((row) => ({
    month: row.month,
    balance: row.balance,
  }));

  return (
    <section aria-label="Loan breakdown charts" className="grid gap-6 sm:grid-cols-2">
      {/* Principal vs Interest donut */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Principal vs Interest</h2>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              paddingAngle={2}
            >
              {pieData.map((_, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [formatINR(v), ""]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Outstanding balance area chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Outstanding Balance</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={balanceData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              label={{ value: "Month", position: "insideBottom", offset: -12, fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) =>
                v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${(v / 1000).toFixed(0)}k`
              }
              width={55}
            />
            <Tooltip formatter={(v: number) => [formatINR(v), "Balance"]} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#3b82f6"
              fill="#bfdbfe"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

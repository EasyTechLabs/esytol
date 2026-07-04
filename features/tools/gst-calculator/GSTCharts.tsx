"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatINR } from "@/lib/gst";

interface Props {
  originalAmount: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  rate: number;
}

const COLORS = {
  original: "#3b82f6", // brand-500
  gst: "#f59e0b", // amber-400
  cgst: "#f59e0b",
  sgst: "#fbbf24", // amber-300
};

export function GSTCharts({ originalAmount, gstAmount, cgst, sgst, rate }: Props) {
  const splitData = [
    { name: "Original Amount", value: originalAmount },
    { name: `GST (${rate}%)`, value: gstAmount },
  ];

  const taxData = [
    { name: `CGST (${rate / 2}%)`, value: cgst },
    { name: `SGST (${rate / 2}%)`, value: sgst },
  ];

  const fmtTooltip = (value: number) => [formatINR(value), ""];

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Donut — Amount vs GST */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Amount vs Tax</h3>
        <p className="mb-3 text-xs text-gray-400">How much of your total is tax</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={splitData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={COLORS.original} />
              <Cell fill={COLORS.gst} />
            </Pie>
            <Tooltip formatter={fmtTooltip} />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Donut — CGST vs SGST */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">CGST vs SGST</h3>
        <p className="mb-3 text-xs text-gray-400">Intra-state tax component split</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={taxData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={COLORS.cgst} />
              <Cell fill={COLORS.sgst} />
            </Pie>
            <Tooltip formatter={fmtTooltip} />
            <Legend iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

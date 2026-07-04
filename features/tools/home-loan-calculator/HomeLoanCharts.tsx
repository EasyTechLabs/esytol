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
import type { AmortizationRow } from "@/lib/homeLoan";
import { formatINR } from "@/lib/homeLoan";

interface Props {
  loanAmount: number;
  totalInterest: number;
  schedule: AmortizationRow[];
}

const COLORS = {
  principal: "#3b82f6", // brand-500
  interest: "#f59e0b", // amber-400
  balance: "#6366f1", // indigo-500
};

// Subsample any series to at most `max` points for chart performance.
function subsample<T>(rows: T[], max = 60): T[] {
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

export function HomeLoanCharts({ loanAmount, totalInterest, schedule }: Props) {
  const donutData = [
    { name: "Principal", value: loanAmount },
    { name: "Interest", value: totalInterest },
  ];

  const sampled = subsample(schedule);

  // Outstanding balance curve.
  const balanceData = [
    { month: 0, balance: loanAmount },
    ...sampled.map((r) => ({ month: r.month, balance: r.balance })),
  ];

  // Loan payoff curve — cumulative principal vs cumulative interest paid.
  let cumPrincipal = 0;
  let cumInterest = 0;
  const payoffFull = schedule.map((r) => {
    cumPrincipal += r.principal;
    cumInterest += r.interest;
    return { month: r.month, principalPaid: cumPrincipal, interestPaid: cumInterest };
  });
  const payoffData = subsample(payoffFull);

  const fmtTooltip = (value: number) => [formatINR(value), ""];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Donut — Principal vs Interest */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Principal vs Interest</h3>
          <p className="mb-3 text-xs text-gray-400">How much of your payments is interest</p>
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
                <Cell fill={COLORS.principal} />
                <Cell fill={COLORS.interest} />
              </Pie>
              <Tooltip formatter={fmtTooltip} />
              <Legend iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Area — Outstanding Balance Curve */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Outstanding Balance</h3>
          <p className="mb-3 text-xs text-gray-400">Loan balance remaining over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={balanceData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hlBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.balance} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLORS.balance} stopOpacity={0.05} />
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
                dataKey="balance"
                stroke={COLORS.balance}
                strokeWidth={2}
                fill="url(#hlBalance)"
                name="Outstanding Balance"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Area — Loan Payoff Curve (cumulative principal vs interest paid) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Loan Payoff Curve</h3>
        <p className="mb-3 text-xs text-gray-400">
          Cumulative principal and interest paid as the loan is repaid
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={payoffData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hlPrincipalPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.principal} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.principal} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="hlInterestPaid" x1="0" y1="0" x2="0" y2="1">
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
            <Legend iconType="circle" iconSize={8} />
            <Area
              type="monotone"
              dataKey="principalPaid"
              stroke={COLORS.principal}
              strokeWidth={1.5}
              fill="url(#hlPrincipalPaid)"
              name="Principal Paid"
            />
            <Area
              type="monotone"
              dataKey="interestPaid"
              stroke={COLORS.interest}
              strokeWidth={1.5}
              fill="url(#hlInterestPaid)"
              name="Interest Paid"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

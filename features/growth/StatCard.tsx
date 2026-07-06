import { cn } from "@/lib/cn";
import { Sparkline } from "./Sparkline";

export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaLowerIsBetter = false,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Period-over-period change, %. */
  delta?: number;
  /** For metrics like position where a lower value is better. */
  deltaLowerIsBetter?: boolean;
  trend?: number[];
}) {
  const good = delta === undefined ? false : deltaLowerIsBetter ? delta < 0 : delta > 0;
  const bad = delta === undefined ? false : deltaLowerIsBetter ? delta > 0 : delta < 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold tabular-nums text-gray-900">{value}</p>
        {trend && trend.length > 1 && <Sparkline values={trend} className="text-brand-400" />}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              good && "text-green-600",
              bad && "text-red-600",
              !good && !bad && "text-gray-400"
            )}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
    </div>
  );
}

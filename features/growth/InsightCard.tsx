import { cn } from "@/lib/cn";
import type { Insight, InsightSeverity } from "@/lib/growth/types";

const SEVERITY: Record<
  InsightSeverity,
  { border: string; badge: string; icon: string; label: string }
> = {
  opportunity: {
    border: "border-brand-200",
    badge: "bg-brand-50 text-brand-700",
    icon: "🎯",
    label: "Opportunity",
  },
  warning: {
    border: "border-amber-200",
    badge: "bg-amber-50 text-amber-700",
    icon: "⚠️",
    label: "Needs attention",
  },
  positive: {
    border: "border-green-200",
    badge: "bg-green-50 text-green-700",
    icon: "📈",
    label: "Winning",
  },
  info: {
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-600",
    icon: "ℹ️",
    label: "Info",
  },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const s = SEVERITY[insight.severity];
  return (
    <div className={cn("flex flex-col rounded-xl border bg-white p-4", s.border)}>
      <div className="mb-1.5 flex items-center gap-2">
        <span aria-hidden="true">{s.icon}</span>
        <h3 className="font-semibold text-gray-900">{insight.title}</h3>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-medium", s.badge)}>
          {s.label}
        </span>
      </div>
      <p className="text-sm text-gray-500">{insight.description}</p>
      <ul className="mt-3 flex flex-col divide-y divide-gray-100">
        {insight.items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="truncate font-medium text-gray-700">{item.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-gray-500">{item.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

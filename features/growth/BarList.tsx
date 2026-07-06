import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BarDatum } from "@/lib/growth/types";
import { formatFull } from "@/lib/growth/format";

/** Horizontal bar list for distributions (sources, countries, devices, scroll). */
export function BarList({
  items,
  formatValue = formatFull,
  barClassName = "bg-brand-500",
  emptyLabel = "No data",
}: {
  items: BarDatum[];
  formatValue?: (n: number) => ReactNode;
  barClassName?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-gray-700">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-gray-900">
              {formatValue(item.value)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn("h-full rounded-full", barClassName)}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

import { cn } from "@/lib/cn";
import type { Priority, AgentStatus } from "@/lib/marketing-agent/types";

const PRIORITY: Record<Priority, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-700" },
  high: { label: "High", className: "bg-amber-100 text-amber-700" },
  medium: { label: "Medium", className: "bg-brand-50 text-brand-700" },
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        p.className,
        className
      )}
    >
      {p.label}
    </span>
  );
}

/** Agent roster status — active agents analyse, planned agents are wired but idle. */
export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active" ? "bg-green-500" : "bg-gray-400"
        )}
        aria-hidden="true"
      />
      {status === "active" ? "Active" : "Planned"}
    </span>
  );
}

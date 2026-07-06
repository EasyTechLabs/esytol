import { cn } from "@/lib/cn";
import type { ProviderStatus } from "@/lib/growth/types";

const STYLES: Record<ProviderStatus | "planned", { label: string; className: string }> = {
  live: { label: "Live", className: "bg-green-100 text-green-700" },
  sample: { label: "Sample", className: "bg-amber-100 text-amber-700" },
  error: { label: "Error", className: "bg-red-100 text-red-700" },
  planned: { label: "Planned", className: "bg-gray-100 text-gray-500" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProviderStatus | "planned";
  className?: string;
}) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        s.className,
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "live" && "bg-green-500",
          status === "sample" && "bg-amber-500",
          status === "error" && "bg-red-500",
          status === "planned" && "bg-gray-400"
        )}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}

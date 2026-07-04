import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon = "🔍", title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 py-16 text-center",
        className
      )}
    >
      <span className="text-4xl">{icon}</span>
      <p className="font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
    </div>
  );
}

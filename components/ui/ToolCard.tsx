import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Tool } from "@/types/tool";

interface ToolCardProps {
  tool: Tool;
  className?: string;
}

export function ToolCard({ tool, className }: ToolCardProps) {
  return (
    <Link
      href={tool.url}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5",
        "hover:border-brand-200 transition-all duration-150 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{tool.icon}</span>
          <h3 className="font-semibold text-gray-900 group-hover:text-brand-600">{tool.name}</h3>
        </div>
        {tool.isNew && (
          <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
            New
          </span>
        )}
      </div>

      <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{tool.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {tool.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

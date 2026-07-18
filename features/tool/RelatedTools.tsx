import Link from "next/link";
import type { Tool } from "@/types/tool";

interface RelatedToolsProps {
  tools: Tool[];
  heading?: string;
}

/**
 * Renders a list of related tools. The list itself is produced by `getRelatedTools` (metadata-driven),
 * so this component never decides *which* tools are related — it only presents them.
 */
export function RelatedTools({ tools, heading = "Related Tools" }: RelatedToolsProps) {
  if (tools.length === 0) return null;

  return (
    <nav aria-label={heading} className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{heading}</p>
      <ul className="flex flex-col gap-0.5">
        {tools.map((tool) => (
          <li key={tool.id}>
            <Link
              href={tool.url}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-brand-600"
            >
              <span aria-hidden="true">{tool.icon}</span>
              <span>{tool.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

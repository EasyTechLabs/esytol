import Link from "next/link";
import { getToolBySlug } from "@/registry";

interface RelatedToolsProps {
  slugs: string[];
}

export function RelatedTools({ slugs }: RelatedToolsProps) {
  const tools = slugs.map((slug) => getToolBySlug(slug)).filter(Boolean);

  if (tools.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Related Tools</p>
      <ul className="flex flex-col gap-0.5">
        {tools.map((tool) => (
          <li key={tool!.id}>
            <Link
              href={tool!.url}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-brand-600"
            >
              <span aria-hidden="true">{tool!.icon}</span>
              <span>{tool!.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

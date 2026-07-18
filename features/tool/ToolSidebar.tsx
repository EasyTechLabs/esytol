import Link from "next/link";
import type { Tool } from "@/types/tool";
import { ShareButtons } from "./ShareButtons";
import { RelatedTools } from "./RelatedTools";
import { getRelatedTools, getAdjacentTools } from "@/registry";
import { siteConfig } from "@/config/site";

interface ToolSidebarProps {
  tool: Tool;
}

export function ToolSidebar({ tool }: ToolSidebarProps) {
  const absoluteUrl = `${siteConfig.url}${tool.url}`;
  const reportUrl = `https://github.com/EasyTechLabs/esytol/issues/new?title=${encodeURIComponent(`Issue: ${tool.name}`)}&labels=bug`;

  // Metadata-driven: curated related tools first, topped up by shared tags/category so the list is
  // never empty and no page is an internal-linking orphan.
  const related = getRelatedTools(tool);
  const { previous, next } = getAdjacentTools(tool);

  return (
    <aside className="flex flex-col gap-6">
      <ShareButtons title={`${tool.name} — ${siteConfig.name}`} url={absoluteUrl} />

      <RelatedTools tools={related} />

      {(previous || next) && (
        <nav aria-label="Previous and next tool" className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            More in this category
          </p>
          <div className="flex flex-col gap-0.5">
            {previous && (
              <Link
                href={previous.url}
                rel="prev"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-brand-600"
              >
                <span aria-hidden="true">←</span>
                <span className="truncate">{previous.name}</span>
              </Link>
            )}
            {next && (
              <Link
                href={next.url}
                rel="next"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-brand-600"
              >
                <span aria-hidden="true">→</span>
                <span className="truncate">{next.name}</span>
              </Link>
            )}
          </div>
        </nav>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Feedback</p>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-500 transition-colors hover:text-brand-600"
        >
          Report an issue
        </a>
      </div>
    </aside>
  );
}

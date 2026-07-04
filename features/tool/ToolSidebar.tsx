import type { Tool } from "@/types/tool";
import { ShareButtons } from "./ShareButtons";
import { RelatedTools } from "./RelatedTools";
import { siteConfig } from "@/config/site";

interface ToolSidebarProps {
  tool: Tool;
}

export function ToolSidebar({ tool }: ToolSidebarProps) {
  const absoluteUrl = `${siteConfig.url}${tool.url}`;
  const reportUrl = `https://github.com/EasyTechLabs/esytol/issues/new?title=${encodeURIComponent(`Issue: ${tool.name}`)}&labels=bug`;

  return (
    <aside className="flex flex-col gap-6">
      <ShareButtons title={`${tool.name} — ${siteConfig.name}`} url={absoluteUrl} />

      {tool.relatedTools && tool.relatedTools.length > 0 && (
        <RelatedTools slugs={tool.relatedTools} />
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

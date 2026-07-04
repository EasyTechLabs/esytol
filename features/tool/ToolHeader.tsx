import { Breadcrumb } from "./Breadcrumb";
import type { Tool } from "@/types/tool";

interface ToolHeaderProps {
  tool: Tool;
}

export function ToolHeader({ tool }: ToolHeaderProps) {
  return (
    <header>
      <Breadcrumb items={[{ label: "Tools", href: "/tools" }, { label: tool.name }]} />
      <div className="mt-6 flex items-start gap-4">
        <span className="text-5xl leading-none" aria-hidden="true">
          {tool.icon}
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{tool.name}</h1>
          <p className="mt-2 max-w-2xl text-base text-gray-500">{tool.description}</p>
          {(tool.version ?? tool.lastUpdated) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              {tool.version && <span>v{tool.version}</span>}
              {tool.version && tool.lastUpdated && <span aria-hidden="true">·</span>}
              {tool.lastUpdated && <span>Updated {tool.lastUpdated}</span>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

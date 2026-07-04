import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getNewTools } from "@/registry";

export function RecentTools() {
  const tools = getNewTools();

  if (tools.length === 0) {
    return <EmptyState title="No new tools yet" description="New tools are added weekly." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

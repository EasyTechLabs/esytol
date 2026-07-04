import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPopularTools } from "@/registry";

export function PopularTools() {
  const tools = getPopularTools();

  if (tools.length === 0) {
    return <EmptyState title="No popular tools yet" description="Check back soon." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

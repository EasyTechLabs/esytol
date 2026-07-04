import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getFeaturedTools } from "@/registry";

export function FeaturedTools() {
  const tools = getFeaturedTools();

  if (tools.length === 0) {
    return <EmptyState title="No featured tools yet" description="Check back soon." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

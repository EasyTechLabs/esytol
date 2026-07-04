import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getTools } from "@/registry";
import { ToolCard } from "@/components/ui/ToolCard";

export const metadata: Metadata = buildMetadata({
  title: "All Tools",
  description:
    "Browse 5000+ free online tools for developers, writers, designers, and everyday tasks.",
  path: "/tools",
});

export default function ToolsPage() {
  const tools = getTools();

  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Tools</h1>
        <p className="mt-2 text-gray-500">{tools.length} tools available — more coming soon.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}

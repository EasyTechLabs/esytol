import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getTools, getLiveTools } from "@/registry";
import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = buildMetadata({
  title: "All Tools",
  description: "Browse free online tools for developers, writers, designers, and everyday tasks.",
  path: "/tools",
});

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ToolsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // Only live tools are browsable; apply the search query when present.
  const tools = getTools(query ? { query } : undefined).filter((t) => t.status !== "coming-soon");
  const liveCount = getLiveTools().length;

  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {query ? "Search Results" : "All Tools"}
        </h1>
        <p className="mt-2 text-gray-500">
          {query ? (
            <>
              {tools.length} {tools.length === 1 ? "result" : "results"} for{" "}
              <span className="font-medium text-gray-700">“{query}”</span>
            </>
          ) : (
            `${liveCount} tools available — more coming soon.`
          )}
        </p>
      </div>

      {tools.length === 0 ? (
        <EmptyState
          title={query ? `No tools match “${query}”` : "No tools available"}
          description={
            query
              ? "Try a different keyword — for example “EMI”, “SIP”, “GST”, or “home loan”."
              : "Check back soon."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}

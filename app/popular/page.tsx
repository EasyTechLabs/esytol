import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getPopularTools } from "@/registry";
import { ToolCard } from "@/components/ui/ToolCard";

export const metadata: Metadata = buildMetadata({
  title: "Popular Tools",
  description: "The most popular free online tools used by developers and creators worldwide.",
  path: "/popular",
});

export default function PopularPage() {
  const tools = getPopularTools();

  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Popular Tools</h1>
        <p className="mt-2 text-gray-500">Most-used tools on Esytol</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}

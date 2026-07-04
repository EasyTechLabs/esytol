import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getNewTools } from "@/registry";
import { ToolCard } from "@/components/ui/ToolCard";

export const metadata: Metadata = buildMetadata({
  title: "New Tools",
  description: "The latest tools added to Esytol — always fresh, always free.",
  path: "/new",
});

export default function NewPage() {
  const tools = getNewTools();

  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Tools</h1>
        <p className="mt-2 text-gray-500">Recently added to Esytol</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}

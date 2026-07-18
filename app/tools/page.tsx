import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getLiveTools } from "@/registry";
import { searchToolList } from "@/lib/search/toolSearch";
import { collectionPageSchema } from "@/seo/jsonld";
import { siteConfig } from "@/config/site";
import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = buildMetadata({
  title: "All Tools",
  description:
    "Browse every free tool on Esytol — developer utilities (JSON, XML, CSV, encoders), security tools, India finance calculators (EMI, SIP, tax, loans), and everyday utilities. All run in your browser; no signup.",
  path: "/tools",
});

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ToolsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  // The full catalogue, or a fuzzy-ranked subset when searching — one search engine everywhere.
  const allLive = getLiveTools();
  const tools = query ? searchToolList(query, undefined, allLive) : allLive;

  // CollectionPage/ItemList structured data for the canonical (unfiltered) listing.
  const schema =
    query === ""
      ? collectionPageSchema({
          name: "All Tools — Esytol",
          description: "Every free developer, security, finance, and everyday tool on Esytol.",
          url: `${siteConfig.url}/tools`,
          items: allLive.map((t) => ({ name: t.name, url: `${siteConfig.url}${t.url}` })),
        })
      : null;

  return (
    <div className="container-page section-gap">
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}

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
            `${allLive.length} free tools — all run entirely in your browser.`
          )}
        </p>
      </div>

      {tools.length === 0 ? (
        <EmptyState
          title={query ? `No tools match “${query}”` : "No tools available"}
          description={
            query
              ? "Try a different keyword — for example “JSON”, “hash”, “EMI”, or “base64”."
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

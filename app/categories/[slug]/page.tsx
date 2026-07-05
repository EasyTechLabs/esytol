import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getTools, getLiveTools, getLiveCategories } from "@/registry";
import { categories } from "@/registry/categories";
import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  params: Promise<{ slug: string }>;
}

// Pre-render only categories that contain live tools. Any other category slug
// (empty or unknown) is a hard 404 rather than a soft-404 empty page.
export const dynamicParams = false;

export function generateStaticParams() {
  return getLiveCategories().map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((c) => c.slug === slug);
  if (!category) return { title: "Category Not Found" };
  const hasLiveTools = getLiveTools().some((t) => t.category === category.slug);
  const metadata = buildMetadata({
    title: category.name,
    description: category.description,
    path: `/categories/${category.slug}`,
  });
  // Empty categories must not be indexed (thin/placeholder content).
  if (!hasLiveTools) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const tools = getTools({ category: category.slug }).filter((t) => t.status !== "coming-soon");

  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <span className="text-4xl" aria-hidden="true">
          {category.icon}
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">{category.name}</h1>
        <p className="mt-2 text-gray-500">{category.description}</p>
      </div>

      {tools.length === 0 ? (
        <EmptyState title="No tools yet" description="Tools in this category are coming soon." />
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

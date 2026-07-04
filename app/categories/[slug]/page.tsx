import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getTools } from "@/registry";
import { categories } from "@/registry/categories";
import { ToolCard } from "@/components/ui/ToolCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return categories.map((cat) => ({ slug: cat.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((c) => c.slug === slug);
  if (!category) return { title: "Category Not Found" };
  return buildMetadata({
    title: category.name,
    description: category.description,
    path: `/categories/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const tools = getTools({ category: category.slug });

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

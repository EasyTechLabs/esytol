import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getTools, getLiveTools, getLiveCategories } from "@/registry";
import { categories } from "@/registry/categories";
import { siteConfig } from "@/config/site";
import { breadcrumbSchema, collectionPageSchema } from "@/seo/jsonld";
import { Breadcrumb } from "@/features/tool/Breadcrumb";
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
  const otherCategories = getLiveCategories().filter((c) => c.slug !== category.slug);
  const categoryUrl = `${siteConfig.url}/categories/${category.slug}`;

  // Structured data, generated from the registry — every listing page inherits it.
  const schemas = [
    breadcrumbSchema([
      { name: "Home", url: siteConfig.url },
      { name: "Categories", url: `${siteConfig.url}/categories` },
      { name: category.name, url: categoryUrl },
    ]),
    collectionPageSchema({
      name: `${category.name} Tools`,
      description: category.description,
      url: categoryUrl,
      items: tools.map((t) => ({ name: t.name, url: `${siteConfig.url}${t.url}` })),
    }),
  ];

  return (
    <div className="container-page section-gap">
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <Breadcrumb
        items={[{ label: "Categories", href: "/categories" }, { label: category.name }]}
      />

      <div className="mb-8 mt-4">
        <span className="text-4xl" aria-hidden="true">
          {category.icon}
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">{category.name} Tools</h1>
        <p className="mt-2 max-w-2xl text-gray-500">
          {category.description} Every tool runs entirely in your browser — nothing is uploaded.
          {tools.length > 0 &&
            ` ${tools.length} free tool${tools.length === 1 ? "" : "s"} available.`}
        </p>
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

      {otherCategories.length > 0 && (
        <nav aria-label="Other categories" className="mt-12 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Browse other categories
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {otherCategories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:border-brand-300 hover:text-brand-600"
                >
                  <span aria-hidden="true">{c.icon}</span>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

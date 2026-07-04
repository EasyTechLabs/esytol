import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { categories } from "@/registry/categories";
import { CategoryCard } from "@/components/ui/CategoryCard";

export const metadata: Metadata = buildMetadata({
  title: "Categories",
  description:
    "Browse tools by category — developer, text, security, converters, generators, and more.",
  path: "/categories",
});

export default function CategoriesPage() {
  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">All Categories</h1>
        <p className="mt-2 text-gray-500">{categories.length} categories</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {categories.map((category) => (
          <CategoryCard key={category.slug} category={category} />
        ))}
      </div>
    </div>
  );
}

import { CategoryCard } from "@/components/ui/CategoryCard";
import { getLiveCategories } from "@/registry";

export function CategoryGrid() {
  const categories = getLiveCategories();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((category) => (
        <CategoryCard key={category.slug} category={category} />
      ))}
    </div>
  );
}

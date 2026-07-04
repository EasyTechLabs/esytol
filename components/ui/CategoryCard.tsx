import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Category } from "@/types/category";

interface CategoryCardProps {
  category: Category;
  className?: string;
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-center",
        "transition-all duration-150 hover:border-brand-200 hover:shadow-md",
        className
      )}
    >
      <span className="text-3xl">{category.icon}</span>
      <div>
        <h3 className="font-semibold text-gray-900 group-hover:text-brand-600">{category.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{category.description}</p>
      </div>
    </Link>
  );
}

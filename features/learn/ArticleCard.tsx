import Link from "next/link";
import { cn } from "@/lib/cn";
import { categoryLabel, type ArticleMeta } from "@/lib/learn";

export function ArticleCard({ article, className }: { article: ArticleMeta; className?: string }) {
  const fm = article.frontmatter;
  return (
    <Link
      href={`/learn/${article.slug}`}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5",
        "transition-all duration-150 hover:border-brand-200 hover:shadow-md",
        className
      )}
    >
      <span className="w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
        {categoryLabel(fm.category)}
      </span>
      <h3 className="font-semibold leading-snug text-gray-900 group-hover:text-brand-600">
        {fm.title}
      </h3>
      <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{fm.metaDescription}</p>
      <div className="mt-auto flex items-center gap-2 text-xs text-gray-400">
        <span>{article.readingTime} min read</span>
        <span aria-hidden="true">·</span>
        <span>Updated {fm.lastUpdated}</span>
      </div>
    </Link>
  );
}

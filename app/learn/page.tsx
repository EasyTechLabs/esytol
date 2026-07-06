import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { breadcrumbSchema } from "@/seo/jsonld";
import { siteConfig } from "@/config/site";
import { Breadcrumb } from "@/features/tool/Breadcrumb";
import { ArticleCard } from "@/features/learn/ArticleCard";
import { getArticlesByCategory, getAllArticles, categoryLabel } from "@/lib/learn";

export const metadata: Metadata = buildMetadata({
  title: "Learn Center",
  description:
    "Guides and explainers on Indian personal finance — income tax, HRA, EPF, gratuity, NPS and more. Clear, sourced articles from the Esytol team.",
  path: "/learn",
  keywords: [
    "personal finance guides india",
    "income tax articles",
    "epf nps gratuity hra explained",
    "esytol learn",
  ],
});

export default function LearnPage() {
  const groups = getArticlesByCategory();
  const total = getAllArticles().length;

  const schema = breadcrumbSchema([
    { name: "Home", url: siteConfig.url },
    { name: "Learn", url: `${siteConfig.url}/learn` },
  ]);

  return (
    <div className="container-page section-gap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <Breadcrumb items={[{ label: "Learn" }]} />

      <div className="mb-10 mt-6 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Esytol Learn Center</h1>
        <p className="mt-3 text-gray-500">
          Clear, sourced guides to Indian personal finance — {total} articles on income tax, salary,
          and retirement. Each one links to the calculators that put the numbers to work.
        </p>
      </div>

      <div className="flex flex-col gap-12">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`cat-${group.category}`}>
            <h2 id={`cat-${group.category}`} className="mb-4 text-xl font-semibold text-gray-900">
              {categoryLabel(group.category)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.articles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

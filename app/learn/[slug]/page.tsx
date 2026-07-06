import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/features/tool/Breadcrumb";
import { FinancialDisclaimer } from "@/features/tool/FinancialDisclaimer";
import { Markdown } from "@/features/learn/Markdown";
import { ArticleCard } from "@/features/learn/ArticleCard";
import { buildArticleMetadata, buildArticleSchemas } from "@/seo/learn-seo";
import {
  getArticleBySlug,
  getArticleSlugs,
  getRelatedArticles,
  getAdjacentArticles,
  categoryLabel,
} from "@/lib/learn";
import { getToolBySlug } from "@/registry";
import { getMethodology, type MethodologySource } from "@/content/methodology";
import type { Tool } from "@/types/tool";

export const dynamicParams = false;

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return buildArticleMetadata(article);
}

function relatedTools(slugs: string[]): Tool[] {
  return slugs.map((s) => getToolBySlug(s)).filter((t): t is Tool => Boolean(t));
}

function aggregateSources(tools: Tool[]): MethodologySource[] {
  const seen = new Set<string>();
  const sources: MethodologySource[] = [];
  for (const tool of tools) {
    const method = getMethodology(tool.slug);
    if (!method) continue;
    for (const s of method.sources) {
      if (seen.has(s.label)) continue;
      seen.add(s.label);
      sources.push(s);
    }
  }
  return sources;
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const fm = article.frontmatter;
  const schemas = buildArticleSchemas(article);
  const tools = relatedTools(article.relatedToolSlugs);
  const sources = aggregateSources(tools);
  const related = getRelatedArticles(slug);
  const { prev, next } = getAdjacentArticles(slug);

  return (
    <div className="container-page section-gap">
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <Breadcrumb items={[{ label: "Learn", href: "/learn" }, { label: fm.title }]} />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">
        {/* Main article */}
        <main className="min-w-0">
          <article>
            <header>
              <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                {categoryLabel(fm.category)}
              </span>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
                {fm.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span>{article.readingTime} min read</span>
                <span aria-hidden="true">·</span>
                <span>Updated {fm.lastUpdated}</span>
                <span aria-hidden="true">·</span>
                <span>Reviewed by {fm.reviewedBy}</span>
              </div>
            </header>

            <div className="mt-6">
              <Markdown source={article.body} />
            </div>
          </article>

          {/* Official sources */}
          {sources.length > 0 && (
            <section
              aria-labelledby="sources-heading"
              className="mt-10 rounded-xl border border-gray-200 bg-white p-5"
            >
              <h2 id="sources-heading" className="text-sm font-semibold text-gray-900">
                Official sources &amp; references
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {sources.map((s) =>
                  s.url ? (
                    <li key={s.label}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        {s.label} <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ) : (
                    <li
                      key={s.label}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
                    >
                      {s.label}
                    </li>
                  )
                )}
              </ul>
            </section>
          )}

          <div className="mt-6">
            <FinancialDisclaimer />
          </div>

          {/* Previous / Next navigation */}
          {(prev || next) && (
            <nav
              aria-label="Article navigation"
              className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {prev ? (
                <Link
                  href={`/learn/${prev.slug}`}
                  className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm"
                >
                  <span className="text-xs font-medium text-gray-400">← Previous</span>
                  <p className="mt-1 font-medium text-gray-900 group-hover:text-brand-600">
                    {prev.frontmatter.title}
                  </p>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={`/learn/${next.slug}`}
                  className="group rounded-xl border border-gray-200 bg-white p-4 text-right transition hover:border-brand-200 hover:shadow-sm sm:col-start-2"
                >
                  <span className="text-xs font-medium text-gray-400">Next →</span>
                  <p className="mt-1 font-medium text-gray-900 group-hover:text-brand-600">
                    {next.frontmatter.title}
                  </p>
                </Link>
              )}
            </nav>
          )}
        </main>

        {/* Sidebar */}
        <aside className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
          {tools.length > 0 && (
            <section aria-labelledby="related-tools-heading">
              <h2 id="related-tools-heading" className="mb-3 text-sm font-semibold text-gray-900">
                Related calculators
              </h2>
              <div className="flex flex-col gap-2">
                {tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={tool.url}
                    className="group flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition hover:border-brand-200 hover:shadow-sm"
                  >
                    <span className="text-xl leading-none">{tool.icon}</span>
                    <span className="text-sm font-medium text-gray-800 group-hover:text-brand-600">
                      {tool.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section aria-labelledby="related-articles-heading">
              <h2
                id="related-articles-heading"
                className="mb-3 text-sm font-semibold text-gray-900"
              >
                Related articles
              </h2>
              <div className="flex flex-col gap-3">
                {related.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

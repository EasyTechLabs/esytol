import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getToolBySlug, toolRegistry } from "@/registry";
import { toolSchema } from "@/seo/jsonld";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return toolRegistry.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool Not Found" };
  return buildMetadata({
    title: tool.name,
    description: tool.description,
    path: `/tools/${tool.slug}`,
  });
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema(tool)) }}
      />
      <div className="container-page section-gap">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand-600">
            {tool.category}
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            {tool.icon} {tool.name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-gray-500">{tool.description}</p>
        </div>

        <div className="rounded-xl border border-dashed border-gray-200 px-12 py-20 text-center">
          <p className="text-gray-400">Tool interface coming soon.</p>
        </div>
      </div>
    </>
  );
}

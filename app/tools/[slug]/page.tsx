import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getToolBySlug, toolRegistry } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";

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
  return buildToolMetadata(tool);
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <div className="py-16 text-center">
          <p className="text-gray-400">Tool interface coming soon.</p>
        </div>
      </ToolLayout>
    </>
  );
}

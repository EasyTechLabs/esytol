import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getToolBySlug, toolRegistry, isToolLive } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";

interface Props {
  params: Promise<{ slug: string }>;
}

// Only registered tool slugs exist — any other slug is a hard 404 (not a
// soft-404). Without this, unknown slugs render notFound() on-demand and can be
// served with a 200 status.
export const dynamicParams = false;

export function generateStaticParams() {
  return toolRegistry.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool Not Found" };
  const metadata = buildToolMetadata(tool);
  // Coming-soon placeholders must not be indexed (thin/placeholder content).
  if (!isToolLive(tool)) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
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

import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { FinancialRoadmap } from "@/features/tools/financial-roadmap/FinancialRoadmap";

const tool = getToolBySlug("financial-roadmap")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function FinancialRoadmapPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={<div className="py-16 text-center text-sm text-gray-400">Loading roadmap…</div>}
        >
          <FinancialRoadmap />
        </Suspense>
      </ToolLayout>
    </>
  );
}

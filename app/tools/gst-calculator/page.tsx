import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { GSTCalculator } from "@/features/tools/gst-calculator/GSTCalculator";

const tool = getToolBySlug("gst-calculator")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function GSTCalculatorPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={
            <div className="py-16 text-center text-sm text-gray-400">Loading calculator…</div>
          }
        >
          <GSTCalculator />
        </Suspense>
      </ToolLayout>
    </>
  );
}

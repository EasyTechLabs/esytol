import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { PPFCalculator } from "@/features/tools/ppf-calculator/PPFCalculator";

const tool = getToolBySlug("ppf-calculator")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function PPFCalculatorPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={
            <div className="py-16 text-center text-sm text-gray-400">Loading calculator…</div>
          }
        >
          <PPFCalculator />
        </Suspense>
      </ToolLayout>
    </>
  );
}

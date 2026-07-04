import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { EMICalculator } from "@/features/tools/emi-calculator/EMICalculator";

const tool = getToolBySlug("emi-calculator")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function EMICalculatorPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={
            <div className="py-16 text-center text-sm text-gray-400">Loading calculator…</div>
          }
        >
          <EMICalculator />
        </Suspense>
      </ToolLayout>
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { HomeLoanCalculator } from "@/features/tools/home-loan-calculator/HomeLoanCalculator";

const tool = getToolBySlug("home-loan-calculator")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function HomeLoanCalculatorPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={
            <div className="py-16 text-center text-sm text-gray-400">Loading calculator…</div>
          }
        >
          <HomeLoanCalculator />
        </Suspense>
      </ToolLayout>
    </>
  );
}

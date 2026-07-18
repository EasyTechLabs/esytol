import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { JsonYamlConverter } from "@/features/tools/json-yaml-converter/JsonYamlConverter";

const tool = getToolBySlug("json-yaml-converter")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function JsonYamlConverterPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}
        >
          <JsonYamlConverter />
        </Suspense>
      </ToolLayout>
    </>
  );
}

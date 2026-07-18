import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { JsonDiffViewer } from "@/features/tools/json-diff-viewer/JsonDiffViewer";

const tool = getToolBySlug("json-diff-viewer")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function JsonDiffViewerPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}
        >
          <JsonDiffViewer />
        </Suspense>
      </ToolLayout>
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { Base64Tool } from "@/features/tools/base64-encoder/Base64Tool";

const tool = getToolBySlug("base64-encoder")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function Base64EncoderPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}
        >
          <Base64Tool />
        </Suspense>
      </ToolLayout>
    </>
  );
}

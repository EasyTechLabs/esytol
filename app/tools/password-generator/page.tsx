import { Suspense } from "react";
import type { Metadata } from "next";
import { getToolBySlug } from "@/registry";
import { buildToolMetadata } from "@/seo/metadata";
import { ToolLayout } from "@/features/tool/ToolLayout";
import { ToolMetadata } from "@/features/tool/ToolMetadata";
import { PasswordGenerator } from "@/features/tools/password-generator/PasswordGenerator";

const tool = getToolBySlug("password-generator")!;

export const metadata: Metadata = buildToolMetadata(tool);

export default function PasswordGeneratorPage() {
  return (
    <>
      <ToolMetadata tool={tool} />
      <ToolLayout tool={tool}>
        <Suspense
          fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}
        >
          <PasswordGenerator />
        </Suspense>
      </ToolLayout>
    </>
  );
}

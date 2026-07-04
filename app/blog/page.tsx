import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = buildMetadata({
  title: "Blog",
  description: "Tips, tutorials, and updates from the Esytol team.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <div className="container-page section-gap">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
        <p className="mt-2 text-gray-500">Tips and updates from the Esytol team</p>
      </div>
      <EmptyState icon="📝" title="Coming soon" description="Blog posts will be published here." />
    </div>
  );
}

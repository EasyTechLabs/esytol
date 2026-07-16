import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getLiveToolCount, getPopularTools } from "@/registry";
import { HeroSection } from "@/features/home/HeroSection";
import { DomainSections } from "@/features/home/DomainSections";
import { FeaturedTools } from "@/features/home/FeaturedTools";
import { PopularTools } from "@/features/home/PopularTools";
import { RecentTools } from "@/features/home/RecentTools";

// Names the platform first and the strongest category second — finance keywords stay
// in the description, so the finance SEO the site actually ranks for is preserved
// while the title stops reading as a developer-tools site we do not have.
export const metadata: Metadata = buildMetadata({
  title: "Free Online Tools",
  description:
    "A free platform of online tools — finance calculators for India (EMI, SIP, tax, home loan) plus everyday utilities. No signup, nothing leaves your browser.",
  path: "/",
});

export default function HomePage() {
  const toolCount = getLiveToolCount();
  // Popular live calculators — future calculators surface here automatically.
  const quickLinks = getPopularTools()
    .slice(0, 6)
    .map((tool) => ({ label: tool.name, href: tool.url }));
  return (
    <>
      <HeroSection toolCount={toolCount} quickLinks={quickLinks} />

      <div className="container-page">
        <section className="section-gap">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Browse by category</h2>
          <p className="mb-8 text-sm text-gray-500">
            Finance is our deepest category. More are on the way — each one arrives here
            automatically.
          </p>
          <DomainSections />
        </section>

        <section className="section-gap border-t border-gray-200">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Featured Tools</h2>
          <FeaturedTools />
        </section>

        <section className="section-gap border-t border-gray-200">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Popular Tools</h2>
          <PopularTools />
        </section>

        <section className="section-gap border-t border-gray-200">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Recently Added</h2>
          <RecentTools />
        </section>
      </div>
    </>
  );
}

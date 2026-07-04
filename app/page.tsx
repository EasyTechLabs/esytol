import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { HeroSection } from "@/features/home/HeroSection";
import { CategoryGrid } from "@/features/home/CategoryGrid";
import { FeaturedTools } from "@/features/home/FeaturedTools";
import { PopularTools } from "@/features/home/PopularTools";
import { RecentTools } from "@/features/home/RecentTools";

export const metadata: Metadata = buildMetadata({
  title: "Free Online Tools",
  description:
    "5000+ free online tools for developers, writers, and everyday tasks. No signup required.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <div className="container-page">
        <section className="section-gap">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Browse by Category</h2>
          <CategoryGrid />
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

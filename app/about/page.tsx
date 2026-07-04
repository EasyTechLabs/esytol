import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description: `Learn about ${siteConfig.name} — a free platform with 5000+ online tools.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">About Esytol</h1>
        <div className="mt-6 space-y-4 text-gray-600">
          <p>
            Esytol is a free platform offering 5000+ online tools for developers, designers,
            writers, and everyday users. No account required. Everything runs in your browser.
          </p>
          <p>
            Built by{" "}
            <a
              href={siteConfig.links.github}
              className="text-brand-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              EasyTechLabs
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

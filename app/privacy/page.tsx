import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "Esytol privacy policy — we collect no personal data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-4 text-sm text-gray-400">Last updated: July 2026</p>

        <div className="mt-6 space-y-4 text-gray-600">
          <p>
            Esytol does not collect, store, or share any personal data. All tool operations run
            entirely in your browser — nothing is sent to our servers.
          </p>
          <p>
            We may use anonymised analytics to understand aggregate usage patterns (page views,
            popular tools). This data is never linked to individuals.
          </p>
          <p>
            If you have questions, contact us via{" "}
            <a
              href={siteConfig.links.github}
              className="text-brand-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

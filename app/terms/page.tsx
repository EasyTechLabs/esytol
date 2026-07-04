import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: "Esytol terms of service.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-4 text-sm text-gray-400">Last updated: July 2026</p>

        <div className="mt-6 space-y-4 text-gray-600">
          <p>
            By using Esytol, you agree to use the platform for lawful purposes only. All tools are
            provided as-is, with no warranty of fitness for a particular purpose.
          </p>
          <p>Esytol reserves the right to modify or discontinue any tool at any time.</p>
          <p>
            For the full terms, contact us via{" "}
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

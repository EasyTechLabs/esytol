import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "The terms governing your use of Esytol — provided as-is for educational purposes, with no financial guarantees.",
  path: "/terms",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-4 text-sm text-gray-400">Last updated: July 2026</p>

        <p className="mt-6 text-gray-600">
          By accessing or using {siteConfig.name} (the “Service”), you agree to these Terms. If you
          do not agree, please do not use the Service.
        </p>

        <Section title="Use at your own risk">
          <p>
            The Service is provided on an “as is” and “as available” basis, without warranties of
            any kind, express or implied, including fitness for a particular purpose. You use the
            Service, and rely on any output, at your own risk.
          </p>
        </Section>

        <Section title="Financial disclaimer">
          <p>
            Every calculator on {siteConfig.name} provides{" "}
            <strong>estimates for educational purposes only</strong>. Actual figures may vary
            depending on lender policies, taxes, fees and regulatory changes. Nothing on the Service
            constitutes financial, investment, tax, or legal advice. Always confirm figures with
            your bank, financial institution, or a qualified professional before making a decision.
          </p>
        </Section>

        <Section title="No guarantees">
          <p>
            While we test our calculation engines extensively and verify formulas against
            authoritative sources, we do not guarantee that results are error-free, current, or
            suitable for any particular purpose. Rates, rules, and regulations change over time.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>use the Service for any unlawful purpose;</li>
            <li>attempt to disrupt, overload, or compromise the site or its infrastructure;</li>
            <li>
              scrape or republish content in a way that misrepresents its source or accuracy; or
            </li>
            <li>remove or obscure any disclaimers or attribution.</li>
          </ul>
        </Section>

        <Section title="Intellectual property & copyright">
          <p>
            The {siteConfig.name} name, branding, design, and content are ©{" "}
            {new Date().getFullYear()} EasyTechLabs, except where otherwise noted. All rights not
            expressly granted are reserved.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            The Service’s source code is published on{" "}
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              GitHub
            </a>{" "}
            and is licensed under the terms stated in that repository. Your use of the source code
            is governed by that license; these Terms govern your use of the hosted website.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, {siteConfig.name} and EasyTechLabs will not be
            liable for any indirect, incidental, special, or consequential damages, or for any loss
            arising from your reliance on the Service or its output, even if advised of the
            possibility of such damages.
          </p>
        </Section>

        <Section title="Changes to the Service and Terms">
          <p>
            We may modify, suspend, or discontinue any part of the Service at any time, and may
            update these Terms. Continued use after changes take effect constitutes acceptance of
            the revised Terms.
          </p>
        </Section>

        <Section title="Governing law & jurisdiction">
          <p>
            These Terms are governed by the laws of India, without regard to conflict-of-laws
            principles. Any disputes will be subject to the exclusive jurisdiction of the courts
            located in India.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:hello@esytol.com" className="text-brand-600 hover:underline">
              hello@esytol.com
            </a>{" "}
            or use the{" "}
            <Link href="/contact" className="text-brand-600 hover:underline">
              contact page
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

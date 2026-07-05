import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Esytol builds fast, accurate, privacy-first financial calculators for India — open source, no signup, everything runs in your browser.",
  path: "/about",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-600">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">About {siteConfig.name}</h1>
        <p className="mt-4 text-lg text-gray-600">
          {siteConfig.name} is a growing collection of fast, accurate, privacy-first calculators for
          everyday money decisions in India — EMIs, SIPs, fixed and recurring deposits, PPF, GST,
          and more.
        </p>

        <Section title="Our mission">
          <p>
            Financial decisions shouldn’t require a spreadsheet or a login. Our mission is to make
            trustworthy financial math available to everyone — instantly, for free, and without
            collecting your data.
          </p>
        </Section>

        <Section title="Why Esytol exists">
          <p>
            Most online calculators are slow, cluttered with ads and pop-ups, gate results behind
            sign-ups, or quietly send your numbers to a server. We wanted the opposite: a clean tool
            that loads instantly, shows its working, and never asks who you are.
          </p>
        </Section>

        <Section title="Engineering philosophy">
          <p>
            Every calculator is built on a pure, well-tested calculation engine that is separated
            from the interface. Each engine is validated against thousands of randomised scenarios
            and cross-checked against independent implementations, so the numbers you see are the
            numbers you’d get by hand.
          </p>
        </Section>

        <Section title="Accuracy">
          <p>
            We verify every formula against authoritative sources — the RBI, AMFI, SEBI, NHB, and
            major Indian bank documentation — and preserve exact accounting identities (for example,
            principal + interest = total payment) down to the last paisa. Where a real-world figure
            can differ (lender rounding, fees, taxes), we say so in a disclaimer on each tool.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            Every calculation runs entirely in your browser. We don’t collect, store, or transmit
            your inputs, and no account is ever required. Read the full{" "}
            <Link href="/privacy" className="text-brand-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <Section title="Open source">
          <p>
            Esytol is open source. You can read the code, audit the math, file issues, or suggest
            features on{" "}
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </Section>

        <Section title="Technology">
          <p>
            Built with Next.js and React, written in TypeScript (strict mode), styled with Tailwind
            CSS, charted with Recharts, and tested with Vitest. The site is statically generated and
            served from a CDN, which is why it loads instantly.
          </p>
        </Section>

        <Section title="Roadmap">
          <p>We’re actively expanding. On the way:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>More finance tools — income tax, NPS, gratuity, and goal planners</li>
            <li>Comparison modes (e.g. SIP vs lumpsum, home vs personal loan)</li>
            <li>Prepayment and step-up scenarios for loans and SIPs</li>
            <li>Downloadable PDF summaries</li>
          </ul>
          <p>
            Have a request?{" "}
            <Link href="/contact" className="text-brand-600 hover:underline">
              Tell us
            </Link>
            .
          </p>
        </Section>

        <p className="mt-10 text-sm text-gray-400">
          Built by{" "}
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            EasyTechLabs
          </a>
          .
        </p>
      </div>
    </div>
  );
}

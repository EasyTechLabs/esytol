import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Esytol is a free platform of online tools — fast, accurate and privacy-first. Finance is our deepest category today, with more on the way. No signup; everything runs in your browser.",
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
          {siteConfig.name} is a platform of free online tools that are fast, accurate and
          privacy-first. Our deepest category today is <strong>finance</strong> — EMIs, SIPs,
          deposits, PPF, tax and GST, built specifically for India — alongside{" "}
          <strong>everyday</strong> utilities. More categories are on the way.
        </p>

        <Section title="Our mission">
          <p>
            Useful tools shouldn’t require a spreadsheet, a login, or an ad-block. Our mission is to
            build the tools people actually need — instantly, for free, and without collecting your
            data — starting where the need is greatest and the stakes are highest: money decisions
            in India.
          </p>
          <p>
            We would rather be the best in the world at one category than mediocre across ten, so we
            go deep before we go wide. Finance came first because the decisions are consequential
            and the existing tools are poor. It will not be the last.
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

        <Section title="Showing our working">
          <p>
            You shouldn’t have to take our arithmetic on trust. Every calculator publishes the
            formula it uses, the official sources behind it — RBI, the Income Tax Department, EPFO,
            PFRDA and others — the assumptions it makes, and its limitations. If a number looks
            wrong, the methodology on the page tells you exactly how it was produced.
          </p>
          <p>
            Our{" "}
            <Link href="/learn" className="text-brand-600 hover:underline">
              Learn
            </Link>{" "}
            articles go further, explaining the rules themselves and citing the regulator rather
            than asking you to believe us.
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
          <p>We’re actively expanding — in depth and in breadth. On the way:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Deeper finance coverage — goal planners, capital gains, and advance tax</li>
            <li>New categories beyond finance and everyday</li>
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

        <p className="mt-10 text-sm text-gray-400">Built by EasyTechLabs.</p>
      </div>
    </div>
  );
}

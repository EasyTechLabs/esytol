import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Esytol handles data: calculators run in your browser and store nothing, while accounts for Esytol's ledger services (Udharpe and Vyora) are stored as described in their own notice.",
  path: "/privacy",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-gray-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="container-page section-gap">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-4 text-sm text-gray-400">Last updated: 12 November 2026</p>

        <p className="mt-6 text-gray-600">
          {siteConfig.name} (“we”, “us”) is built to respect your privacy. Every calculator runs
          entirely in your browser — the numbers you type are never sent to, seen by, or stored on
          our servers. This policy explains what data may be processed when you visit the site.
          Esytol also operates account-based ledger services, Udharpe and Vyora, which do store
          personal information; they are described below and in their own notice.
        </p>

        <Section title="Calculator inputs">
          <p>
            All calculations happen locally on your device using JavaScript. Loan amounts, interest
            rates, contributions, and any other values you enter are processed in your browser and
            are never transmitted to us or any third party.
          </p>
        </Section>

        <Section title="Accounts: Udharpe and Vyora">
          <p>
            If you sign in to Udharpe (on the phone app or at{" "}
            <Link href="/vyora" className="text-brand-600 hover:underline">
              esytol.com/vyora
            </Link>
            ), we store the information needed to run your account and shared ledger: for example
            your email address, shop details, customers recorded by a shop, credit and repayment
            records, and, for shopkeepers applying to open a shop, two photographs taken in the app.
            What is collected, why, who can see it, how long it is kept and how to make a request
            are set out in the{" "}
            <Link href="/udharpe/privacy" className="text-brand-600 hover:underline">
              Udharpe privacy notice
            </Link>
            , which applies to those services in addition to this policy.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We do not set our own tracking cookies. If we enable analytics or advertising in the
            future (see below), those third-party services may set cookies on your device. Where
            required by law, we will request consent before any non-essential cookies are set. You
            can also block or delete cookies in your browser settings at any time.
          </p>
        </Section>

        <Section title="Analytics">
          <p>
            We may use privacy-respecting, aggregate analytics to understand which tools are useful
            (for example, page views and popular calculators). This data is anonymised and never
            linked to an individual. Analytics is disabled unless a measurement ID is configured.
          </p>
        </Section>

        <Section title="Google Analytics">
          <p>
            If Google Analytics is enabled, Google may process anonymised usage data (such as pages
            visited, approximate region, device, and browser type) on our behalf and may set cookies
            to do so. We do not send Google any information you type into a calculator. You can opt
            out using Google’s{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              browser add-on
            </a>
            .
          </p>
        </Section>

        <Section title="Advertising (future)">
          <p>
            {siteConfig.name} does not currently display ads. If we introduce advertising (for
            example, Google AdSense), third-party vendors including Google may use cookies or
            similar technologies to serve ads based on your visits to this and other websites. At
            that time this policy will be updated, and you will be able to manage ad personalisation
            through{" "}
            <a
              href="https://myadcenter.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              Google’s Ads settings
            </a>{" "}
            and consent controls where required.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            The site and the Udharpe service are hosted on Google Cloud in India, and the
            site&apos;s source is on GitHub. These providers process data only to deliver and secure
            the services. We do not sell personal data, and we share it only as the Udharpe privacy
            notice describes.
          </p>
        </Section>

        <Section title="Log data">
          <p>
            Like most websites, our hosting provider may automatically record standard server logs —
            IP address, browser user-agent, referring page, and timestamp — for security, abuse
            prevention, and reliability. These logs are not used to identify you and are not
            combined with your calculator inputs.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            Calculator use stores nothing about you. Aggregate analytics and hosting logs, where
            present, are retained only for as long as the respective provider’s standard retention
            period. Information held for Udharpe and Vyora accounts is kept as described in the{" "}
            <Link href="/udharpe/privacy" className="text-brand-600 hover:underline">
              Udharpe privacy notice
            </Link>
            .
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on your jurisdiction (for example, under the GDPR or India’s DPDP Act), you
            may have the right to access, correct, or erase personal data and to object to
            processing. If you only use the calculators, we hold no personal data about you and most
            requests can be satisfied by clearing your browser’s cookies. If you have a Udharpe or
            Vyora account, write to us at the address below from your account&apos;s email address
            and we will respond as the Udharpe privacy notice describes.
          </p>
        </Section>

        <Section title="Children">
          <p>
            {siteConfig.name} is a general-purpose utility and is not directed at children under 13.
            We do not knowingly collect data from children.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy as the site evolves (for example, if analytics or ads are
            enabled). Material changes will be reflected in the “Last updated” date above.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about privacy? Email{" "}
            <a href="mailto:hello@esytol.com" className="text-brand-600 hover:underline">
              hello@esytol.com
            </a>{" "}
            or reach us via the{" "}
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

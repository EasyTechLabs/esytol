import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { getPlan } from "@/lib/api/plans";
import { ContactForm } from "@/features/dev-api/ContactForm";

export const metadata: Metadata = buildMetadata({
  title: "Enterprise — Income Tax API",
  description:
    "Enterprise access to the Esytol Income Tax API: negotiated volume, SLAs, direct off-marketplace API keys, custom regimes, invoicing, and a self-host option. Talk to us.",
  path: "/enterprise",
});

export default function EnterprisePage() {
  const enterprise = getPlan("enterprise");
  return (
    <div className="container-page section-gap">
      <header className="max-w-3xl">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Enterprise
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
          Income Tax API for teams at scale
        </h1>
        <p className="mt-3 text-gray-600">
          For payroll platforms, fintechs, and enterprises that need the tax engine as dependable
          infrastructure — beyond the self-serve RapidAPI tiers. Deterministic, fully explainable,
          and available off-marketplace with direct keys and invoicing.
        </p>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {enterprise.features.map((f) => (
          <div key={f} className="rounded-xl border border-gray-200 p-4">
            <span className="text-sm font-medium text-gray-800">{f}</span>
          </div>
        ))}
        <div className="rounded-xl border border-gray-200 p-4">
          <span className="text-sm font-medium text-gray-800">
            Higher throughput ({enterprise.rateLimit.limit} req/min baseline, negotiable)
          </span>
        </div>
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-xl font-semibold text-gray-900">Request enterprise access</h2>
        <p className="mt-1 text-sm text-gray-500">
          Tell us your volume, latency/SLA needs, and deployment preference. We reply within one
          business day.
        </p>
        <div className="mt-5">
          <ContactForm type="enterprise" source="enterprise_page" />
        </div>
      </section>

      <p className="mt-10 max-w-3xl text-xs text-gray-500">
        The engine covers resident individuals below 60 and applies each year&rsquo;s Finance Act.
        Custom regimes, additional payer categories, and capital-gains handling are available under
        an enterprise engagement.
      </p>
    </div>
  );
}

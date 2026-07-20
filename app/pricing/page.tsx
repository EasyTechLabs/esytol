import type { Metadata } from "next";
import { buildMetadata } from "@/seo/metadata";
import { selfServePlans, getPlan } from "@/lib/api/plans";
import { GetApiKeyButton, GetStartedButton, ContactSalesButton } from "@/features/dev-api/ApiCtas";

export const metadata: Metadata = buildMetadata({
  title: "Income Tax API — Pricing",
  description:
    "Simple usage-based pricing for the Esytol Income Tax API. Start free (no signup for the public endpoint), scale on RapidAPI, or contact us for enterprise volume and SLAs.",
  path: "/pricing",
});

const usd = (n: number | null) => (n === null ? "Custom" : n === 0 ? "$0" : `$${n}`);
const num = (n: number | null) => (n === null ? "Negotiated" : n.toLocaleString("en-US"));

export default function PricingPage() {
  const tiers = selfServePlans();
  const enterprise = getPlan("enterprise");

  return (
    <div className="container-page section-gap">
      <header className="max-w-3xl">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Income Tax API · Pricing
        </span>
        <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Pay for what you use</h1>
        <p className="mt-3 text-gray-600">
          A deterministic Indian income-tax API — Old vs New regime, multi-year, fully explainable.
          The public endpoint is free with no signup; paid tiers add higher quotas and are billed
          and metered through RapidAPI.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Prices are launch hypotheses (USD) and will be corrected by real usage — see the pricing
          rationale in our docs. RapidAPI handles billing and metering.
        </p>
      </header>

      {/* Self-serve tiers */}
      <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-5 ${
              plan.id === "pro" ? "border-brand-300 ring-1 ring-brand-200" : "border-gray-200"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
              {plan.id === "pro" && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                  Popular
                </span>
              )}
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {usd(plan.priceUsd)}
              {plan.priceUsd !== null && plan.priceUsd > 0 && (
                <span className="text-sm font-normal text-gray-400"> /mo</span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {num(plan.includedRequestsPerMonth)} requests / month
            </p>
            <p className="text-xs text-gray-400">{plan.rateLimit.limit} req/min</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-gray-600">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-brand-500">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              {plan.id === "free" ? (
                <GetStartedButton source="pricing_free" variant="primary" />
              ) : (
                <GetApiKeyButton
                  source={`pricing_${plan.id}`}
                  label="Subscribe on RapidAPI"
                  variant="primary"
                />
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Enterprise */}
      <section className="mt-8 rounded-2xl border border-gray-900/10 bg-gray-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{enterprise.name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              {enterprise.forWho}. {enterprise.features.join(" · ")}.
            </p>
          </div>
          <ContactSalesButton
            source="pricing_enterprise"
            label="Request enterprise"
            variant="primary"
          />
        </div>
      </section>

      {/* Comparison — repo-cited competitors; capabilities compared, not measured metrics */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900">How it compares</h2>
        <p className="mt-1 text-sm text-gray-500">
          The market has full-compliance suites and calculators, but a lightweight, deterministic,
          well-documented tax-<em>calculation</em> API is an underserved gap.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="py-2 pr-4">Capability</th>
                <th className="py-2 pr-4">Esytol API</th>
                <th className="py-2 pr-4">Sandbox by Quicko</th>
                <th className="py-2">ClearTax</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <CmpRow
                c="Focus"
                a="Tax calculation API"
                b="Compliance/filing platform"
                d="Filing + compliance suite"
              />
              <CmpRow c="Old vs New regime + §-level trace" a="Yes" b="—" d="—" />
              <CmpRow c="Self-serve on RapidAPI" a="Yes" b="—" d="—" />
              <CmpRow c="Public free tier, no signup" a="Yes" b="—" d="—" />
              <CmpRow c="Deterministic (identical in = identical out)" a="Yes" b="—" d="—" />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Comparison of capabilities only. Competitor names are cited from our internal research;
          competitor traffic, pricing, and market-share figures are not asserted here (unverified —
          never invented).
        </p>
      </section>
    </div>
  );
}

function CmpRow({ c, a, b, d }: { c: string; a: string; b: string; d: string }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-4">{c}</td>
      <td className="py-2 pr-4 font-medium text-brand-700">{a}</td>
      <td className="py-2 pr-4 text-gray-500">{b}</td>
      <td className="py-2 text-gray-500">{d}</td>
    </tr>
  );
}

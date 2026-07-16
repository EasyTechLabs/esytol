/**
 * "Browse by domain" — the homepage's answer to *what is this site?*
 *
 * Replaces the old category grid, which rendered a single card reading
 * "Calculators" because every live tool shares `category: "calculator"`. One card
 * labelled Calculators is a strong claim that Esytol is a calculator website.
 *
 * Renders live domains (see `registry/domains.ts`) with their real tools. Domains
 * with no live tools never appear, so the page never advertises a category we cannot
 * deliver — and when one ships, it appears here on its own with no redesign.
 *
 * Tools are shown inline rather than behind a "Finance →" link because `/tools`
 * filters by free-text query only: `?q=finance` returns 8 of the 13 finance tools
 * (FD, RD, PPF, HRA, EPF, gratuity and NPS carry no "finance" tag). A card promising
 * 13 and delivering 8 is worse than no card.
 */

import Link from "next/link";
import { ToolCard } from "@/components/ui/ToolCard";
import { getLiveDomains, toolsInDomain } from "@/registry/domains";

/** Enough to show the shape of a domain without turning the homepage into a list. */
const MAX_PER_DOMAIN = 6;

export function DomainSections() {
  const domains = getLiveDomains();

  return (
    <div className="flex flex-col gap-12">
      {domains.map((domain) => {
        const tools = toolsInDomain(domain);
        const shown = tools.slice(0, MAX_PER_DOMAIN);

        return (
          <section key={domain.slug} aria-labelledby={`domain-${domain.slug}`}>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3
                id={`domain-${domain.slug}`}
                className="flex items-center gap-2 text-xl font-semibold text-gray-900"
              >
                <span aria-hidden="true">{domain.icon}</span>
                {domain.name}
              </h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {domain.toolCount} {domain.toolCount === 1 ? "tool" : "tools"}
              </span>
              <p className="w-full text-sm text-gray-500 sm:w-auto">{domain.description}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>

            {tools.length > shown.length && (
              <Link
                href="/tools"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Browse all {domain.toolCount} {domain.name.toLowerCase()} tools →
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}

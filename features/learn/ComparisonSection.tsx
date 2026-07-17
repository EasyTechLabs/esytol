"use client";

/**
 * The one comparison layout (REVENUE-001). Every comparison on the site renders
 * through this component — criteria, option cards, and the always-on disclosure.
 *
 * Trust properties, enforced here and by the dataset type:
 * - cons and "avoid if" render with the same prominence as pros;
 * - the disclosure is unconditional;
 * - sponsored links (none exist yet) would render a "Sponsored" tag and
 *   rel="sponsored noopener" — structural disclosure, not editorial memory.
 *
 * Measurement: fires GA4 events via the site's existing gtag (loaded by
 * analytics/Analytics.tsx when configured). Events carry the comparison id and
 * option name only — no user data, consistent with the privacy posture.
 *   - comparison_view   (once, when the section first scrolls into view)
 *   - comparison_cta_click (option link clicks, incl. affiliate_click flag)
 */

import { useEffect, useRef } from "react";
import type { Comparison, ComparisonOption } from "@/content/comparisons";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(event: string, params: Record<string, string>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, params);
  }
}

export function ComparisonSection({ comparison }: { comparison: Comparison }) {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!seen.current && entries.some((e) => e.isIntersecting)) {
          seen.current = true;
          track("comparison_view", { comparison_id: comparison.id });
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [comparison.id]);

  return (
    <section
      ref={ref}
      aria-labelledby={`comparison-${comparison.id}`}
      className="mt-10 rounded-xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <h2 id={`comparison-${comparison.id}`} className="text-lg font-semibold text-gray-900">
        {comparison.title}
      </h2>
      <p className="mt-2 text-sm text-gray-600">{comparison.intro}</p>

      <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          What to judge them on
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          {comparison.criteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {comparison.options.map((option) => (
          <OptionCard key={option.name} option={option} comparisonId={comparison.id} />
        ))}
      </div>

      <p className="mt-5 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">Disclosure: </span>
        {comparison.disclosure}
      </p>
    </section>
  );
}

function OptionCard({ option, comparisonId }: { option: ComparisonOption; comparisonId: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{option.name}</h3>
        {option.link?.sponsored && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Sponsored
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">{option.summary}</p>

      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-green-700">For</dt>
          <dd>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-gray-600">
              {option.pros.map((pro) => (
                <li key={pro}>{pro}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-red-700">Against</dt>
          <dd>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-gray-600">
              {option.cons.map((con) => (
                <li key={con}>{con}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Best for</dt>
          <dd className="mt-0.5 text-gray-700">{option.bestFor}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Avoid if</dt>
          <dd className="mt-0.5 text-gray-700">{option.avoidIf}</dd>
        </div>
        {option.pricing && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Pricing
            </dt>
            <dd className="mt-0.5 text-gray-700">{option.pricing}</dd>
          </div>
        )}
      </dl>

      {option.link && (
        <a
          href={option.link.href}
          target="_blank"
          rel={option.link.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer"}
          onClick={() =>
            track("comparison_cta_click", {
              comparison_id: comparisonId,
              option: option.name,
              affiliate: option.link?.sponsored ? "yes" : "no",
            })
          }
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
        >
          {option.link.label} ↗
        </a>
      )}
    </div>
  );
}

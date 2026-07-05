import type { Methodology } from "@/content/methodology";

/**
 * Shared, reusable "How this is calculated" section rendered beneath the results
 * of every finance calculator. Content is data-driven from content/methodology.ts
 * so there is no per-calculator duplication.
 */
export function MethodologySection({ methodology }: { methodology: Methodology }) {
  return (
    <section
      aria-labelledby="methodology-heading"
      className="rounded-xl border border-gray-200 bg-white p-5"
    >
      <h2 id="methodology-heading" className="text-lg font-semibold text-gray-900">
        How this is calculated
      </h2>

      {/* Formula */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Formula</p>
        <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
          {methodology.formula}
        </p>
      </div>

      {/* Method */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Calculation method
        </p>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">{methodology.method}</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Assumptions */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Assumptions
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">
            {methodology.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>

        {/* Limitations */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Limitations
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">
            {methodology.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Official sources */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Official sources &amp; references
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {methodology.sources.map((s) =>
            s.url ? (
              <li key={s.label}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  {s.label} <span aria-hidden="true">↗</span>
                </a>
              </li>
            ) : (
              <li
                key={s.label}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
              >
                {s.label}
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  );
}

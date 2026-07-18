import type { Tool } from "@/types/tool";
import { getEverydayStandard } from "@/content/everydayStandards";

/**
 * The Everyday-domain trust surface — PLATFORM-004.
 *
 * The third sibling to CalculatorTrust (Finance) and DeveloperTrust (Developer):
 * where the tool runs, its data-retention policy, a plain-language algorithm
 * explanation, its limitations, and the objective standards it follows (Unicode,
 * ISO, calendar rules). Rendered once by ToolLayout for Everyday-domain tools;
 * renders nothing if the tool has no standard entry yet.
 */
export function EverydayTrust({ tool }: { tool: Tool }) {
  const standard = getEverydayStandard(tool.slug);
  if (!standard) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-3">
        <TrustCell
          label="Where it runs"
          value={standard.processing === "client" ? "Your browser" : "Server-side"}
        />
        <TrustCell label="Data retention" value="None — nothing is uploaded or stored" />
        <TrustCell label="Maintained by" value={standard.maintainedBy} />
      </div>

      <section
        aria-labelledby="everyday-standard-heading"
        className="rounded-xl border border-gray-200 bg-white p-5"
      >
        <h2 id="everyday-standard-heading" className="text-sm font-semibold text-gray-900">
          How this works &amp; your privacy
        </h2>

        <p className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
          🔒 {standard.dataRetention}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-gray-700">{standard.howItWorks}</p>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Limitations
        </h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {standard.limitations.map((limit) => (
            <li key={limit} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
              {limit}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Standards &amp; references
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {standard.standards.map((ref) =>
            ref.url ? (
              <li key={ref.label}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  {ref.label} <span aria-hidden="true">↗</span>
                </a>
              </li>
            ) : (
              <li
                key={ref.label}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
              >
                {ref.label}
              </li>
            )
          )}
        </ul>
      </section>
    </div>
  );
}

function TrustCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

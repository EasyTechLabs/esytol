import type { Tool } from "@/types/tool";
import type { Methodology } from "@/content/methodology";

/**
 * Shared E-E-A-T trust bar shown beneath a calculator's results: when it was
 * last updated, who reviewed the methodology, the calculation method, and the
 * official sources it is based on. Data-driven — no per-calculator duplication.
 */
export function ToolTrustBar({ tool, methodology }: { tool: Tool; methodology: Methodology }) {
  const sources = methodology.sources.map((s) => s.label).join(", ");

  return (
    <section
      aria-label="Trust and accuracy"
      className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm sm:grid-cols-2"
    >
      <TrustItem icon="🗓️" label="Last updated">
        {tool.lastUpdated ?? "—"}
      </TrustItem>
      <TrustItem icon="✅" label="Reviewed by">
        {methodology.reviewedBy}
      </TrustItem>
      <TrustItem icon="📐" label="Calculation method">
        Documented in “How this is calculated” below
      </TrustItem>
      <TrustItem icon="🏛️" label="Official sources">
        {sources}
      </TrustItem>
    </section>
  );
}

function TrustItem({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 leading-none">
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="mt-0.5 text-gray-700">{children}</p>
      </div>
    </div>
  );
}

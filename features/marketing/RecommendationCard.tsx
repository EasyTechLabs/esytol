import { cn } from "@/lib/cn";
import type { Recommendation } from "@/lib/marketing-agent/types";
import { PriorityBadge } from "./PriorityBadge";
import { ScoreMeter } from "./ScoreMeter";

const EFFORT_LABEL: Record<Recommendation["effort"], string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
};

/**
 * A single agent recommendation — the atom of the Marketing Agent.
 * Shows the decision (title), the evidence (reason + numbers), the payoff
 * (expected impact) and the commitment (effort · confidence · owner · deadline).
 */
export function RecommendationCard({
  rec,
  rank,
  className,
}: {
  rec: Recommendation;
  rank?: number;
  className?: string;
}) {
  return (
    <article className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {rank !== undefined && (
          <span className="text-xs font-semibold tabular-nums text-gray-400">#{rank}</span>
        )}
        <PriorityBadge priority={rec.priority} />
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-gray-500">
          {rec.agent}
        </span>
        <span className="ml-auto">
          <ScoreMeter score={rec.score} />
        </span>
      </div>

      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
      <p className="mt-1 text-sm text-gray-600">{rec.reason}</p>

      <p className="text-brand-800 mt-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium">
        {rec.expectedImpact}
      </p>

      {rec.evidence.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {rec.evidence.map((e) => (
            <div key={e.label} className="text-xs">
              <dt className="inline text-gray-400">{e.label}: </dt>
              <dd className="inline font-medium tabular-nums text-gray-700">{e.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2.5 text-xs text-gray-500">
        <span>
          Effort: <strong className="text-gray-700">{EFFORT_LABEL[rec.effort]}</strong>
        </span>
        <span>
          Confidence: <strong className="text-gray-700">{Math.round(rec.confidence * 100)}%</strong>
        </span>
        <span>
          Owner: <strong className="text-gray-700">{rec.owner}</strong>
        </span>
        <span>
          By: <strong className="text-gray-700">{rec.deadline}</strong>
        </span>
      </div>
    </article>
  );
}

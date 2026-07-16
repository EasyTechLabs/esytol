import { cn } from "@/lib/cn";

/**
 * Opportunity score, 0–100.
 * Colour tracks the priority bands in `scoring.ts` so the meter and the badge
 * always agree.
 */
export function ScoreMeter({ score, className }: { score: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, score));
  const tone =
    clamped >= 45
      ? "bg-red-500"
      : clamped >= 25
        ? "bg-amber-500"
        : clamped >= 10
          ? "bg-brand-500"
          : "bg-gray-400";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={`Opportunity score ${clamped} of 100`}
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.max(3, clamped)}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-700">
        {clamped}
      </span>
    </div>
  );
}

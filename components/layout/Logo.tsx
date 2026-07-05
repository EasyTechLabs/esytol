import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";

interface LogoProps {
  className?: string;
  /** Show the "Esytol" wordmark next to the mark. Defaults to true. */
  withWordmark?: boolean;
}

/**
 * Esytol brand mark — the SVG logo (an "E" in a rounded brand-blue square),
 * inlined for crispness and zero extra requests. Replaces the former emoji logo.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 200 200"
        className="h-7 w-7 shrink-0"
        role="img"
        aria-label={`${siteConfig.name} logo`}
      >
        <rect width="200" height="200" rx="42" fill="#2563eb" />
        <text
          x="100"
          y="150"
          fontFamily="system-ui, sans-serif"
          fontSize="132"
          fontWeight="800"
          fill="#ffffff"
          textAnchor="middle"
        >
          E
        </text>
      </svg>
      {withWordmark && <span className="text-lg tracking-tight">{siteConfig.name}</span>}
    </span>
  );
}

/**
 * Analytics infrastructure — provider-agnostic and environment-gated.
 *
 * No tracking ID is hardcoded. Providers load only when their env var is set,
 * via the <Analytics /> component:
 *   - NEXT_PUBLIC_GA_ID       → Google Analytics 4 (gtag.js)
 *   - NEXT_PUBLIC_CLARITY_ID  → Microsoft Clarity
 * Each provider is independent. When enabling one, its domains must be allowed
 * in the Content-Security-Policy in next.config.ts (the default CSP blocks
 * external scripts).
 */

export const analyticsConfig = {
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
  clarityId: process.env.NEXT_PUBLIC_CLARITY_ID ?? "",
  /** GA event tracking (trackEvent / trackPageView) — GA4 only. */
  enabled: Boolean(process.env.NEXT_PUBLIC_GA_ID),
} as const;

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { gtag?: GtagFn }).gtag;
}

/** Report a custom event. No-op unless analytics is configured. */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!analyticsConfig.enabled) return;
  getGtag()?.("event", name, properties ?? {});
}

/** Report a page view. No-op unless analytics is configured. */
export function trackPageView(path: string): void {
  if (!analyticsConfig.enabled) return;
  getGtag()?.("event", "page_view", { page_path: path });
}
